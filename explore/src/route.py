"""
Route an incoming request to based on the URL query parameters to the corresponding dashboard
"""
DEFAULT = "default"

# IDs for API calls
CLEAR_CACHE = "clear_cache"
APIS = { CLEAR_CACHE }


def route_by_query(query_params: dict) -> str:
    """
    Returns a route ID given the query parameters in the URL.
    Expects query_params to be in the format { "param": ["value 1", "value 2" ] }, corresponding to Streamlit docs:
    https://docs.streamlit.io/library/api-reference/utilities/st.experimental_get_query_params
    """
    api = query_params.get("api")
    if api and api in APIS:
        return api

    return DEFAULT
