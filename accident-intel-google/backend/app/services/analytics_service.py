from app.utils.data_loader import get_data

def get_monthly_trends():
    df = get_data()
    monthly_counts = df['month'].value_counts().to_dict()
    return {str(int(k)): v for k, v in monthly_counts.items()}

def get_seasonal_trends():
    df = get_data()
    seasonal_counts = df['season'].value_counts().to_dict()
    return seasonal_counts

def get_heatmap_data(season=None):
    df = get_data()
    if season and season.lower() != 'all':
        df = df[df['season'].str.lower() == season.lower()]
    
    heatmap_data = df[['lat', 'lon']].dropna().to_dict(orient='records')
    return heatmap_data
