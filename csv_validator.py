import pandas as pd
import numpy as np
from feature_config import EXPECTED_FEATURES

def process_uploaded_csv(file_path):
    """
    Reads CSV, strictly enforces numeric data types, handles dirty strings,
    and pads missing features for XGBoost sparsity-aware prediction.
    """
    try:
        df = pd.read_csv(file_path, low_memory=False)
        df.columns = df.columns.str.strip()
        
        src_ips = df.get('Source IP', pd.Series(['Unknown'] * len(df)))
        dst_ips = df.get('Destination IP', pd.Series(['Unknown'] * len(df)))
        
        missing_features = [feat for feat in EXPECTED_FEATURES if feat not in df.columns]
        for feature in missing_features:
            df[feature] = np.nan
            
        formatted_df = df[EXPECTED_FEATURES].copy()
        
        # Note: Forcing dirty strings like "Infinity" or "144.2 " into actual numbers.
        for col in formatted_df.columns:
            formatted_df[col] = pd.to_numeric(formatted_df[col], errors='coerce')
            
        formatted_df = formatted_df.replace([np.inf, -np.inf], np.nan)
        formatted_df = formatted_df.astype('float32')

        formatted_df['Source IP'] = src_ips.values
        formatted_df['Destination IP'] = dst_ips.values

        warning_msg = None
        if missing_features:
            # Format the names directly where the warning is created
            display_names = ", ".join(missing_features[:4])
            if len(missing_features) > 4:
                display_names += ", etc."
                
            warning_msg = f"Partial Extraction: Missing {len(missing_features)} features. XGBoost is using sparsity-aware prediction. (Specifically missing: {display_names})"

        return {
            "status": "success", 
            "warning": warning_msg,
            "missing_features": missing_features,
            "data": formatted_df
        }
        
    except Exception as e:
        return {"status": "error", "message": f"CSV validation failed: {str(e)}", "missing_features": []}
