"""`app telegram ...` setup commands."""

from __future__ import annotations

import secrets
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse

import anyio
import click
import httpx
from rich import get_console

from app.domain.telegram._google import SCOPES, TOKEN_URL, GoogleClient
from app.domain.telegram._telegram import TelegramClient
from app.lib.settings import get_settings

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"


@click.group(name="telegram", invoke_without_command=False, help="Set up the Telegram receipt bot.")
def telegram_group() -> None:
    """Telegram receipt bot commands."""


@telegram_group.command(name="google-auth", help="Log in to Google once and create the Sheet and Drive folder.")
@click.option("--sheet-title", default="Telegram Receipts", show_default=True)
@click.option("--folder-name", default="Telegram Receipts", show_default=True)
def google_auth(sheet_title: str, folder_name: str) -> None:
    """Run the OAuth loopback flow, then print the env vars to set on the server.

    Needs GOOGLE_API_CLIENT_ID and GOOGLE_API_CLIENT_SECRET from a "Desktop app" OAuth client.
    """
    console = get_console()
    settings = get_settings().telegram
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        msg = "Set GOOGLE_API_CLIENT_ID and GOOGLE_API_CLIENT_SECRET first."
        raise click.ClickException(msg)

    code, redirect_uri = _wait_for_auth_code(settings.GOOGLE_CLIENT_ID)
    token = httpx.post(
        TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        },
    ).json()
    refresh_token = token.get("refresh_token")
    if not refresh_token:
        msg = f"Google didn't return a refresh token: {token}"
        raise click.ClickException(msg)

    async def _create() -> tuple[str, str]:
        async with httpx.AsyncClient(timeout=30) as http:
            google = GoogleClient(settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET, refresh_token, http)
            sheet_id = settings.GOOGLE_SHEET_ID or await google.create_spreadsheet(sheet_title)
            folder_id = settings.GOOGLE_DRIVE_FOLDER_ID or await google.create_folder(folder_name)
            return sheet_id, folder_id

    sheet_id, folder_id = anyio.run(_create)
    console.print("\n[green]Done.[/] Set these environment variables on the server:\n")
    console.print(f"GOOGLE_API_REFRESH_TOKEN={refresh_token}", soft_wrap=True)
    console.print(f"GOOGLE_SHEET_ID={sheet_id}")
    console.print(f"GOOGLE_DRIVE_FOLDER_ID={folder_id}")
    console.print(f"\nSheet:  https://docs.google.com/spreadsheets/d/{sheet_id}")
    console.print(f"Folder: https://drive.google.com/drive/folders/{folder_id}")


@telegram_group.command(name="set-webhook", help="Point Telegram at this server's webhook URL.")
@click.option("--base-url", required=True, help="Public backend URL, e.g. https://pos-backend.onrender.com")
def set_webhook(base_url: str) -> None:
    settings = get_settings().telegram
    if not settings.BOT_TOKEN or not settings.WEBHOOK_SECRET:
        msg = "Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first (the same values the server uses)."
        raise click.ClickException(msg)
    url = f"{base_url.rstrip('/')}/api/telegram/webhook"

    async def _set() -> None:
        async with httpx.AsyncClient(timeout=30) as http:
            await TelegramClient(settings.BOT_TOKEN, http).set_webhook(url, settings.WEBHOOK_SECRET)

    anyio.run(_set)
    get_console().print(f"[green]Webhook set:[/] {url}")


def _wait_for_auth_code(client_id: str) -> tuple[str, str]:
    """Open the Google consent page and catch the redirect on a local port."""
    state = secrets.token_urlsafe(16)
    result: dict[str, str] = {}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            query = parse_qs(urlparse(self.path).query)
            if query.get("state", [""])[0] == state and "code" in query:
                result["code"] = query["code"][0]
                body = b"Google login complete. You can close this tab."
            else:
                result["error"] = query.get("error", ["invalid response"])[0]
                body = b"Google login failed. Check the terminal."
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *_: Any) -> None:
            return

    server = HTTPServer(("127.0.0.1", 0), Handler)
    redirect_uri = f"http://127.0.0.1:{server.server_port}"
    url = f"{AUTH_URL}?" + urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
    )
    get_console().print(f"Opening Google login. If no browser opens, visit:\n{url}\n", soft_wrap=True)
    webbrowser.open(url)
    while not result:
        server.handle_request()
    server.server_close()
    if "code" not in result:
        msg = f"Google login failed: {result.get('error')}"
        raise click.ClickException(msg)
    return result["code"], redirect_uri
