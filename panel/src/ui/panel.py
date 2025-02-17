import streamlit as st
from ..model import source_data, app_data
from . import ui


def show(src_data: source_data.SourceData):
    """
    Show department specific Streamlit page
    """
    # Get sidebar settings
    user_settings = ui.show_settings(src_data)

    # Process the source data by filtering and generating the specifc metrics displayed in the UI
    data = app_data.process(user_settings, src_data)

    ui.st_patient_details(data.paneled_patients_df)

    st.write("## Patient List")
    selected_mrn = ui.st_patient_table(data.paneled_patients_df)

    st.write("## Encounters")
    ui.st_encounter_table(data.encounters_df, selected_mrn)
