from sqlalchemy.orm import registry
from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime, date as date_type


class DatamartModel(SQLModel, registry=registry()):
    pass


class Meta(DatamartModel, table=True):
    __tablename__ = "meta"
    id: Optional[int] = Field(default=None, primary_key=True)
    modified: datetime


class Charges(DatamartModel, table=True):
    __tablename__ = "charges"

    id: Optional[int] = Field(default=None, primary_key=True)
    prw_id: str | None = None
    date: date_type = Field(index=True)
    posted_date: date_type
    provider: str = Field(index=True)
    cpt: str = Field(index=True)
    modifiers: str | None = None
    cpt_desc: str
    quantity: int
    wrvu: float
    reversal_reason: str | None = None
    insurance_class: str | None = Field(index=True)
    location: str

    # Calculated columns
    month: str | None
    quarter: str | None
    posted_month: str | None
    posted_quarter: str | None
    medicaid: bool | None
    inpatient: bool | None


class KvTable(DatamartModel, table=True):
    """
    Stores key/value data. This table will contains a single row with a JSON blob
    """

    __tablename__ = "_kv"
    id: int | None = Field(default=None, primary_key=True)
    data: str
