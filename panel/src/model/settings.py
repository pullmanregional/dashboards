"""
Class to hold app specific user settings
"""

from dataclasses import dataclass
import streamlit as st


@dataclass(eq=True, frozen=True)
class Settings:
    clinic: str
    provider: str
