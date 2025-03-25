import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.inspection import permutation_importance
import joblib
import os

class KerasRegressor(BaseEstimator, RegressorMixin):
    """
    Wrapper class to make Keras model compatible with scikit-learn
    """
    def __init__(self, model=None, scaler_X=None, scaler_y=None):
        self.model = model
        self.scaler_X = scaler_X
        self.scaler_y = scaler_y
    
    def fit(self, X, y):
        return self
    
    def predict(self, X):
        X_scaled = self.scaler_X.transform(X)
        y_pred_scaled = self.model.predict(X_scaled).flatten()
        y_pred = self.scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()
        return y_pred
    
    def score(self, X, y_true):
        y_pred = self.predict(X)
        return r2_score(y_true, y_pred)

class SalesPredictionModel:
    def __init__(self, random_state=42):
        np.random.seed(random_state)
        tf.random.set_seed(random_state)
        self.scaler_X = StandardScaler()
        self.scaler_y = StandardScaler()
        self.model = None
        self.feature_names = None  # Store feature names

    def load_data(self, file_path):
        """
        Load and preprocess the dataset
        """
        try:
            df = pd.read_csv(file_path)
            df_numeric = df.drop(columns=['Date', 'Product Name'])
            df_numeric = df_numeric.fillna(df_numeric.mean())

            self.feature_names = df_numeric.drop(columns=['Total Sales']).columns.tolist()
            X = df_numeric.drop(columns=['Total Sales'])
            y = df_numeric['Total Sales']

            return X, y
        except Exception as e:
            print(f"Error loading data: {e}")
            return None, None

    def create_model(self, input_shape, learning_rate=0.001):
        """
        Create a TensorFlow neural network model
        """
        model = tf.keras.Sequential([
            tf.keras.layers.Input(shape=(input_shape,)),
            tf.keras.layers.Dense(64, activation='relu', kernel_regularizer=tf.keras.regularizers.l2(0.001)),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(32, activation='relu', kernel_regularizer=tf.keras.regularizers.l2(0.001)),
            tf.keras.layers.BatchNormalization(),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(1)
        ])

        lr_schedule = tf.keras.optimizers.schedules.ExponentialDecay(
            learning_rate, decay_steps=100, decay_rate=0.9, staircase=True
        )

        model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=lr_schedule),
                      loss='mean_squared_error', metrics=['mae'])

        return model

    def train_model(self, X, y, test_size=0.2, epochs=200, batch_size=32):
        X_scaled = self.scaler_X.fit_transform(X)
        y_scaled = self.scaler_y.fit_transform(y.values.reshape(-1, 1)).flatten()

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_scaled, test_size=test_size, random_state=42
        )

        self.model = self.create_model(X_train.shape[1])

        early_stopping = tf.keras.callbacks.EarlyStopping(
            monitor='val_loss', patience=20, restore_best_weights=True
        )

        history = self.model.fit(
            X_train, y_train, validation_split=0.2, epochs=epochs, 
            batch_size=batch_size, callbacks=[early_stopping], verbose=1
        )

        return history, X_test, y_test

    def save_model(self, directory='sales_prediction_model'):
        os.makedirs(directory, exist_ok=True)
        self.model.save(os.path.join(directory, 'keras_model.keras'))
        joblib.dump(self.scaler_X, os.path.join(directory, 'scaler_X.joblib'))
        joblib.dump(self.scaler_y, os.path.join(directory, 'scaler_y.joblib'))

        with open(os.path.join(directory, 'feature_names.txt'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(self.feature_names))

        print(f"Model saved to {directory}")

    def load_model(self, directory='sales_prediction_model'):
        try:
            self.model = tf.keras.models.load_model(os.path.join(directory, 'keras_model.keras'), compile=True)
            self.scaler_X = joblib.load(os.path.join(directory, 'scaler_X.joblib'))
            self.scaler_y = joblib.load(os.path.join(directory, 'scaler_y.joblib'))

            with open(os.path.join(directory, 'feature_names.txt'), 'r', encoding='utf-8') as f:
                self.feature_names = f.read().splitlines()

            print(f"Model loaded from {directory}")
            return True
        except Exception as e:
            print(f"Error loading model: {e}")
            return False

    def evaluate_model(self, X_test, y_test):
        y_pred_scaled = self.model.predict(X_test).flatten()
        y_pred = self.scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()
        y_test_original = self.scaler_y.inverse_transform(y_test.reshape(-1, 1)).flatten()

        mae = mean_absolute_error(y_test_original, y_pred)
        mse = mean_squared_error(y_test_original, y_pred)
        rmse = np.sqrt(mse)
        r2 = r2_score(y_test_original, y_pred)

        return {'MAE': mae, 'RMSE': rmse, 'R2': r2}

    def predict_sales(self, input_features):
        if isinstance(input_features, dict):
            input_df = pd.DataFrame([input_features])
        else:
            input_df = input_features

        full_feature_df = pd.DataFrame(columns=self.feature_names)
        for feature in self.feature_names:
            full_feature_df[feature] = input_df.get(feature, 0)

        input_scaled = self.scaler_X.transform(full_feature_df)
        prediction_scaled = self.model.predict(input_scaled).flatten()
        prediction = self.scaler_y.inverse_transform(prediction_scaled.reshape(-1, 1)).flatten()

        return prediction[0]

def main():
    sales_predictor = SalesPredictionModel()
    X, y = sales_predictor.load_data("new_blk8_cafe_sales_2024.csv")

    if X is not None and y is not None:
        history, X_test, y_test = sales_predictor.train_model(X, y)

        performance = sales_predictor.evaluate_model(X_test, y_test)
        print("\n🏆 Model Performance:")
        for metric, value in performance.items():
            print(f"{metric}: {value}")

        sales_predictor.save_model()
        loaded_predictor = SalesPredictionModel()
        loaded_predictor.load_model()

        sample_input = {
            'Units Sold': 100, 'Unit Price': 50, 'Discount Applied (%)': 10,
            'Foot Traffic': 500, 'Social Media Engagement': 200, 'Ad Spend (₱)': 1000,
            'Holiday': 0, 'Local Event': 0, 'Category_Iced Coffee': 1,
            'Weather_Sunny': 1, 'Weather_Rainy': 0
        }

        print("\n🔮 Sample Sales Prediction:")
        predicted_sales = loaded_predictor.predict_sales(sample_input)
        print(f"Predicted Sales: {predicted_sales:.2f}")

if __name__ == "__main__":
    main()
