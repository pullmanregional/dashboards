import pandas as pd
from datetime import datetime
from dataclasses import dataclass
from . import source_data, settings


@dataclass(eq=True, frozen=True)
class AppData:
    data: pd.DataFrame = None
    start_date: datetime = None
    end_date: datetime = None


def process(src_data: source_data.SourceData, settings: settings.Settings) -> AppData:
    # Transform source data into dashboard specific representation
    data = src_data.charges_df

    # Filter data by provider
    if settings.provider != "Select a Provider":
        data = data[data["provider"] == settings.provider]

    return AppData(
        data=data, start_date=src_data.start_date, end_date=src_data.end_date
    )
