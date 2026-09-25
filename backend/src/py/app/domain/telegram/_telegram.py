"""Minimal async client for the Telegram Bot API."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import httpx

API_BASE = "https://api.telegram.org"
MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024
"""Bots can only download files up to 20 MB through getFile."""


class TelegramError(Exception):
    """Raised when the Bot API returns ``ok: false``."""


class TelegramClient:
    def __init__(self, token: str, http: httpx.AsyncClient) -> None:
        self._token = token
        self._http = http

    async def _call(self, method: str, **params: Any) -> Any:
        response = await self._http.post(f"{API_BASE}/bot{self._token}/{method}", json=params)
        payload = response.json()
        if not payload.get("ok"):
            msg = f"Telegram {method} failed: {payload.get('description', response.status_code)}"
            raise TelegramError(msg)
        return payload["result"]

    async def send_message(self, chat_id: int, text: str, reply_to: int | None = None) -> None:
        params: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "link_preview_options": {"is_disabled": True},
        }
        if reply_to is not None:
            params["reply_parameters"] = {"message_id": reply_to, "allow_sending_without_reply": True}
        await self._call("sendMessage", **params)

    async def send_typing(self, chat_id: int) -> None:
        await self._call("sendChatAction", chat_id=chat_id, action="typing")

    async def download_file(self, file_id: str) -> bytes:
        file_info = await self._call("getFile", file_id=file_id)
        response = await self._http.get(f"{API_BASE}/file/bot{self._token}/{file_info['file_path']}")
        response.raise_for_status()
        return response.content

    async def set_webhook(self, url: str, secret: str) -> None:
        await self._call(
            "setWebhook",
            url=url,
            secret_token=secret,
            allowed_updates=["message"],
            drop_pending_updates=True,
        )
