"""Sale (checkout) schemas."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.db.models._sale_status import PaymentMethod, SaleStatus
from app.lib.schema import CamelizedBaseStruct


class SaleItem(CamelizedBaseStruct):
    id: UUID
    product_name: str
    unit_price: Decimal
    quantity: int
    line_total: Decimal
    product_id: UUID | None = None
    sku: str | None = None



class Payment(CamelizedBaseStruct):
    id: UUID
    method: str
    amount: Decimal
    reference: str | None = None


class Sale(CamelizedBaseStruct):
    id: UUID
    store_id: UUID

    sale_number: str
    status: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total: Decimal
    created_at: datetime
    items: list[SaleItem] = []
    payments: list[Payment] = []
    cashier_id: UUID | None = None
    customer_id: UUID | None = None
    notes: str | None = None



class CheckoutItem(CamelizedBaseStruct):
    """A single line in the cart at checkout time."""

    product_id: UUID
    quantity: int
    unit_price: Decimal | None = None
    """Optional price override for this line (e.g. manual discount). Defaults to the product's current price."""


class CheckoutPayment(CamelizedBaseStruct):
    amount: Decimal
    method: PaymentMethod = PaymentMethod.CASH
    reference: str | None = None


class CheckoutRequest(CamelizedBaseStruct):
    """Submit a cart and payment(s) to complete a sale."""

    items: list[CheckoutItem]
    payments: list[CheckoutPayment]
    discount_amount: Decimal = Decimal(0)
    notes: str | None = None
    customer_id: UUID | None = None


class VoidSaleRequest(CamelizedBaseStruct):
    reason: str | None = None


class SaleStatusUpdate(CamelizedBaseStruct):
    status: SaleStatus
