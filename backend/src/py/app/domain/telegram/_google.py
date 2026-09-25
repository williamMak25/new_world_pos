"""Google Sheets and Drive over plain REST, authorized as a real Google user.

A service account can't own Drive files (it has no storage quota), so uploads use
an OAuth refresh token for the owner's own account instead.
"""

from __future__ import annotations

import json
import secrets
import time
from typing import TYPE_CHECKING, Any
from urllib.parse import quote

if TYPE_CHECKING:
    import httpx

TOKEN_URL = "https://oauth2.googleapis.com/token"  # noqa: S105
SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"
DRIVE_API = "https://www.googleapis.com/drive/v3/files"
DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files"
SCOPES = (
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets",
)

RECEIPTS_TAB = "Receipts"
FILES_TAB = "Files"
RECEIPT_HEADERS = [
    "Received at",
    "From",
    "Chat ID",
    "Date",
    "Merchant",
    "Category",
    "Items",
    "Subtotal",
    "Tax",
    "Discount",
    "Total",
    "Currency",
    "Payment method",
    "Notes",
    "Original text",
]
FILE_HEADERS = ["Received at", "From", "Chat ID", "File name", "Type", "Size (bytes)", "Caption", "Drive link"]


class GoogleClient:
    def __init__(self, client_id: str, client_secret: str, refresh_token: str, http: httpx.AsyncClient) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._refresh_token = refresh_token
        self._http = http
        self._access_token = ""
        self._expires_at = 0.0

    async def _headers(self) -> dict[str, str]:
        if time.monotonic() >= self._expires_at:
            response = await self._http.post(
                TOKEN_URL,
                data={
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                    "refresh_token": self._refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            response.raise_for_status()
            token = response.json()
            self._access_token = token["access_token"]
            self._expires_at = time.monotonic() + int(token.get("expires_in", 3600)) - 60
        return {"Authorization": f"Bearer {self._access_token}"}

    async def append_row(self, sheet_id: str, tab: str, values: list[Any]) -> None:
        # RAW keeps user text like "=SUM(...)" from being evaluated as a formula.
        response = await self._http.post(
            f"{SHEETS_API}/{sheet_id}/values/{quote(tab)}!A1:append",
            params={"valueInputOption": "RAW", "insertDataOption": "INSERT_ROWS"},
            json={"values": [values]},
            headers=await self._headers(),
        )
        response.raise_for_status()

    async def upload_file(self, folder_id: str, name: str, mime_type: str, data: bytes) -> str:
        """Upload a file into a Drive folder and return its web link."""
        boundary = secrets.token_hex(16)
        metadata = json.dumps({"name": name, "parents": [folder_id]})
        body = b"".join(
            [
                f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}\r\n".encode(),
                f"--{boundary}\r\nContent-Type: {mime_type}\r\n\r\n".encode(),
                data,
                f"\r\n--{boundary}--\r\n".encode(),
            ]
        )
        response = await self._http.post(
            DRIVE_UPLOAD_API,
            params={"uploadType": "multipart", "fields": "id,webViewLink"},
            content=body,
            headers={**await self._headers(), "Content-Type": f"multipart/related; boundary={boundary}"},
        )
        response.raise_for_status()
        return str(response.json()["webViewLink"])

    async def create_folder(self, name: str) -> str:
        response = await self._http.post(
            DRIVE_API,
            json={"name": name, "mimeType": "application/vnd.google-apps.folder"},
            headers=await self._headers(),
        )
        response.raise_for_status()
        return str(response.json()["id"])

    async def create_spreadsheet(self, title: str) -> str:
        """Create a spreadsheet with header rows for the Receipts and Files tabs."""
        response = await self._http.post(
            SHEETS_API,
            json={
                "properties": {"title": title},
                "sheets": [
                    {"properties": {"title": RECEIPTS_TAB, "gridProperties": {"frozenRowCount": 1}}},
                    {"properties": {"title": FILES_TAB, "gridProperties": {"frozenRowCount": 1}}},
                ],
            },
            headers=await self._headers(),
        )
        response.raise_for_status()
        sheet_id = str(response.json()["spreadsheetId"])
        await self.append_row(sheet_id, RECEIPTS_TAB, RECEIPT_HEADERS)
        await self.append_row(sheet_id, FILES_TAB, FILE_HEADERS)
        return sheet_id
