import pandas as pd
from dataclasses import dataclass
from . import source_data


@dataclass(eq=True, frozen=True)
class ResidentData:
    encounters_df: pd.DataFrame = None
    notes_inpt_df: pd.DataFrame = None
    notes_ed_df: pd.DataFrame = None


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

    # Transform source data into dashboard specific representation
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

    return AppData(
        all_residents=all_residents,
        residents_by_year=residents_by_year,
        resident_dfs=resident_dfs,
        stats=stats,
    )
