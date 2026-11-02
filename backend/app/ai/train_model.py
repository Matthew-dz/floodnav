"""
Script huấn luyện mô hình dự báo ngập nước dùng Scikit-learn (Gradient Boosting).
Phụ trách chính: Thành viên 2 (Senior Backend)
Thư viện: scikit-learn (BSD-3-Clause License - OSI Approved)
Chạy: python -m app.ai.train_model
"""
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error

def generate_synthetic_training_data():
    """Tạo dữ liệu huấn luyện mẫu (lượng mưa mm/h, mực nước hiện tại cm -> mực nước sau 30 phút)."""
    np.random.seed(42)
    n_samples = 1000
    
    # Features: [current_depth_cm, rain_last_1h_mm, rain_last_3h_mm, slope_factor]
    current_depth = np.random.uniform(0, 40, n_samples)
    rain_1h = np.random.uniform(0, 70, n_samples)
    rain_3h = rain_1h + np.random.uniform(0, 50, n_samples)
    slope = np.random.uniform(0.5, 2.0, n_samples) # độ trũng
    
    X = np.column_stack([current_depth, rain_1h, rain_3h, slope])
    
    # Target: mực nước sau 30 phút
    y = current_depth * 0.9 + (rain_1h * 0.45 * slope) + np.random.normal(0, 1.5, n_samples)
    y = np.maximum(y, 0)
    
    return X, y

def train():
    print("[AI Train] Đang tạo dữ liệu và huấn luyện mô hình Scikit-learn...")
    X, y = generate_synthetic_training_data()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=3, random_state=42)
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    mse = mean_squared_error(y_test, preds)
    print(f"[AI Train] Huấn luyện hoàn tất! Mean Squared Error: {mse:.3f}")
    return model

if __name__ == "__main__":
    train()
