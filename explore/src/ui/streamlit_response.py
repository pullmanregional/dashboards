"""
Custom response parser to display appropriate components in Streamlit based on response type
"""

import streamlit as st
from pandasai.core.response.parser import ResponseParser, BaseResponse


class StreamlitResponseParser(ResponseParser):
    def _generate_response(self, result: dict, last_code_executed: str = None):
        if result["type"] == "plot":
            return BaseResponse(
                result["value"], type="plot", last_code_executed=last_code_executed
            )
        else:
            return super()._generate_response(result, last_code_executed)

    def _validate_response(self, result: dict):
        if "type" in result and result["type"] == "plot":
            return True

        return super()._validate_response(result)
