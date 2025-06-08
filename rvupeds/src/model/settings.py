"""
Class to hold app specific user settings
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass(eq=True, frozen=True)
class Settings:
    provider: str
    start_date: datetime
    end_date: datetime
