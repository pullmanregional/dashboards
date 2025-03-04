import sys, os

# Add project root to PYTHONPATH so we can import common modules
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

import pandas as pd
import streamlit as st
import plotly.graph_objects as go
from common import st_util
from ..model import source_data, app_data, settings

def show_settings(
    src_data: source_data.SourceData, right_of_title_space
) -> settings.Settings:
    with right_of_title_space:
        # Convert YYYYMMDD to datetime and get date range
        start_date = pd.to_datetime(
            str(src_data.encounters_df.encounter_date.min()), format="%Y%m%d"
        )
        end_date = pd.to_datetime(
            str(src_data.encounters_df.encounter_date.max()), format="%Y%m%d"
        )

        # Default to current month, or latest date available in data
        default_month = min(pd.Timestamp.now(), end_date).strftime("%b %Y")

        months = pd.date_range(start=start_date, end=end_date, freq="MS").strftime(
            "%b %Y"
        )
        months = months[::-1]

        cols = st.columns([1.5, 1])
        with cols[0]:
            selected_month = st.selectbox(
                "Select Month",
                options=months,
                index=list(months).index(default_month) if default_month in months else 0,
                label_visibility="collapsed",
            )

        with cols[1]:
            # Add a Logout button
            if st.button("Logout"):
                st.logout()
                st.rerun()

    return settings.Settings(selected_month=selected_month)


def show_content(settings: settings.Settings, data: app_data.AppData):

    # Get first and last months to use consistent x-axis across all graphs
    x_min = pd.to_datetime(str(data.first_date), format="%Y%m%d").replace(day=1)
    x_max = pd.to_datetime(str(data.last_date), format="%Y%m%d") + pd.offsets.MonthEnd(
        0
    )

    # For each clinic, create a section with header and graph
    for clinic in data.clinics:
        st.header(clinic)

        # Get data for this clinic and selected month
        selected_month = pd.to_datetime(settings.selected_month)
        month_start = selected_month.strftime('%Y%m%d')
        month_end = (selected_month + pd.offsets.MonthEnd(0)).strftime('%Y%m%d')
        clinic_data = data.encounters_df[
            (data.encounters_df['clinic'] == clinic) & 
            (data.encounters_df['encounter_date'] >= int(month_start)) &
            (data.encounters_df['encounter_date'] <= int(month_end))
        ]
        
        # Get total visits and unique patients for month
        total_visits = len(clinic_data)

        # Display metric
        cols = st.columns(2)
        with cols[0]:
            # Find first visit date for each patient in this clinic
            patient_first_visits = data.encounters_df[data.encounters_df['clinic'] == clinic].groupby('prw_id')['encounter_date'].min()
            
            # Count patients whose first visit was this month
            new_patients = len(clinic_data[
                clinic_data['prw_id'].map(patient_first_visits) >= int(month_start)
            ])
            
            # Calculate percentage
            new_patient_pct = (new_patients / total_visits * 100) if total_visits > 0 else 0
            st_util.st_card(
                f"New Patients ({selected_month.strftime('%b %Y')})", 
                f"{new_patient_pct:.1f}%",
                f"{new_patients} new / {total_visits} total visits"
            )
        
        with cols[1]:
            # Get no shows for this clinic and selected month
            no_show_data = data.no_shows_df[
                (data.no_shows_df['clinic'] == clinic) & 
                (data.no_shows_df['encounter_date'] >= int(month_start)) &
                (data.no_shows_df['encounter_date'] <= int(month_end))
            ]
            
            # Count no shows
            no_shows = len(no_show_data)
            
            # Calculate no show rate
            no_show_rate = (no_shows / total_visits * 100) if total_visits > 0 else 0
            
            st_util.st_card(
                f"No-Show Rate ({selected_month.strftime('%b %Y')})",
                f"{no_show_rate:.1f}%", 
                f"{no_shows} no-shows / {total_visits} total visits"
            )

        with st.expander("By Month", expanded=True):
            # st_util.st_center_text("Volumes", style="font-size: 1.25em; font-weight: bold;")

            # Filter data for this clinic
            clinic_data = data.encounters_df[data.encounters_df["clinic"] == clinic].copy()
            clinic_no_shows = data.no_shows_df[data.no_shows_df["clinic"] == clinic].copy()

            # Convert dates to datetime
            clinic_data["date"] = pd.to_datetime(
                clinic_data["encounter_date"].astype(str), format="%Y%m%d"
            )
            clinic_no_shows["date"] = pd.to_datetime(
                clinic_no_shows["encounter_date"].astype(str), format="%Y%m%d"
            )

            # Find first visit dates
            patient_first_visits = clinic_data.groupby('prw_id')['date'].min()
            clinic_data['is_new'] = clinic_data.apply(
                lambda x: x['date'] == patient_first_visits.get(x['prw_id']), axis=1
            )

            # Group by month
            monthly_data = (
                clinic_data.groupby(clinic_data["date"].dt.strftime("%Y-%m"))
                .agg({
                    'prw_id': 'count',
                    'is_new': 'sum'
                })
                .rename(columns={'prw_id': 'total_visits', 'is_new': 'new_patients'})
                .reset_index()
            )
            monthly_no_shows = (
                clinic_no_shows.groupby(clinic_no_shows["date"].dt.strftime("%Y-%m"))
                .size()
                .reset_index(name="no_shows")
            )
            
            # Merge and prepare final dataframe
            monthly_volumes = monthly_data.merge(
                monthly_no_shows, on="date", how="left"
            ).fillna(0)
            monthly_volumes["date"] = pd.to_datetime(monthly_volumes["date"] + "-01")

            # Calculate percentages
            monthly_volumes["no_show_pct"] = (monthly_volumes["no_shows"] / monthly_volumes["total_visits"] * 100).fillna(0)
            monthly_volumes["new_patient_pct"] = (monthly_volumes["new_patients"] / monthly_volumes["total_visits"] * 100).fillna(0)

            # Create figure with secondary y axis
            fig = go.Figure()

            # Add total visits line
            fig.add_trace(
                go.Scatter(
                    x=monthly_volumes["date"],
                    y=monthly_volumes["total_visits"],
                    name="Total Visits",
                    line=dict(color='rgb(31, 119, 180)', width=2),
                    hovertemplate="%{y:.0f} Total Visits<extra></extra>"
                )
            )

            # Add no shows area
            fig.add_trace(
                go.Scatter(
                    x=monthly_volumes["date"],
                    y=monthly_volumes["no_shows"],
                    name="No Shows",
                    fill='tozeroy',
                    line=dict(color='rgba(255, 65, 54, 0.3)', width=0),
                    customdata=monthly_volumes["no_show_pct"],
                    hovertemplate="%{y:.0f} No Shows (%{customdata:.1f}%)<extra></extra>"
                )
            )

            # Add new patients area
            fig.add_trace(
                go.Scatter(
                    x=monthly_volumes["date"],
                    y=monthly_volumes["new_patients"],
                    name="New Patients",
                    fill='tozeroy',
                    line=dict(color='rgba(44, 160, 44, 0.3)', width=0),
                    customdata=monthly_volumes["new_patient_pct"],
                    hovertemplate="%{y:.0f} New Patients (%{customdata:.1f}%)<extra></extra>"
                )
            )

            fig.update_layout(
                showlegend=True,
                legend=dict(
                    orientation="h",
                    yanchor="bottom",
                    y=1.02,
                    xanchor="right",
                    x=1
                ),
                yaxis_title=None,
                yaxis={"visible": False},
                hovermode="x unified",
                xaxis_range=[x_min, x_max],
                height=250,
                margin=dict(t=30),
                hoverlabel=dict(
                    bgcolor="white",
                    font_size=14,
                ),
                xaxis=dict(
                    hoverformat="<b>%b %Y</b>"
                )
            )

            # Display the graph
            st.plotly_chart(fig, use_container_width=True)
