"""Turn free-form receipt text into structured fields with Claude."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

if TYPE_CHECKING:
    import anthropic

SYSTEM_PROMPT = """\
You read receipts, invoices and expense notes that people type or paste into a chat, and \
extract them into structured fields for a spreadsheet.

- The text may be in any language (often English or Burmese); keep names as written, but \
write `category` and `notes` in English.
- Use numbers only for money fields (no currency symbols or thousands separators). Leave a \
field null when the text doesn't say it - never guess amounts.
- `date` is ISO format (YYYY-MM-DD). If the text has no date, leave it null.
- `currency` is an ISO 4217 code (e.g. MMK, USD, THB) when stated or clearly implied.
- `category` is a short expense category such as Food, Transport, Groceries, Utilities, \
Office, Inventory, Other.
- Set `is_receipt` to false when the message isn't about a purchase, payment or expense, \
and briefly say what it is in `notes`."""


class ReceiptItem(BaseModel):
    name: str
    quantity: float | None = None
    unit_price: float | None = None
    amount: float | None = None


class ReceiptData(BaseModel):
    is_receipt: bool
    date: str | None = Field(default=None, description="YYYY-MM-DD")
    merchant: str | None = None
    category: str | None = None
    items: list[ReceiptItem] = Field(default_factory=list)
    subtotal: float | None = None
    tax: float | None = None
    discount: float | None = None
    total: float | None = None
    currency: str | None = None
    payment_method: str | None = None
    notes: str | None = None


class ExtractionError(Exception):
    """Raised when Claude doesn't return usable fields."""


async def extract_receipt(client: anthropic.AsyncAnthropic, model: str, text: str) -> ReceiptData:
    response = await client.messages.parse(
        model=model,
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Today is {datetime.now(UTC).date().isoformat()}.\n\n<message>\n{text}\n</message>",
            }
        ],
        output_format=ReceiptData,
    )
    if response.stop_reason == "refusal" or response.parsed_output is None:
        msg = f"model stopped with {response.stop_reason}"
        raise ExtractionError(msg)
    return response.parsed_output
