"""Shared schema base.

The mobile client speaks camelCase (`batchNumber`), Python speaks snake_case
(`batch_number`). Rather than renaming one side and living with the mismatch,
every schema derives from ``CamelModel``: Pydantic serialises responses using
the camelCase alias and accepts *either* spelling on input.

This is what lets `openapi-typescript` generate client types that match the app
exactly, with no hand-maintained mapping layer in between.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        # Accept snake_case too, so internal callers and tests are not forced
        # to use the wire spelling.
        populate_by_name=True,
        # Allows building a response straight from a SQLAlchemy row.
        from_attributes=True,
        # Reject unexpected keys instead of ignoring them: a client sending
        # `batch_no` should get a clear 422, not a silently empty field.
        extra="forbid",
        str_strip_whitespace=True,
    )


class Coordinates(CamelModel):
    latitude: float
    longitude: float
