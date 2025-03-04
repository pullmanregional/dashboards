import pandas as pd
from dataclasses import dataclass
from . import source_data


@dataclass(eq=True, frozen=True)
class AppData:
    encounters_df: pd.DataFrame = None
    patients_df: pd.DataFrame = None


def process(src_data: source_data.SourceData) -> AppData:
    encounters_df = src_data.encounters_df
    patients_df = src_data.patients_df

    # Transform source data into dashboard specific representation
    return AppData(encounters_df=encounters_df, patients_df=patients_df)
