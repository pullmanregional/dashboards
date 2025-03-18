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


class Patient(DatamartModel, table=True):
    __tablename__ = "patients"

    id: int | None = Field(default=None, primary_key=True)
    prw_id: str = Field(
        unique=True,
        index=True,
        max_length=24,
    )
    sex: str = Field(regex="^[MFO]$")
    age: int | None = Field(ge=0)
    age_in_mo_under_3: int | None
    age_display: str | None = None
    location: str | None = None
    pcp: str | None = None
    panel_location: str | None = None
    panel_provider: str | None = None


class Encounter(DatamartModel, table=True):
    __tablename__ = "encounters"

    id: int | None = Field(default=None, primary_key=True)
    prw_id: str = Field(
        index=True,
        max_length=24,
    )
    location: str
    encounter_date: date
    encounter_age: int | None
    encounter_age_in_mo_under_3: int | None
    encounter_type: str
    service_provider: str | None = None
    with_pcp: bool | None = None
    diagnoses: str | None = None
    level_of_service: str | None = None


class MonthlyVolumeByLocation(DatamartModel, table=True):
    __tablename__ = "monthly_volume_by_location"

    id: int | None = Field(default=None, primary_key=True)
    year_month: str
    location: str
    visit_count: int


class MonthlyVolumeByPanelLocation(DatamartModel, table=True):
    __tablename__ = "monthly_volume_by_panel_location"

    id: int | None = Field(default=None, primary_key=True)
    year_month: str
    panel_location: str
    visit_count: int


class MonthlyVolumeByPanelProvider(DatamartModel, table=True):
    __tablename__ = "monthly_volume_by_panel_provider"  

    id: int | None = Field(default=None, primary_key=True)
    year_month: str
    panel_provider: str
    visit_count: int
