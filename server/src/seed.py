"""Seeds the catalogue and register with data you can scan against.

    python -m src.seed

Idempotent, so it is safe to re-run. The GTINs are real, check-digit-valid
GTIN-13s; the product names attached to them are invented, so do not treat this
as reference data.
"""

import asyncio
import logging
from datetime import date

from sqlalchemy import select

from .core.db import AsyncSessionLocal
from .core.logging import configure_logging
from .models.medicine import Batch, BatchStatus, Product

log = logging.getLogger("api.seed")

PRODUCTS = [
    {
        "gtin": "05000158103054",
        "name": "Panadol",
        "salt": "Paracetamol",
        "dose": "500mg",
    },
    {
        "gtin": "08901030865275",
        "name": "Crocin Advance",
        "salt": "Paracetamol",
        "dose": "500mg",
    },
]

# batch_number -> (gtin or None, status, mfd, exp)
BATCHES = [
    ("49302", "05000158103054", BatchStatus.SAFE, date(2025, 6, 1), date(2026, 12, 31)),
    ("ABC-123", "05000158103054", BatchStatus.SAFE, date(2025, 1, 15), date(2027, 1, 31)),
    ("LOT9", "08901030865275", BatchStatus.SAFE, date(2024, 11, 1), date(2026, 10, 31)),
    ("FAKE-999", None, BatchStatus.UNSAFE, None, None),
]


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        by_gtin: dict[str, Product] = {}

        for spec in PRODUCTS:
            product = await db.scalar(select(Product).where(Product.gtin == spec["gtin"]))
            if product is None:
                product = Product(**spec)
                db.add(product)
                log.info("product created", extra={"gtin": spec["gtin"]})
            else:
                product.name = spec["name"]
                product.salt = spec["salt"]
                product.dose = spec["dose"]
            by_gtin[spec["gtin"]] = product

        await db.flush()

        for number, gtin, status, mfd, exp in BATCHES:
            batch = await db.scalar(select(Batch).where(Batch.batch_number == number))
            product = by_gtin.get(gtin) if gtin else None
            if batch is None:
                db.add(
                    Batch(
                        batch_number=number,
                        product_id=product.id if product else None,
                        status=status,
                        mfd_date=mfd,
                        exp_date=exp,
                    )
                )
                log.info("batch created", extra={"batch_number": number})
            else:
                batch.status = status
                batch.product_id = product.id if product else None
                batch.mfd_date = mfd
                batch.exp_date = exp

        await db.commit()
        log.info("seed complete")


if __name__ == "__main__":
    configure_logging()
    asyncio.run(seed())
