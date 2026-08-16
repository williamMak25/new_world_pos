"""POS domain controllers (auto-discovered by app.utils.domain.DomainPlugin)."""

from app.domain.pos.controllers._categories import CategoryController
from app.domain.pos.controllers._customers import CustomerController
from app.domain.pos.controllers._inventory import InventoryController
from app.domain.pos.controllers._products import ProductController
from app.domain.pos.controllers._reports import ReportController
from app.domain.pos.controllers._sales import SaleController
from app.domain.pos.controllers._stores import StoreController

__all__ = (
    "CategoryController",
    "CustomerController",
    "InventoryController",
    "ProductController",
    "ReportController",
    "SaleController",
    "StoreController",
)
