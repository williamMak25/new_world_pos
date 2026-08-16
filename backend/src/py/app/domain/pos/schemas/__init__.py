"""POS domain schemas."""

from app.domain.pos.schemas._category import Category, CategoryCreate, CategoryUpdate
from app.domain.pos.schemas._customer import Customer, CustomerCreate, CustomerUpdate
from app.domain.pos.schemas._inventory import Inventory, InventoryAdjust, InventorySet
from app.domain.pos.schemas._product import Product, ProductCreate, ProductUpdate
from app.domain.pos.schemas._report import LowStockItem, SalesBreakdownRow, SalesSummary, StoreDashboard, TopProduct
from app.domain.pos.schemas._sale import (
    CheckoutItem,
    CheckoutPayment,
    CheckoutRequest,
    Payment,
    Sale,
    SaleItem,
    SaleStatusUpdate,
    VoidSaleRequest,
)
from app.domain.pos.schemas._store import Store, StoreCreate, StoreUpdate

__all__ = (
    "Category",
    "CategoryCreate",
    "CategoryUpdate",
    "CheckoutItem",
    "CheckoutPayment",
    "CheckoutRequest",
    "Customer",
    "CustomerCreate",
    "CustomerUpdate",
    "Inventory",
    "InventoryAdjust",
    "InventorySet",
    "LowStockItem",
    "Payment",
    "Product",
    "ProductCreate",
    "ProductUpdate",
    "Sale",
    "SaleItem",
    "SaleStatusUpdate",
    "SalesBreakdownRow",
    "SalesSummary",
    "Store",
    "StoreCreate",
    "StoreDashboard",
    "StoreUpdate",
    "TopProduct",
    "VoidSaleRequest",
)
