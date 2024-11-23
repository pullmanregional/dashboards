"""
Class to hold app specific user settings
"""

from dataclasses import dataclass
import streamlit as st


@dataclass(eq=True, frozen=True)
class Settings:
    openai_api_key: str = st.secrets["PRH_EXPLORE_OPENAI_API_KEY"]
