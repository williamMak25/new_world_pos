from __future__ import annotations

from enum import StrEnum


class SaleStatus(StrEnum):
    """Lifecycle status of a sale."""

    COMPLETED = "COMPLETED"
    REFUNDED = "REFUNDED"
    VOIDED = "VOIDED"


class PaymentMethod(StrEnum):
    """Supported payment methods for a sale."""

    CASH = "CASH"
    CARD = "CARD"
    MOBILE = "MOBILE"
    OTHER = "OTHER"
