"""Telegram webhook endpoint."""

from __future__ import annotations

import hmac
from typing import Any

from litestar import Controller, Request, post
from litestar.background_tasks import BackgroundTask
from litestar.exceptions import NotAuthorizedException, NotFoundException
from litestar.response import Response

from app.domain.telegram._pipeline import process_update
from app.lib.settings import get_settings


class TelegramController(Controller):
    """Receives updates from the Telegram Bot API."""

    tags = ["Telegram"]

    @post(
        operation_id="TelegramWebhook",
        name="telegram:webhook",
        path="/api/telegram/webhook",
        summary="Telegram Bot Webhook",
        exclude_from_auth=True,
        security=[],  # Authenticated by Telegram's secret token header instead
        status_code=200,
    )
    async def webhook(self, request: Request[Any, Any, Any], data: dict[str, Any]) -> Response[dict[str, bool]]:
        """Acknowledge the update right away and process it in the background.

        Telegram re-sends an update if it doesn't get a 2xx quickly, so the slow part
        (Claude, Drive upload, Sheets) runs after the response is sent.

        Raises:
            NotFoundException: The bot isn't configured.
            NotAuthorizedException: The secret token header is missing or wrong.

        Returns:
            An empty acknowledgement.
        """
        settings = get_settings().telegram
        if not settings.enabled or not settings.WEBHOOK_SECRET:
            raise NotFoundException
        received = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if not hmac.compare_digest(received, settings.WEBHOOK_SECRET):
            raise NotAuthorizedException
        return Response({"ok": True}, background=BackgroundTask(process_update, data))
