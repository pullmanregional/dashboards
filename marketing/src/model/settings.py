"""
Class to hold app specific user settings
"""

from dataclasses import dataclass

@dataclass(eq=True, frozen=True)
class Settings:
    selected_month: str = ""
