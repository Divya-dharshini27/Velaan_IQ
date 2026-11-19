from decimal import Decimal
from bson.decimal128 import Decimal128


def to_d128(value: Decimal) -> Decimal128:
    return Decimal128(value)


def from_d128(value) -> Decimal:
    if isinstance(value, Decimal128):
        return value.to_decimal()
    return Decimal(str(value))