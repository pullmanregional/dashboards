import os
import streamlit as st
import pandas as pd
from dataclasses import dataclass
from pandasai import SmartDataframe, SmartDatalake
from pandasai.llm.openai import OpenAI
from . import source_data, app_data

CHARTS_PATH = os.path.join(os.getcwd(), "charts")
pd.options.plotting.backend = "plotly"

@dataclass(eq=True, frozen=True)
class Settings:
    openai_api_key: str = st.secrets["PRH_EXPLORE_OPENAI_API_KEY"]

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
    )
    
    # Create two columns - one for data display and one for chat
    chat_col, data_col = st.columns([0.4, 0.6])
    
    with data_col:
        st.subheader("Data")
        if dataset == "Patients and Encounters":
            tabs = st.tabs(["Patients", "Encounters"])
            with tabs[0]:
                st.dataframe(data.encounters.patients_df, column_config={"prw_id": st.column_config.NumberColumn(format="%d")}, hide_index=True)
            with tabs[1]:
                st.dataframe(data.encounters.encounters_df, column_config={
                    "prw_id": st.column_config.NumberColumn(format="%d"),
                    "encounter_date": st.column_config.DateColumn("Date", format="MM/DD/YYYY")
                }, hide_index=True)
        
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

    with chat_col:
        st.subheader("Analysis")
        
        # Get the currently active dataframe based on dataset selection
        active_dfs, ai_prompt = None, None  
        if dataset == "Patients and Encounters":
            ai_prompt = data.encounters.ai_prompt
            active_dfs = [data.encounters.patients_df, data.encounters.encounters_df]
        elif dataset == "Volumes": 
            active_dfs = [data.volumes.volumes_df, data.volumes.uos_df, data.volumes.hours_df, data.volumes.contracted_hours_df]
        else:
            active_dfs = [data.finance.budget_df, data.finance.income_stmt_df]

        # Chat input and clear button in columns
        user_question = st.chat_input("Ask a question, like how many patients were seen in 2023?")

        # Clear chat messages
        if user_question:
            st.chat_message("user").write(user_question)
            
            try:
                llm = OpenAI(api_token=settings.openai_api_key, model="gpt-4o-mini", verbose=True)
                smart_df = SmartDatalake(active_dfs, config={"llm": llm, "save_charts": True, "save_charts_path": CHARTS_PATH, "prompt": ai_prompt})
                
                with st.spinner("Analyzing..."):
                    # SmartDatalake chat can return text responses, pandas DataFrames,
                    # or matplotlib/plotly figures depending on the query
                    response = smart_df.chat(user_question)
                    
                    # Regular text response
                    st.chat_message("assistant").write(response)
            
            except Exception as e:
                st.error(f"Error analyzing data: {str(e)}")
            