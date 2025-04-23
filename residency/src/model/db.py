from sqlalchemy.orm import registry
from sqlmodel import Field, SQLModel
from typing import Optional
from datetime import datetime


class DatamartModel(SQLModel, registry=registry()):
    pass


class Meta(DatamartModel, table=True):
    __tablename__ = "meta"
    id: Optional[int] = Field(default=None, primary_key=True)
    modified: datetime


class DataTable(DatamartModel, table=True):
    __tablename__ = "data"
    id: int | None = Field(default=None, primary_key=True)
