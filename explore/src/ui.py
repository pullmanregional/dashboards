import os
import streamlit as st
import pandas as pd
from dataclasses import dataclass
from pandasai import SmartDataframe, SmartDatalake
from pandasai.llm.openai import OpenAI
from .model import source_data, app_data
from pandasai.llm import OpenAI
from pandasai.responses.response_parser import ResponseParser


CHARTS_PATH = os.path.join(os.getcwd(), "charts")
pd.options.plotting.backend = "plotly"


@dataclass(eq=True, frozen=True)
class Settings:
    openai_api_key: str = st.secrets["PRH_EXPLORE_OPENAI_API_KEY"]


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


def show_home(src_data: source_data.SourceData):
    # Get sidebar user settings. Settings embedded in the content handled by ui module.
    settings = show_settings(src_data)

    data = app_data.transform(src_data)

    # Show main content
    st_home_page(settings, data)


def show_settings(src_data: source_data.SourceData):
    return Settings()


def st_home_page(settings: Settings, data: app_data.AppData):
    st.title("Data Explorer")

    dataset = st.selectbox(
        "Choose a dataset to explore:",
        ["Patients and Encounters", "Volumes", "Financial"],
        label_visibility="collapsed",
    )

    st.subheader("Analysis")

    # Get the currently active dataframe based on dataset selection
    active_dfs, dataset_prompt = None, ""
    if dataset == "Patients and Encounters":
        dataset_prompt = data.encounters.ai_prompt
        active_dfs = [data.encounters.patients_df, data.encounters.encounters_df]
    elif dataset == "Volumes":
        active_dfs = [
            data.volumes.volumes_df,
            data.volumes.uos_df,
            data.volumes.hours_df,
            data.volumes.contracted_hours_df,
        ]
    else:
        active_dfs = [data.finance.budget_df, data.finance.income_stmt_df]

    # Chat input and clear button in columns
    container = st.container()
    query = container.chat_input(
        "Ask a question, like how many patients were seen in 2023?"
    )
    if query:
        container.chat_message("user").write(query)

        # Prefix our query with custom prompts to help with context
        query = construct_prompt("", dataset_prompt, query)

        try:
            llm = OpenAI(
                api_token=settings.openai_api_key, model="gpt-4o-mini", verbose=True
            )
            tabs = container.tabs(["Result", "Debug"])
            smart_df = SmartDatalake(
                active_dfs,
                config={
                    "llm": llm,
                    "custom_whitelisted_dependencies": ["plotly"],
                    "response_parser": StreamlitResponse.parser_class_factory(tabs[0]),
                },
            )

            with st.spinner("Analyzing..."):
                response = smart_df.chat(query)
                if response is not None:
                    tabs[0].write(response)
                tabs[1].code(smart_df.last_code_generated)

        except Exception as e:
            st.error(f"Error analyzing data: {str(e)}")

    st.container(height=1, border=False)
    with st.expander("Show Full Dataset"):
        if dataset == "Patients and Encounters":
            tabs = st.tabs(["Patients", "Encounters"])
            with tabs[0]:
                st.dataframe(
                    data.encounters.patients_df.pandas_df,
                    column_config={
                        "prw_id": st.column_config.NumberColumn(format="%d")
                    },
                    hide_index=True,
                )
            with tabs[1]:
                st.dataframe(
                    data.encounters.encounters_df.pandas_df,
                    column_config={
                        "prw_id": st.column_config.NumberColumn(format="%d"),
                        "encounter_date": st.column_config.DateColumn(
                            "Date", format="MM/DD/YYYY"
                        ),
                    },
                    hide_index=True,
                )

        elif dataset == "Volumes":
            tabs = st.tabs(["Volumes", "Units of Service", "Hours", "Contracted Hours"])
            with tabs[0]:
                st.dataframe(data.volumes.volumes_df)
            with tabs[1]:
                st.dataframe(data.volumes.uos_df)
            with tabs[2]:
                st.dataframe(data.volumes.hours_df)
            with tabs[3]:
                st.dataframe(data.volumes.contracted_hours_df)

        elif dataset == "Financial":
            tabs = st.tabs(["Budget", "Income Statement"])
            with tabs[0]:
                st.dataframe(data.finance.budget_df)
            with tabs[1]:
                st.dataframe(data.finance.income_stmt_df)


def construct_prompt(global_prompt, dataset_prompt, query):
    if "plot" in query.lower() or "graph" in query.lower() or "chart" in query.lower():
        query = (
            "When creating visualizations, return a plotly object to display in Streamlit. "
            + query
        )
    else:
        query = "Do not try to plot anything or create visualizations. " + query

    query = f"{global_prompt}\n\n{dataset_prompt}\n\n{query}"

    return query
