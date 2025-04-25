import pandas as pd
from dataclasses import dataclass
from . import source_data


@dataclass(eq=True)
class ResidentData:
    encounters_df: pd.DataFrame = None
    notes_inpt_df: pd.DataFrame = None
    notes_ed_df: pd.DataFrame = None

    num_encounters_by_date_and_type: pd.DataFrame = None


@dataclass(eq=True, frozen=True)
class AppData:
    all_residents: list = None
    residents_by_year: dict = None

    resident_dfs: dict[str, ResidentData] = None

    stats: dict[str, dict] = None


def process(src_data: source_data.SourceData) -> AppData:
    src_encounters_df, src_notes_df = src_data.encounters_df, src_data.notes_df
    residents_by_year = src_data.kvdata["residents"]

    all_residents = [r for residents in residents_by_year.values() for r in residents]
    stats = src_data.kvdata["stats"]

    # Get all encounters and notes
    all_encounters_df = src_encounters_df[
        src_encounters_df["service_provider"].isin(all_residents)
    ]
    all_notes_inpt_df = src_notes_df[
        (src_notes_df["resident"].isin(all_residents)) & (src_notes_df["ed"] == False)
    ]
    all_notes_ed_df = src_notes_df[
        (src_notes_df["resident"].isin(all_residents)) & (src_notes_df["ed"] == True)
    ]
    all_dfs = ResidentData(
        encounters_df=all_encounters_df,
        notes_inpt_df=all_notes_inpt_df,
        notes_ed_df=all_notes_ed_df,
    )

    # Filter encounters/notes for each resident
    resident_dfs = {}
    for resident in all_residents:
        # Filter encounters and notes where the resident is the provider
        encounters_df = src_encounters_df[
            src_encounters_df["service_provider"] == resident
        ]
        notes_inpt_df = src_notes_df[
            (src_notes_df["resident"] == resident) & (src_notes_df["ed"] == False)
        ]
        notes_ed_df = src_notes_df[
            (src_notes_df["resident"] == resident) & (src_notes_df["ed"] == True)
        ]

        # Store the filtered dataframes in the dictionary
        resident_dfs[resident] = ResidentData(
            encounters_df=encounters_df,
            notes_inpt_df=notes_inpt_df,
            notes_ed_df=notes_ed_df,
        )

    # For each resident, calculate the number of clinic visits from encounters_df
    # and count the number of ED and inpatient notes from notes_*_df
    # for each date and store in DF to graph later. Store counts as separate columns.
    for resident, data in resident_dfs.items():
        # Convert dates to date only
        encounter_dates = data.encounters_df["encounter_date"].dt.date
        inpt_dates = data.notes_inpt_df["service_date"].dt.date
        ed_dates = data.notes_ed_df["service_date"].dt.date

        # Count by date
        clinic_counts = encounter_dates.value_counts().reset_index()
        clinic_counts.columns = ["Date", "Clinic"]

        inpt_counts = inpt_dates.value_counts().reset_index()
        inpt_counts.columns = ["Date", "Inpatient"]

        ed_counts = ed_dates.value_counts().reset_index()
        ed_counts.columns = ["Date", "ED"]

        # Combine the counts into a single dataframe, merging by date
        counts = pd.merge(clinic_counts, inpt_counts, on="Date", how="outer")
        counts = pd.merge(counts, ed_counts, on="Date", how="outer")
        counts = counts.fillna(0)

        # Sort by date
        counts["Date"] = pd.to_datetime(counts["Date"])
        counts = counts.sort_values(by="Date")

        resident_dfs[resident].num_encounters_by_date_and_type = counts

    return AppData(
        all_residents=all_residents,
        residents_by_year=residents_by_year,
        resident_dfs=resident_dfs,
        stats=stats,
    )
