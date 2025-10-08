from sqlalchemy.orm import registry
from sqlmodel import Field, SQLModel, Relationship
from typing import List, Optional
from datetime import date, datetime


class DatamartModel(SQLModel, registry=registry()):
    pass


class Meta(DatamartModel, table=True):
    __tablename__ = "meta"
    id: int | None = Field(default=None, primary_key=True)
    modified: datetime


class Volume(DatamartModel, table=True):
    __tablename__ = "volumes"
    id: int | None = Field(default=None, primary_key=True)
    dept_wd_id: str = Field(max_length=10)
    dept_name: str | None = None
    month: str = Field(max_length=7)
    volume: int
    unit: str | None = None


class UOS(DatamartModel, table=True):
    __tablename__ = "uos"
    id: int | None = Field(default=None, primary_key=True)
    dept_wd_id: str = Field(max_length=10)
    dept_name: str | None = None
    month: str = Field(max_length=7)
    volume: float
    unit: str | None = None


class Budget(DatamartModel, table=True):
    __tablename__ = "budget"
    id: int | None = Field(default=None, primary_key=True)
    dept_wd_id: str = Field(max_length=10)
    dept_name: str | None = None
    budget_fte: float
    budget_prod_hrs: float
    budget_volume: int
    budget_uos: float
    budget_prod_hrs_per_uos: float
    hourly_rate: float


class Hours(DatamartModel, table=True):
    __tablename__ = "hours"
    id: int | None = Field(default=None, primary_key=True)
    month: str = Field(max_length=7)
    dept_wd_id: str = Field(max_length=10)
    dept_name: str | None = None
    reg_hrs: float
    overtime_hrs: float
    prod_hrs: float
    nonprod_hrs: float
    total_hrs: float
    total_fte: float


class ContractedHours(DatamartModel, table=True):
    __tablename__ = "contracted_hours"
    id: int | None = Field(default=None, primary_key=True)
    dept_wd_id: str = Field(max_length=10)
    dept_name: str | None = None
    year: int
    hrs: float | None = None
    ttl_dept_hrs: float


class IncomeStmt(DatamartModel, table=True):
    __tablename__ = "income_stmt"
    id: int | None = Field(default=None, primary_key=True)
    month: str = Field(max_length=7)
    ledger_acct: str
    dept_wd_id: str = Field(max_length=10)
    dept_name: str | None = None
    spend_category: str | None = None
    revenue_category: str | None = None
    actual: float
    budget: float
    actual_ytd: float
    budget_ytd: float


class BalanceSheet(DatamartModel, table=True):
    __tablename__ = "balance_sheet"
    id: Optional[int] = Field(default=None, primary_key=True)
    month: str = Field(max_length=7)
    tree: str
    line_num: int
    ledger_acct: str
    actual: float | None
    actual_prev_month: float | None
    diff_prev_month: float | None
    actual_prev_year: float | None
    diff_prev_year: float | None


class AgedAR(DatamartModel, table=True):
    __tablename__ = "aged_ar"
    id: int | None = Field(default=None, primary_key=True)
    date: str = Field(max_length=10)
    aged_days: str = Field(max_length=10)
    total: float


class KvTable(DatamartModel, table=True):
    """
    Stores key/value data. This table will contains a single row with a JSON blob
    """

    __tablename__ = "_kv"
    id: int | None = Field(default=None, primary_key=True)
    data: str
