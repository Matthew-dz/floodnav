"""
Script huấn luyện mô hình dự báo ngập nước dùng Scikit-learn (Gradient Boosting).
Phụ trách chính: Thành viên 2 (Senior Backend)
Thư viện: scikit-learn & joblib (BSD-3-Clause License - OSI Approved)
"""
from pathlib import Path
import numpy as np
import joblib
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error

MODEL_DIR = Path(__file__).resolve().parent

def generate_synthetic_training_data():
    """Tạo dữ liệu huấn luyện mẫu (lượng mưa mm/h, mực nước hiện tại cm -> mực nước sau 30/60 phút)."""
    np.random.seed(42)
    n_samples = 1500
    
    # Features: [current_depth_cm, rain_last_1h_mm, rain_last_3h_mm, slope_factor]
    current_depth = np.random.uniform(0, 45, n_samples)
    rain_1h = np.random.uniform(0, 75, n_samples)
    rain_3h = rain_1h + np.random.uniform(0, 60, n_samples)
    slope = np.random.uniform(0.6, 2.2, n_samples) # Hệ số độ trũng địa hình
    
    X = np.column_stack([current_depth, rain_1h, rain_3h, slope])
    
    # Target 30m: mực nước sau 30 phút
    y_30m = current_depth * 0.92 + (rain_1h * 0.45 * slope) + np.random.normal(0, 1.2, n_samples)
    y_30m = np.maximum(y_30m, 0)
    
    # Target 60m: mực nước sau 60 phút
    y_60m = current_depth * 0.85 + (rain_3h * 0.60 * slope) + np.random.normal(0, 1.8, n_samples)
    y_60m = np.maximum(y_60m, 0)
    
    return X, y_30m, y_60m

def train_and_save():
    print("[AI Train] Đang tạo dữ liệu và huấn luyện mô hình Gradient Boosting...")
    X, y_30, y_60 = generate_synthetic_training_data()
    
    # Huấn luyện mô hình 30 phút
    X_train, X_test, y_train, y_test = train_test_split(X, y_30, test_size=0.2, random_state=42)
    model_30m = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
    model_30m.fit(X_train, y_train)
    mse_30 = mean_squared_error(y_test, model_30m.predict(X_test))
    
    # Huấn luyện mô hình 60 phút
    X_train2, X_test2, y_train2, y_test2 = train_test_split(X, y_60, test_size=0.2, random_state=42)
    model_60m = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
    model_60m.fit(X_train2, y_train2)
    mse_60 = mean_squared_error(y_test2, model_60m.predict(X_test2))
    
    path_30 = MODEL_DIR / "model_30m.joblib"
    path_60 = MODEL_DIR / "model_60m.joblib"
    
    joblib.dump(model_30m, path_30)
    joblib.dump(model_60m, path_60)
    
    print(f"[AI Train] Thành công! Model 30m MSE: {mse_30:.3f} | Model 60m MSE: {mse_60:.3f}")
    print(f"[AI Train] Đã lưu mô hình tại:\n  1. {path_30}\n  2. {path_60}")

if __name__ == "__main__":
    train_and_save()
