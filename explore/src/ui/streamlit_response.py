"""
Custom response parser to display appropriate components in Streamlit based on response type
"""

import streamlit as st
from pandasai.responses.response_parser import ResponseParser


class StreamlitResponse(ResponseParser):
    
    @staticmethod
    def parser_class_factory(container):
        def factory(context):
            return StreamlitResponse(container, context)

        return factory

    def __init__(self, container, context) -> None:
        super().__init__(context)
        self._container = container if container is not None else st

    def format_dataframe(self, result):
        self._container.dataframe(result["value"])
        return None

    def format_plot(self, result):
        self._container.plotly_chart(result["value"])
        return None

    def format_other(self, result):
        self._container.write(result["value"])
        return None
