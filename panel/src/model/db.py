from sqlalchemy.orm import registry
from sqlmodel import Field, SQLModel, Relationship
from typing import List, Optional
from datetime import date, datetime


class DatamartModel(SQLModel, registry=registry()):
    pass


class Meta(DatamartModel, table=True):
    __tablename__ = "meta"
    id: Optional[int] = Field(default=None, primary_key=True)
    modified: datetime


class Patient(DatamartModel, table=True):
    __tablename__ = "patients"

    prw_id: int | None = Field(default=None, primary_key=True)
    sex: str = Field(regex="^[MFO]$")
    age: int | None = Field(ge=0)
    age_in_mo_under_3: int | None
    age_display: str | None = None
    location: str | None = None
    pcp: str | None = None
    panel_location: str | None = None
    panel_provider: str | None = None

    encounters: List["Encounter"] = Relationship(back_populates="patient")


class Encounter(DatamartModel, table=True):
    __tablename__ = "encounters"

    id: int | None = Field(default=None, primary_key=True)
    prw_id: int = Field(foreign_key="patients.prw_id")
    location: str
    encounter_date: date
    encounter_age: int | None
    encounter_age_in_mo_under_3: int | None
    encounter_type: str
    service_provider: str | None = None
    with_pcp: bool | None = None
    diagnoses: str | None = None
    level_of_service: str | None = None

    patient: Patient | None = Relationship(back_populates="encounters")
