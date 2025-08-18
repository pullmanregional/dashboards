import pandas as pd
import datetime as dt
import re
from dataclasses import dataclass
from . import source_data, settings

# Regex matching outpatient procedure CPT codes
RE_PROCEDURE_CODES = "54150|41010|120[01][1-8]"


@dataclass(eq=True, frozen=True)
class AppData:
    # Data set for this provider and date range
    df: pd.DataFrame
    # Specific partitions such as inpatient encounters, WCC, etc
    partitions: dict[str, pd.DataFrame]
    # Precalculated stats, e.g. # encounters, total RVUs, etc
    stats: dict[str, any]

    provider: str
    start_date: dt.date
    end_date: dt.date


def process(
    src_data: source_data.SourceData,
    provider: str,
    start_date: dt.date,
    end_date: dt.date,
) -> AppData:
    """
    Transform source data into dashboard specific representation
    """

    df = src_data.charges_df

    # Filter charges for this provider
    if provider != "Select a Provider":
        df = df[df["provider"] == provider]

    # Filter data by given start and end dates for either including transactions with visit date or posting date in range
    service_dt = df["date"].dt.date
    post_dt = df["posted_date"].dt.date
    if start_date and end_date:
        day_after_end_date = end_date + pd.Timedelta(days=1)
        df = df[
            ((service_dt >= start_date) & (service_dt < day_after_end_date))
            | ((post_dt >= start_date) & (post_dt < day_after_end_date))
        ]
    elif start_date:
        df = df[(service_dt >= start_date) | (post_dt >= start_date)]
    elif end_date:
        day_after_end_date = end_date + pd.Timedelta(days=1)
        df = df[(service_dt < day_after_end_date) | (post_dt < day_after_end_date)]

    # Parition data for viewing and calculate stats
    partitions = _calc_partitions(df)
    stats = _calc_stats(df, partitions)

    return AppData(
        df=df,
        partitions=partitions,
        stats=stats,
        provider=provider,
        start_date=start_date,
        end_date=end_date,
    )


def _calc_partitions(df: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Partition data into sets meaningful to a user and used for calculating statistics later"""
    partitions = {}

    # Office encounters - only keep rows that match one of these CPT codes
    r_wcc = re.compile("993[89][1-5]")
    r_sick = re.compile(f"992[01][1-5]|9949[56]|{RE_PROCEDURE_CODES}")
    df_outpt_all = df.loc[~df.inpatient]
    df_outpt_encs = df.loc[
        df.cpt.apply(lambda cpt: bool(r_wcc.match(cpt) or r_sick.match(cpt)))
    ]
    partitions["outpt_all"] = df_outpt_all
    partitions["outpt_encs"] = df_outpt_encs
    partitions["outpt_not_encs"] = df_outpt_all.loc[
        ~df_outpt_all.index.isin(df_outpt_encs.index)
    ]
    partitions["wcc_encs"] = df.loc[
        (~df.inpatient) & df.cpt.apply(lambda cpt: bool(r_wcc.match(cpt)))
    ]
    partitions["sick_encs"] = df.loc[
        (~df.inpatient) & df.cpt.apply(lambda cpt: bool(r_sick.match(cpt)))
    ]
    partitions["outpt_medicaid_encs"] = df_outpt_encs.loc[df_outpt_encs.medicaid]

    # Aggregate wRVUs for non-encounter charges by CPT code. We use groupby().agg() to
    # sum wrvu column. Retain cpt and desc by using the keys "cpt", "cpt_desc" in agg() as the groupby key.
    # Provide count of how many rows were grouped by counting the any column (we chose provider).
    groupby_cpt = partitions["outpt_not_encs"].groupby(["cpt"], as_index=False)
    outpt_non_enc_wrvus = groupby_cpt.agg(
        {"cpt_desc": "first", "wrvu": "sum", "provider": "count"}
    ).reset_index(drop=True)
    outpt_non_enc_wrvus.columns = ["CPT", "Description", "wRVUs", "n"]
    outpt_non_enc_wrvus = outpt_non_enc_wrvus[outpt_non_enc_wrvus.wRVUs > 0]
    outpt_non_enc_wrvus.sort_values("wRVUs", ascending=False, inplace=True)
    outpt_non_enc_wrvus.Description = outpt_non_enc_wrvus.Description.apply(
        lambda x: x[:42] + "..." if len(x) > 45 else x
    )
    partitions["outpt_non_enc_wrvus"] = outpt_non_enc_wrvus

    # Hospital charges - filter by service location and CPT codes
    inpt_codes = "9946[023]|9923[89]"  # newborn attendance, resusc, admit, progress, d/c, same day
    inpt_codes += "|992[23][1-3]"  # inpatient admit, progress
    inpt_codes += "|9947[7-9]|99480"  # intensive care
    inpt_codes += "|99291"  # transfer or critical care (not additional time code 99292)
    inpt_codes += "|9925[3-5]"  # inpatient consult
    inpt_codes += "|9921[89]|9922[1-6]|9923[1-9]"  # peds admit, progress, d/c
    r_inpt = re.compile(inpt_codes)
    df_inpt_encs = df.loc[
        df.inpatient & df.cpt.apply(lambda cpt: bool(r_inpt.match(cpt)))
    ]
    partitions["inpt_all"] = df.loc[df.inpatient]
    partitions["inpt_encs"] = df_inpt_encs

    df_all_encs = pd.concat([df_outpt_encs, df_inpt_encs])
    partitions["all_encs"] = df_all_encs

    return partitions


def _calc_stats(
    df: pd.DataFrame, partitions: dict[str, pd.DataFrame]
) -> dict[str, any]:
    """Calculate basic statistics from pre-partitioned list of charges"""
    stats = {}

    # Global stats
    stats["start_date"] = df.date.min().date()
    stats["end_date"] = df.date.max().date()
    stats["ttl_wrvu"] = df.wrvu.sum()

    # group rows by date and MRN since we can only see each pt once per day, and count number of rows
    stats["ttl_encs"] = len(partitions["all_encs"].groupby(["date", "prw_id"]))
    stats["wrvu_per_encs"] = (
        stats["ttl_wrvu"] / stats["ttl_encs"] if stats["ttl_encs"] > 0 else 0
    )

    # Count of various outpt codes: 99211-99215, TCM, and procedure codes
    cptstr = df.cpt.str
    stats["ttl_lvl1"] = df[cptstr.match("992[01]1")].quantity.sum()
    stats["ttl_lvl2"] = df[cptstr.match("992[01]2")].quantity.sum()
    stats["ttl_lvl3"] = df[cptstr.match("992[01]3")].quantity.sum()
    stats["ttl_lvl4"] = df[cptstr.match("992[01]4")].quantity.sum()
    stats["ttl_lvl5"] = df[cptstr.match("992[01]5")].quantity.sum()
    stats["ttl_tcm"] = df[cptstr.match("9949[56]")].quantity.sum()
    stats["ttl_procedures"] = df[cptstr.match(RE_PROCEDURE_CODES)].quantity.sum()
    stats["sick_num_pts"] = len(partitions["sick_encs"].groupby(["date", "prw_id"]))
    stats["sick_ttl_wrvu"] = partitions["sick_encs"].wrvu.sum()

    # Counts of WCCs
    stats["ttl_wccinfant"] = len(df[cptstr.match("993[89]1")])
    stats["ttl_wcc1to4"] = len(df[cptstr.match("993[89]2")])
    stats["ttl_wcc5to11"] = len(df[cptstr.match("993[89]3")])
    stats["ttl_wcc12to17"] = len(df[cptstr.match("993[89]4")])
    stats["ttl_wccadult"] = len(df[cptstr.match("993[89]5")])
    stats["wcc_num_pts"] = len(partitions["wcc_encs"].groupby(["date", "prw_id"]))
    stats["ttl_wcc_wrvu"] = partitions["wcc_encs"].wrvu.sum()

    # Outpatient stats
    stats["outpt_num_days"] = len(partitions["outpt_encs"].date.unique())
    stats["outpt_num_pts"] = len(partitions["outpt_encs"].groupby(["date", "prw_id"]))
    stats["outpt_ttl_wrvu"] = partitions["outpt_encs"].wrvu.sum()
    stats["outpt_avg_wrvu_per_pt"] = (
        stats["outpt_ttl_wrvu"] / stats["outpt_num_pts"]
        if stats["outpt_num_pts"] > 0
        else 0
    )
    stats["outpt_num_pts_per_day"] = (
        stats["outpt_num_pts"] / stats["outpt_num_days"]
        if stats["outpt_num_days"] > 0
        else 0
    )
    stats["outpt_wrvu_per_day"] = (
        stats["outpt_ttl_wrvu"] / stats["outpt_num_days"]
        if stats["outpt_num_days"] > 0
        else 0
    )
    stats["outpt_medicaid_wrvu"] = partitions["outpt_medicaid_encs"].wrvu.sum()
    stats["outpt_medicaid_pts"] = len(
        partitions["outpt_medicaid_encs"].groupby(["date", "prw_id"])
    )
    stats["outpt_medicaid_wrvu_per_pt"] = (
        stats["outpt_medicaid_wrvu"] / stats["outpt_medicaid_pts"]
        if stats["outpt_medicaid_pts"] > 0
        else 0
    )

    # Inpatient stats
    stats["inpt_num_pts"] = len(partitions["inpt_encs"].groupby(["date", "prw_id"]))
    stats["inpt_ttl_wrvu"] = partitions["inpt_all"].wrvu.sum()

    return stats
