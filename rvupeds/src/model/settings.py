"""
Class to hold app specific user settings
"""

from dataclasses import dataclass
import datetime as dt


@dataclass(eq=True, frozen=True)
class Settings:
    provider: str
    start_date: dt.date
    end_date: dt.date
    compare_start_date: dt.date
    compare_end_date: dt.date
