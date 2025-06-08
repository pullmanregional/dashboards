import pandas as pd
from dataclasses import dataclass
from . import source_data


@dataclass(eq=True, frozen=True)
class AppData:
    data: pd.DataFrame = None
    stats: dict = None


def process(src_data: source_data.SourceData) -> AppData:
    src_df, src_kvdata = src_data.charges_df, src_data.kvdata

    # Transform source data into dashboard specific representation
    data = src_df
    stats = src_kvdata

    return AppData(data=data, stats=stats)
