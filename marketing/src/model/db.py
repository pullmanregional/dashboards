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
    prw_id: str = Field(index=True, max_length=24)
    dept: str
    encounter_date: int = Field(
        description="An int in the format YYYYMMDD representing the encounter date"
    )
    encounter_age: int
    encounter_type: str

class NoShows(DatamartModel, table=True):
    __tablename__ = "no_shows"
    id: int | None = Field(default=None, primary_key=True)
    prw_id: str = Field(index=True, max_length=24)
    dept: str
    encounter_date: int = Field(
        description="An int in the format YYYYMMDD representing the encounter date"
    )
    encounter_type: str


class Patients(DatamartModel, table=True):
    __tablename__ = "patients"
    id: int | None = Field(default=None, primary_key=True)
    prw_id: str = Field(unique=True, index=True, max_length=24)
    age: int | None = Field(description="Age in years")
