"""
Class to hold app specific user settings
"""

from dataclasses import dataclass

@dataclass(eq=True, frozen=True)
class Settings:
    openai_model: str = None
    openai_api_key: str = None
