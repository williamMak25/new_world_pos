from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import httpx
import pytest
from litestar import Litestar
from litestar.testing import AsyncTestClient

from app.domain.telegram import _pipeline, controllers
from app.domain.telegram._extract import ReceiptData, ReceiptItem
from app.lib.settings import TelegramBotSettings

pytestmark = pytest.mark.anyio

CHAT_ID = 12345


@pytest.fixture()
def bot_settings(monkeypatch: pytest.MonkeyPatch) -> TelegramBotSettings:
    settings = TelegramBotSettings(
        BOT_TOKEN="TOKEN",
        WEBHOOK_SECRET="hook-secret",
        ALLOWED_CHAT_IDS=[str(CHAT_ID)],
        AI_MODEL="claude-opus-5",
        GOOGLE_CLIENT_ID="cid",
        GOOGLE_CLIENT_SECRET="csecret",
        GOOGLE_REFRESH_TOKEN="refresh",
        GOOGLE_SHEET_ID="SHEET",
        GOOGLE_DRIVE_FOLDER_ID="FOLDER",
    )
    fake = SimpleNamespace(telegram=settings)
    monkeypatch.setattr(_pipeline, "get_settings", lambda: fake)
    monkeypatch.setattr(controllers, "get_settings", lambda: fake)
    return settings


@pytest.fixture()
def calls(monkeypatch: pytest.MonkeyPatch) -> list[httpx.Request]:
    """Route every outgoing HTTP call to fake Telegram and Google APIs."""
    recorded: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:  # noqa: PLR0911
        recorded.append(request)
        url = str(request.url)
        if url == "https://oauth2.googleapis.com/token":
            return httpx.Response(200, json={"access_token": "access", "expires_in": 3600})
        if "/getFile" in url:
            return httpx.Response(200, json={"ok": True, "result": {"file_path": "photos/file_1.jpg"}})
        if url.startswith("https://api.telegram.org/file/"):
            return httpx.Response(200, content=b"\xff\xd8jpeg-bytes")
        if url.startswith("https://api.telegram.org/bot"):
            return httpx.Response(200, json={"ok": True, "result": {}})
        if url.startswith("https://www.googleapis.com/upload/drive"):
            return httpx.Response(200, json={"id": "F1", "webViewLink": "https://drive.google.com/file/d/F1/view"})
        if url.startswith("https://sheets.googleapis.com"):
            return httpx.Response(200, json={})
        return httpx.Response(404)

    real_client = httpx.AsyncClient

    def fake_client(**kwargs: Any) -> httpx.AsyncClient:
        return real_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(_pipeline.httpx, "AsyncClient", fake_client)
    return recorded


def _message(**fields: Any) -> dict[str, Any]:
    return {
        "update_id": 1,
        "message": {
            "message_id": 7,
            "date": 1758787200,
            "chat": {"id": CHAT_ID, "type": "private"},
            "from": {"id": CHAT_ID, "first_name": "Win", "username": "win"},
            **fields,
        },
    }


def _sent_texts(calls: list[httpx.Request]) -> list[str]:
    return [json.loads(r.content)["text"] for r in calls if r.url.path.endswith("/sendMessage")]


def _sheet_rows(calls: list[httpx.Request]) -> list[tuple[str, list[Any]]]:
    return [(r.url.path, json.loads(r.content)["values"][0]) for r in calls if r.url.host == "sheets.googleapis.com"]


async def test_text_is_extracted_to_sheet_and_previewed(
    bot_settings: TelegramBotSettings, calls: list[httpx.Request], monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_extract(_client: Any, model: str, text: str) -> ReceiptData:
        assert model == "claude-opus-5"
        assert "coffee" in text
        return ReceiptData(
            is_receipt=True,
            date="2025-09-25",
            merchant="Cafe <One>",
            category="Food",
            items=[ReceiptItem(name="Coffee", quantity=2, amount=7000)],
            total=7000,
            currency="MMK",
        )

    monkeypatch.setattr(_pipeline, "extract_receipt", fake_extract)
    await _pipeline.process_update(_message(text="2 coffee at Cafe One 7000 ks"))

    rows = _sheet_rows(calls)
    assert len(rows) == 1
    path, row = rows[0]
    assert "/SHEET/values/Receipts!A1:append" in path
    assert row[3:7] == ["2025-09-25", "Cafe <One>", "Food", "Coffee x2 = 7,000"]
    assert row[10] == 7000
    assert row[-1] == "2 coffee at Cafe One 7000 ks"

    [preview] = _sent_texts(calls)
    assert "Cafe &lt;One&gt;" in preview  # HTML-escaped for Telegram
    assert "Total: 7,000 MMK" in preview


async def test_photo_is_uploaded_to_drive_and_previewed(
    bot_settings: TelegramBotSettings, calls: list[httpx.Request]
) -> None:
    photo = [{"file_id": "small", "file_size": 10}, {"file_id": "large", "file_size": 2048}]
    await _pipeline.process_update(_message(photo=photo, caption="lunch"))

    get_file = next(r for r in calls if r.url.path.endswith("/getFile"))
    assert json.loads(get_file.content)["file_id"] == "large"

    upload = next(r for r in calls if r.url.host == "www.googleapis.com")
    assert b'"parents": ["FOLDER"]' in upload.content
    assert b"jpeg-bytes" in upload.content

    [(path, row)] = _sheet_rows(calls)
    assert "Files!A1:append" in path
    assert row[3] == "20250925-080000_photo.jpg"
    assert row[-1] == "https://drive.google.com/file/d/F1/view"

    [preview] = _sent_texts(calls)
    assert "Saved to Google Drive" in preview
    assert "lunch" in preview


async def test_unknown_chat_is_rejected(bot_settings: TelegramBotSettings, calls: list[httpx.Request]) -> None:
    update = _message(text="hello")
    update["message"]["chat"]["id"] = 999
    await _pipeline.process_update(update)

    assert not _sheet_rows(calls)
    [reply] = _sent_texts(calls)
    assert "999" in reply


async def test_failure_is_reported_to_user(
    bot_settings: TelegramBotSettings, calls: list[httpx.Request], monkeypatch: pytest.MonkeyPatch
) -> None:
    async def broken_extract(*_: Any) -> ReceiptData:
        msg = "boom"
        raise RuntimeError(msg)

    monkeypatch.setattr(_pipeline, "extract_receipt", broken_extract)
    await _pipeline.process_update(_message(text="receipt"))

    [reply] = _sent_texts(calls)
    assert "didn't work" in reply


async def test_webhook_checks_secret(bot_settings: TelegramBotSettings, monkeypatch: pytest.MonkeyPatch) -> None:
    received: list[dict[str, Any]] = []

    async def fake_process(update: dict[str, Any]) -> None:
        received.append(update)

    monkeypatch.setattr(controllers, "process_update", fake_process)
    app = Litestar(route_handlers=[controllers.TelegramController])
    async with AsyncTestClient(app=app) as client:
        bad = await client.post(
            "/api/telegram/webhook", json={"update_id": 1}, headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"}
        )
        good = await client.post(
            "/api/telegram/webhook",
            json={"update_id": 2},
            headers={"X-Telegram-Bot-Api-Secret-Token": "hook-secret"},
        )

    assert bad.status_code == 401
    assert good.status_code == 200
    assert received == [{"update_id": 2}]
