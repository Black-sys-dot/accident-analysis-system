import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in the .env file")

supabase: Client = create_client(url, key)

def get_accidents_data() -> pd.DataFrame:
    """
    Fetches the geocoded accidents dataset from Supabase 
    and returns it as a pandas DataFrame.
    """
    # Note: supabase-py limits fetch to 1000 rows by default. 
    # If the dataset is larger, we need to paginate.
    response = supabase.table("pune-accidents").select("*").execute()
    data = response.data
    
    # Simple pagination loop in case there's more than 1000 rows (PostgREST default limit)
    # The count will return total rows, but usually we can just page through.
    all_data = data
    
    if len(data) == 1000:
        offset = 1000
        while True:
            res = supabase.table("pune-accidents").select("*").range(offset, offset + 999).execute()
            if not res.data:
                break
            all_data.extend(res.data)
            offset += 1000

    if not all_data:
        # Return an empty dataframe with expected columns just in case
        return pd.DataFrame()
        
    return pd.DataFrame(all_data)
