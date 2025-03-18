import streamlit as st
import pandas as pd
import plotly.express as px
from common import st_util
from ..model import source_data, app_data
from . import ui


def show(src_data: source_data.SourceData):
    """
    Show department specific Streamlit page
    """
    # Get user settings
    st.title("Patient Panels")
    user_settings = ui.show_settings(src_data)

    # Process the source data by filtering and generating the specifc metrics displayed in the UI
    data = app_data.process(user_settings, src_data)

    # Build UI by section
    st.subheader("Demographics")
    ui.st_patient_stats(data)
    ui.st_demographics(data)

    st.subheader("New Patients")
    ui.st_new_patients(data)

    st.subheader("Paneled Patients")
    with st_util.st_card_container("patient_list_container", padding_css="10px 16px"):
        col1, col2 = st.columns([2, 1], gap="medium")

        with col1:
            st.write("**Patient List**")
            with st.spinner("Loading..."):
                selected_mrn = ui.st_patient_table(data.paneled_patients_df)

        with col2:
            st.write("**Encounters for Selected Patient**")
            ui.st_encounter_table(data.encounters_df, selected_mrn)
