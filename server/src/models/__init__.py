"""Model registry.

Alembic autogenerate only sees tables whose classes have been imported. Import
every model here and point ``alembic/env.py`` at this package, otherwise a new
model silently produces an empty migration.
"""

from .medicine import Batch, BatchStatus, Product
from .scan import Scan, ScanMethod, VerificationStatus
from .user import User

__all__ = [
    "Batch",
    "BatchStatus",
    "Product",
    "Scan",
    "ScanMethod",
    "User",
    "VerificationStatus",
]
