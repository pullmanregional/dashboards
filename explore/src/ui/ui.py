"""
Methods to show build streamlit UI
"""

import streamlit as st
import pandasai as pai
from pandasai_openai import OpenAI
from ..model import source_data, app_data, settings


def show_settings(src_data: source_data.SourceData) -> settings.Settings:
    # Get config from Streamlit
    openai_model = st.secrets["openai_model"]
    openai_api_key = st.secrets["PRH_EXPLORE_OPENAI_API_KEY"]

    return settings.Settings(openai_model=openai_model, openai_api_key=openai_api_key)


def show_content(settings: settings.Settings, data: app_data.AppData):
    dataset = st.selectbox(
        "Choose a dataset to explore:",
        ["Patients and Encounters", "Volumes", "Financial"],
    )

    st.subheader("Analysis")

    analysis_tabs = st.tabs(["Analysis", "Full Data"])

    with analysis_tabs[0]:

        # Get the currently active dataframe based on dataset selection
        active_datasets, dataset_prompt = None, ""
        if dataset == "Patients and Encounters":
            dataset_prompt = data.encounters.ai_prompt
            active_datasets = [data.encounters.patients_dataset, data.encounters.encounters_dataset]
        elif dataset == "Volumes":
            active_datasets = [
                data.volumes.volumes_dataset,
                data.volumes.uos_dataset,
                data.volumes.hours_dataset,
                data.volumes.contracted_hours_dataset,
            ]
        else:
            active_datasets = [data.finance.budget_df, data.finance.income_stmt_df]

        # Chat input and clear button in columns
        container = st.container()
        query = container.text_input(
            "Ask a question:",
            placeholder="e.g. How many patients were seen in 2023?",
        )
        if query:
            container.chat_message("user").write(query)

            # Prefix our query with custom prompts to help with context
            query = construct_prompt("", dataset_prompt, query)

            try:
                tabs = container.tabs(["Result", "Debug"])

                with st.spinner("Analyzing..."):
                    response = pai.chat(query, *active_datasets)
                    if response is not None:
                        if response.type == "string":
                            tabs[0].write(response.value)
                        elif response.type == "dataframe":
                            tabs[0].dataframe(response.value)
                        elif response.type == "plot":
                            tabs[0].plotly_chart(response.value)
                        else:
                            tabs[0].write(response)
                    with tabs[1]:
                        st.write("Prompt:")
                        st.code(query, language="text")
                        st.write("Code:")
                        st.code(response.last_code_executed)

            except Exception as e:
                st.error(f"Error analyzing data: {str(e)}")

    with analysis_tabs[1]:
        if dataset == "Patients and Encounters":
            tabs = st.tabs(["Patients", "Encounters"])
            with tabs[0]:
                st.dataframe(
                    data.encounters.patients_dataset,
                    column_config={
                        "prw_id": st.column_config.NumberColumn(format="%d")
                    },
                    hide_index=True,
                )
            with tabs[1]:
                st.dataframe(
                    data.encounters.encounters_dataset,
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
                st.dataframe(
                    data.volumes.volumes_dataset,
                )
            with tabs[1]:
                st.dataframe(
                    data.volumes.uos_dataset,
                )
            with tabs[2]:
                st.dataframe(
                    data.volumes.hours_dataset,
                )
            with tabs[3]:
                st.dataframe(
                    data.volumes.contracted_hours_dataset,
                )

        elif dataset == "Financial":
            tabs = st.tabs(["Budget", "Income Statement"])
            with tabs[0]:
                st.dataframe(
                    data.finance.budget_dataset,
                )
            with tabs[1]:
                st.dataframe(
                    data.finance.income_stmt_dataset,
                )


def construct_prompt(global_prompt, dataset_prompt, query):
    if "plot" in query.lower() or "graph" in query.lower() or "chart" in query.lower():
        query = (
            "When creating visualizations, return a plotly object to display in Streamlit.\n\n"
            + query
        )
    else:
        query = "Do not try to plot anything or create visualizations.\n\n" + query

    query = f"{global_prompt}\n\n{dataset_prompt}\n\n{query}"

    return query
