"""
Utility functions
"""

import calendar
import typing
import pandas as pd
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from .model import static_data


# -----------------------------------
# Date/time functions
# -----------------------------------
def period_str_to_dates(dates: str) -> typing.Tuple[datetime, datetime]:
    """
    Convert a time period string, such as "Month to Date", "Last 12 Months", etc
    to start and end date objects. Returns a tuple (first date, last date)
    """
    dates = dates.lower()
    today = datetime.today()
    today = today.replace(hour=0, minute=0, second=0, microsecond=0)
    last_day_of_month = today + relativedelta(day=31)
    last_day_of_month = last_day_of_month.replace(
        hour=23, minute=59, second=59, microsecond=999
    )

    if dates == "month to date":
        first_date = today - relativedelta(months=5)
        first_date = datetime(first_date.year, first_date.month, 1)
        return first_date, last_day_of_month
    elif dates == "year to date":
        first_date = datetime(today.year, 1, 1)
        return first_date, last_day_of_month
    elif dates == "last year":
        last_year = today.year - 1
        first_date = datetime(last_year, 1, 1)
        last_date = datetime(last_year, 12, 31)
        return first_date, last_date
    elif dates == "12 months":
        first_date = datetime(today.year - 1, today.month, 1)
        return first_date, last_day_of_month
    elif dates == "24 months":
        first_date = datetime(today.year - 2, today.month, 1)
        return first_date, last_day_of_month
    elif dates == "5 years":
        first_date = datetime(today.year - 5, today.month, 1)
        return first_date, last_day_of_month
    else:
        return None, None


def period_str_to_month_strs(dates: str) -> typing.Tuple[str, str]:
    """
    Convert a time period string, such as "Month to Date", "Last 12 Months", etc
    to start and end month strings, in the format "2023-01", which can be compared.
    Returns a tuple (first month, last month)

    Similar to period_str_to_dates(), but returns month strings instead of datetimes.
    """
    dates = dates.lower()
    today = datetime.today()

    def dates_to_months(date1: datetime, date2: datetime):
        return (date1.strftime("%Y-%m"), date2.strftime("%Y-%m"))

    if dates == "compare":
        first_date = datetime(today.year - 2, month=1, day=1)
        return dates_to_months(first_date, today)
    elif dates == "month to date":
        return dates_to_months(today, today)
    elif dates == "year to date":
        first_date = datetime(today.year, 1, 1)
        return dates_to_months(first_date, today)
    elif dates == "last year":
        last_year = today.year - 1
        first_date = datetime(last_year, 1, 1)
        last_date = datetime(last_year, 12, 31)
        return dates_to_months(first_date, last_date)
    elif dates == "6 months":
        first_date = today - relativedelta(months=6)
        first_date = first_date.replace(day=1)
        return dates_to_months(first_date, today)
    elif dates == "12 months":
        first_date = datetime(today.year - 1, today.month, 1)
        return dates_to_months(first_date, today)
    elif dates == "24 months":
        first_date = datetime(today.year - 2, today.month, 1)
        return dates_to_months(first_date, today)
    elif dates == "5 years":
        first_date = datetime(today.year - 5, today.month, 1)
        return dates_to_months(first_date, today)
    else:
        return None, None


def split_YYYY_MM(date_str):
    """
    Split a month string in the format "2023-01" into year and month numbers.
    If input is invalid, will return pd.nan for both values.
    """
    try:
        year, month = date_str.split("-")
        return int(year), int(month)
    except ValueError:
        return pd.NA, pd.NA


def YYYY_MM_to_month_str(date_str):
    """
    Convert a month string in the format "2023-01" to a month string in the format "Jan 2023"
    """
    year, month = split_YYYY_MM(date_str)
    return f"{datetime(year, month, 1):%b %Y}"


def last_day_of_month(month_str: str) -> datetime:
    """
    Given a string in the format "YYYY-MM", return the last day of that month.
    """
    year, month = split_YYYY_MM(month_str)
    if month == 12:
        next_month = datetime(year + 1, 1, 1)
    else:
        next_month = datetime(year, month + 1, 1)
    last_day = next_month - timedelta(days=1)
    return last_day


def pct_of_year_through_date(month_str: str) -> float:
    """
    Given a month string in the format "2023-01", return the percentage of the year that has passed up to that date.
    """
    year, _month = split_YYYY_MM(month_str)

    # Calculate days in year and days from Jan 1 to last of month. Use datetime library to correctly account for leap years
    first_day_of_year = datetime(year, 1, 1)
    last_day_of_year = datetime(year, 12, 31)
    last_day = last_day_of_month(month_str)
    days_in_year = (last_day_of_year - first_day_of_year).days + 1
    days_in_year_through_month = (last_day - first_day_of_year).days + 1

    # Return percent of days through end of the given month
    return days_in_year_through_month / days_in_year


def fte_hrs_in_year(year: int) -> int:
    return (
        static_data.FTE_HOURS_PER_YEAR
        if calendar.isleap(year)
        else static_data.FTE_HOURS_PER_LEAP_YEAR
    )


# Group a set of data with two columns by month from Jan to Dec. month_col should be the name of a column
# in the format "2020-01" and value_col the name of the data column.
def group_data_by_month(src, month_col, value_col):
    # Split source month column in the form 2020-01 into month and year numbers. Year should be a string
    # instead of number so it can be used as a categorical classifier for plotly graphs
    df = pd.DataFrame(columns=["Month", value_col, "Year"])
    _first_day_of_month = pd.to_datetime(src[month_col])
    df["Month"] = _first_day_of_month.dt.month_name()
    df["Year"] = _first_day_of_month.dt.year.astype("str")
    df[value_col] = src[value_col]

    # Sort data by year, so that bars show up in order of year
    df = df.sort_values(by="Year")

    # Specify order of months, since we can't sort alphanumerically
    new_order = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ]
    df["Month"] = pd.Categorical(df["Month"], categories=new_order, ordered=True)
    df = df.sort_values(["Month", "Year"])

    return df


# -----------------------------------
# Finance functions
# -----------------------------------
def format_finance(n):
    """Return a number formatted a finance amount - dollar sign, two decimal places, commas, negative values wrapped in parens"""
    return f"${n:,}" if n >= 0 else f"(${abs(n):,})"
