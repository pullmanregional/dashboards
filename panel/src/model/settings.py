"""
Class to hold app specific user settings
"""

from dataclasses import dataclass
import streamlit as st


@dataclass(eq=True)
class Settings:
    clinic: str
    provider: str
    patient_list_type: str = None
