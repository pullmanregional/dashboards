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


class Encounters(DatamartModel, table=True):
    __tablename__ = "encounters"
    id: int | None = Field(default=None, primary_key=True)
    prw_id: str | None = None
    dept: str | None = None
    academic_year: int | None = None
    encounter_date: datetime | None = None
    encounter_age: int | None = None
    encounter_type: str | None = None
    service_provider: str | None = None
    with_pcp: bool | None = None
    diagnoses: str | None = None
    level_of_service: str | None = None


class Notes(DatamartModel, table=True):
    __tablename__ = "notes"
    id: int | None = Field(default=None, primary_key=True)
    prw_id: str | None = None
    academic_year: int | None = None
    service_date: datetime | None = None
    encounter_age: int | None = None
    dept: str | None = None
    service: str | None = None
    ed: bool = False
    note_type: str | None = None
    initial_author: str | None = None
    signing_author: str | None = None
    cosign_author: str | None = None
    resident: str | None = None
    diagnosis: str | None = None
    peds: bool = False


class KvTable(DatamartModel, table=True):
    """
    Stores key/value data. This table will contains a single row with a JSON blob
    """

    __tablename__ = "_kv"
    id: int | None = Field(default=None, primary_key=True)
    data: str
