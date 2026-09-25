"""Handle one Telegram update: text -> Claude -> Sheet, photo/file -> Drive, then reply with a preview."""

from __future__ import annotations

import mimetypes
from datetime import UTC, datetime
from html import escape
from typing import TYPE_CHECKING, Any

import anthropic
import httpx
import structlog

from app.domain.telegram._extract import ExtractionError, ReceiptData, extract_receipt
from app.domain.telegram._google import FILES_TAB, RECEIPTS_TAB, GoogleClient
from app.domain.telegram._telegram import MAX_DOWNLOAD_BYTES, TelegramClient
from app.lib.settings import get_settings

if TYPE_CHECKING:
    from app.lib.settings import TelegramBotSettings

logger = structlog.get_logger()

HELP_TEXT = (
    "Send me a receipt:\n"
    "• <b>Text</b> - I read it and add a row to the Receipts sheet.\n"
    "• <b>Photo or file</b> - I save it to the Google Drive folder.\n\n"
    "Your chat ID is <code>{chat_id}</code>."
)


async def process_update(update: dict[str, Any]) -> None:
    """Entry point run as a background task after the webhook has already returned 200."""
    settings = get_settings().telegram
    message = update.get("message")
    if not message:
        return
    async with httpx.AsyncClient(timeout=60) as http:
        bot = TelegramClient(settings.BOT_TOKEN, http)
        chat_id: int = message["chat"]["id"]
        message_id: int = message["message_id"]
        try:
            await _handle_message(message, settings, bot, http)
        except Exception as exc:  # noqa: BLE001 - always tell the user something went wrong
            await logger.aexception("telegram update failed", chat_id=chat_id)
            await bot.send_message(
                chat_id, f"⚠️ Sorry, that didn't work: {escape(_short_error(exc))}", reply_to=message_id
            )


async def _handle_message(
    message: dict[str, Any], settings: TelegramBotSettings, bot: TelegramClient, http: httpx.AsyncClient
) -> None:
    chat_id: int = message["chat"]["id"]
    message_id: int = message["message_id"]
    text: str = message.get("text", "")

    if text.startswith(("/start", "/help")):
        await bot.send_message(chat_id, HELP_TEXT.format(chat_id=chat_id))
        return
    if str(chat_id) not in settings.ALLOWED_CHAT_IDS:
        await bot.send_message(
            chat_id,
            f"This bot is private. Ask the owner to add your chat ID <code>{chat_id}</code>.",
        )
        return

    google = GoogleClient(settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET, settings.GOOGLE_REFRESH_TOKEN, http)
    sender = _sender_name(message)
    received_at = datetime.fromtimestamp(message["date"], tz=UTC).strftime("%Y-%m-%d %H:%M:%S UTC")

    attachment = _attachment(message)
    if attachment is not None:
        await bot.send_typing(chat_id)
        preview = await _save_file(message, attachment, settings, bot, google, sender, received_at)
    elif text:
        await bot.send_typing(chat_id)
        preview = await _save_text(message, text, settings, google, sender, received_at)
    else:
        preview = "I can only handle text, photos and files."
    await bot.send_message(chat_id, preview, reply_to=message_id)


async def _save_text(
    message: dict[str, Any],
    text: str,
    settings: TelegramBotSettings,
    google: GoogleClient,
    sender: str,
    received_at: str,
) -> str:
    try:
        receipt = await extract_receipt(anthropic.AsyncAnthropic(), settings.AI_MODEL, text)
    except (ExtractionError, anthropic.APIError):
        await logger.aexception("receipt extraction failed")
        # Still keep the message so nothing is lost; it can be filled in by hand.
        receipt = ReceiptData(is_receipt=False, notes="AI could not read this message")

    await google.append_row(
        settings.GOOGLE_SHEET_ID,
        RECEIPTS_TAB,
        [
            received_at,
            sender,
            str(message["chat"]["id"]),
            receipt.date or "",
            receipt.merchant or "",
            receipt.category or "",
            _items_cell(receipt),
            _num(receipt.subtotal),
            _num(receipt.tax),
            _num(receipt.discount),
            _num(receipt.total),
            receipt.currency or "",
            receipt.payment_method or "",
            receipt.notes or "",
            text,
        ],
    )
    return _receipt_preview(receipt)


async def _save_file(
    message: dict[str, Any],
    attachment: dict[str, Any],
    settings: TelegramBotSettings,
    bot: TelegramClient,
    google: GoogleClient,
    sender: str,
    received_at: str,
) -> str:
    size = attachment.get("file_size") or 0
    if size > MAX_DOWNLOAD_BYTES:
        return "⚠️ That file is over 20 MB, which is the most a Telegram bot can download."

    data = await bot.download_file(attachment["file_id"])
    stamp = datetime.fromtimestamp(message["date"], tz=UTC).strftime("%Y%m%d-%H%M%S")
    name = f"{stamp}_{attachment['name']}"
    link = await google.upload_file(settings.GOOGLE_DRIVE_FOLDER_ID, name, attachment["mime_type"], data)

    caption = message.get("caption", "")
    await google.append_row(
        settings.GOOGLE_SHEET_ID,
        FILES_TAB,
        [received_at, sender, str(message["chat"]["id"]), name, attachment["mime_type"], len(data), caption, link],
    )
    lines = [
        "✅ <b>Saved to Google Drive</b>",
        f"📄 {escape(name)} ({_human_size(len(data))})",
    ]
    if caption:
        lines.append(f"📝 {escape(caption)}")
    lines.append(f'🔗 <a href="{escape(link)}">Open in Drive</a>')
    return "\n".join(lines)


def _attachment(message: dict[str, Any]) -> dict[str, Any] | None:
    """Return file_id, name and mime type for a photo or document, if the message has one."""
    if photos := message.get("photo"):
        largest = photos[-1]  # Telegram lists sizes smallest to largest
        return {
            "file_id": largest["file_id"],
            "file_size": largest.get("file_size"),
            "name": "photo.jpg",
            "mime_type": "image/jpeg",
        }
    if doc := message.get("document"):
        name = doc.get("file_name") or "file"
        mime_type = doc.get("mime_type") or mimetypes.guess_type(name)[0] or "application/octet-stream"
        return {"file_id": doc["file_id"], "file_size": doc.get("file_size"), "name": name, "mime_type": mime_type}
    return None


def _receipt_preview(receipt: ReceiptData) -> str:
    if not receipt.is_receipt:
        note = f"\n{escape(receipt.notes)}" if receipt.notes else ""
        return f"📝 <b>Saved to the sheet</b>, but this doesn't look like a receipt.{note}"

    currency = f" {escape(receipt.currency)}" if receipt.currency else ""
    lines = ["✅ <b>Receipt saved to Google Sheet</b>", ""]
    if receipt.merchant:
        lines.append(f"🏪 <b>{escape(receipt.merchant)}</b>")
    if receipt.date:
        lines.append(f"📅 {escape(receipt.date)}")
    if receipt.category:
        lines.append(f"🏷 {escape(receipt.category)}")
    if receipt.items:
        lines.append("")
        for item in receipt.items:
            qty = f"{_fmt(item.quantity)} x " if item.quantity not in {None, 1} else ""
            amount = f" - {_fmt(item.amount)}" if item.amount is not None else ""
            lines.append(f"• {qty}{escape(item.name)}{amount}")
    lines.append("")
    for label, value in (("Subtotal", receipt.subtotal), ("Tax", receipt.tax), ("Discount", receipt.discount)):
        if value is not None:
            lines.append(f"{label}: {_fmt(value)}{currency}")
    if receipt.total is not None:
        lines.append(f"💰 <b>Total: {_fmt(receipt.total)}{currency}</b>")
    if receipt.payment_method:
        lines.append(f"💳 {escape(receipt.payment_method)}")
    if receipt.notes:
        lines.append(f"📝 {escape(receipt.notes)}")
    return "\n".join(lines).strip()


def _items_cell(receipt: ReceiptData) -> str:
    parts = []
    for item in receipt.items:
        part = item.name
        if item.quantity is not None:
            part += f" x{_fmt(item.quantity)}"
        if item.amount is not None:
            part += f" = {_fmt(item.amount)}"
        parts.append(part)
    return "; ".join(parts)


def _sender_name(message: dict[str, Any]) -> str:
    user = message.get("from") or {}
    name = " ".join(filter(None, [user.get("first_name"), user.get("last_name")]))
    if username := user.get("username"):
        name = f"{name} (@{username})" if name else f"@{username}"
    return name or "unknown"


def _num(value: float | None) -> float | str:
    return "" if value is None else value


def _fmt(value: float | None) -> str:
    if value is None:
        return ""
    return f"{value:,.0f}" if value == int(value) else f"{value:,.2f}"


def _human_size(size: int) -> str:
    if size < 1024:  # noqa: PLR2004
        return f"{size} B"
    value = size / 1024
    for unit in ("KB", "MB"):
        if value < 1024:  # noqa: PLR2004
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} GB"


def _short_error(exc: Exception) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return f"{exc.request.url.host} returned HTTP {exc.response.status_code}"
    return str(exc)[:200] or type(exc).__name__
