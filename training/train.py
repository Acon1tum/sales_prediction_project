import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
import seaborn as sns
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
        self.history = None  # Store training history

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
        
        # Store history for later visualization
        self.history = history

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
    
    def visualize_metrics(self, metrics_dict, save_dir='model_visualizations'):
        """
        Create visualizations for model performance metrics (MAE, RMSE, R2)
        
        Args:
            metrics_dict: Dictionary containing 'MAE', 'RMSE', and 'R2' values
            save_dir: Directory to save the visualization files
        """
        os.makedirs(save_dir, exist_ok=True)
        
        # Set the style
        plt.style.use('seaborn-v0_8-whitegrid')
        
        # Create figure with multiple subplots
        fig = plt.figure(figsize=(18, 10))
        
        # 1. Bar chart for error metrics
        ax1 = fig.add_subplot(221)
        error_metrics = {'MAE': metrics_dict['MAE'], 'RMSE': metrics_dict['RMSE']}
        colors = ['#3498db', '#e74c3c']
        
        bars = ax1.bar(error_metrics.keys(), error_metrics.values(), color=colors, width=0.6)
        ax1.set_title('Error Metrics', fontsize=14, fontweight='bold')
        ax1.set_ylabel('Value (₱)', fontsize=12)
        
        # Add value labels on top of bars
        for bar in bars:
            height = bar.get_height()
            ax1.text(bar.get_x() + bar.get_width()/2., height + 5,
                    f'{height:.2f}', ha='center', fontsize=10)
        
        # 2. Gauge chart for R2 score
        ax2 = fig.add_subplot(222, polar=True)
        r2_value = metrics_dict['R2']
        
        # Create gauge chart for R2
        gauge_colors = ['#f39c12', '#f1c40f', '#2ecc71']
        r2_ranges = [0, 0.3, 0.7, 1]
        
        theta = np.linspace(0.1, 1.9*np.pi, 100)
        ax2.set_theta_direction(-1)
        ax2.set_theta_zero_location('N')
        
        # Add colored arcs for different quality levels
        for i in range(len(r2_ranges)-1):
            start = r2_ranges[i]
            end = r2_ranges[i+1]
            ax2.bar(np.pi, end-start, width=1.8*np.pi, bottom=start, 
                    color=gauge_colors[i], alpha=0.7, edgecolor='white')
        
        # Add needle to show current R2 value
        needle_angle = np.pi + 0.9*np.pi * (1 - r2_value)
        ax2.plot([0, 0.8 * np.cos(needle_angle)], [0, 0.8 * np.sin(needle_angle)], 'k-', lw=2)
        ax2.plot([0], [0], 'ko', markersize=8)
        
        # Remove unnecessary labels and ticks
        ax2.set_yticklabels([])
        ax2.set_xticklabels([])
        ax2.set_title(f'R² Score: {r2_value:.3f}', fontsize=14, fontweight='bold')
        
        # Add quality labels
        ax2.text(np.pi+0.9*np.pi*0.85, 0.15, 'Excellent', ha='center', fontsize=10)
        ax2.text(np.pi+0.9*np.pi*0.5, 0.15, 'Good', ha='center', fontsize=10)
        ax2.text(np.pi+0.9*np.pi*0.15, 0.15, 'Poor', ha='center', fontsize=10)
        
        # 3. Metrics comparison as a radar chart
        ax3 = fig.add_subplot(223, polar=True)
        
        # Normalized metrics for radar chart (R2 is already 0-1, normalize errors based on data range)
        max_error = max(metrics_dict['MAE'], metrics_dict['RMSE'])
        normalized_metrics = {
            'R²': metrics_dict['R2'],
            'MAE (normalized)': 1 - (metrics_dict['MAE'] / max_error),
            'RMSE (normalized)': 1 - (metrics_dict['RMSE'] / max_error)
        }
        
        # Plot radar chart
        categories = list(normalized_metrics.keys())
        N = len(categories)
        values = list(normalized_metrics.values())
        
        # Complete the loop for the plot
        values += values[:1]
        angles = [n / float(N) * 2 * np.pi for n in range(N)]
        angles += angles[:1]
        
        ax3.plot(angles, values, 'o-', linewidth=2)
        ax3.fill(angles, values, alpha=0.25)
        ax3.set_thetagrids(np.degrees(angles[:-1]), categories)
        ax3.set_ylim(0, 1)
        ax3.set_title('Normalized Performance Metrics', fontsize=14, fontweight='bold')
        
        # 4. Simplified interpretation text box
        ax4 = fig.add_subplot(224)
        ax4.axis('off')
        
        # Create text for interpretation
        mae_desc = f"MAE: {metrics_dict['MAE']:.2f} ₱\nOn average, predictions are off by this amount"
        rmse_desc = f"RMSE: {metrics_dict['RMSE']:.2f} ₱\nPenalizes larger errors more heavily than MAE"
        
        if metrics_dict['R2'] >= 0.7:
            r2_desc = f"R²: {metrics_dict['R2']:.3f}\nExcellent fit! Model explains {metrics_dict['R2']*100:.1f}% of variance"
        elif metrics_dict['R2'] >= 0.3:
            r2_desc = f"R²: {metrics_dict['R2']:.3f}\nGood fit. Model explains {metrics_dict['R2']*100:.1f}% of variance"
        else:
            r2_desc = f"R²: {metrics_dict['R2']:.3f}\nPoor fit. Model only explains {metrics_dict['R2']*100:.1f}% of variance"
        
        interp_text = f"MODEL PERFORMANCE SUMMARY\n\n{mae_desc}\n\n{rmse_desc}\n\n{r2_desc}"
        ax4.text(0.5, 0.5, interp_text, ha='center', va='center', fontsize=12,
                bbox=dict(boxstyle="round,pad=1", facecolor='#f8f9fa', edgecolor='#343a40', alpha=0.7))
        
        # Adjust layout and save
        plt.tight_layout()
        plt.savefig(os.path.join(save_dir, 'model_metrics.png'), dpi=300, bbox_inches='tight')
        plt.close(fig)
        
        print(f"Model metrics visualization saved to {os.path.join(save_dir, 'model_metrics.png')}")
        
    def visualize_training_history(self, history=None, save_dir='model_visualizations'):
        """
        Visualize the training history metrics
        
        Args:
            history: Training history object (if None, use self.history)
            save_dir: Directory to save the visualization files
        """
        if history is None:
            history = self.history
            
        if history is None:
            print("No training history available to visualize")
            return
            
        os.makedirs(save_dir, exist_ok=True)
        
        # Set the style
        plt.style.use('seaborn-v0_8-whitegrid')
        
        # Create figure with multiple subplots
        fig, axes = plt.subplots(1, 2, figsize=(16, 6))
        
        # Plot training & validation loss
        axes[0].plot(history.history['loss'], label='Training Loss', color='#3498db', linewidth=2)
        axes[0].plot(history.history['val_loss'], label='Validation Loss', color='#e74c3c', linewidth=2)
        axes[0].set_title('Model Loss Over Time', fontsize=14, fontweight='bold')
        axes[0].set_ylabel('Loss (MSE)', fontsize=12)
        axes[0].set_xlabel('Epoch', fontsize=12)
        axes[0].legend(loc='upper right')
        axes[0].grid(True, linestyle='--', alpha=0.7)
        
        # Plot training & validation MAE
        axes[1].plot(history.history['mae'], label='Training MAE', color='#2ecc71', linewidth=2)
        axes[1].plot(history.history['val_mae'], label='Validation MAE', color='#9b59b6', linewidth=2)
        axes[1].set_title('Model MAE Over Time', fontsize=14, fontweight='bold')
        axes[1].set_ylabel('Mean Absolute Error', fontsize=12)
        axes[1].set_xlabel('Epoch', fontsize=12)
        axes[1].legend(loc='upper right')
        axes[1].grid(True, linestyle='--', alpha=0.7)
        
        # Add early stopping indicator if applicable
        if len(history.epoch) < history.params['epochs']:
            early_stop_epoch = len(history.epoch)
            for ax in axes:
                ax.axvline(x=early_stop_epoch-1, color='red', linestyle='--', alpha=0.5)
                ax.text(early_stop_epoch-1, ax.get_ylim()[0] + 0.1*(ax.get_ylim()[1]-ax.get_ylim()[0]), 
                       'Early\nStopping', color='red', rotation=90, verticalalignment='bottom')
        
        # Adjust layout and save
        plt.tight_layout()
        plt.savefig(os.path.join(save_dir, 'training_history.png'), dpi=300, bbox_inches='tight')
        plt.close(fig)
        
        print(f"Training history visualization saved to {os.path.join(save_dir, 'training_history.png')}")

    def visualize_predictions(self, X_test, y_test, save_dir='model_visualizations'):
        """
        Visualize predicted vs actual values
        
        Args:
            X_test: Test features
            y_test: Test target values (scaled)
            save_dir: Directory to save the visualization files
        """
        os.makedirs(save_dir, exist_ok=True)
        
        # Get predictions
        y_pred_scaled = self.model.predict(X_test).flatten()
        y_pred = self.scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()
        y_test_actual = self.scaler_y.inverse_transform(y_test.reshape(-1, 1)).flatten()
        
        # Create figure
        plt.figure(figsize=(10, 8))
        
        # Plot actual vs predicted
        plt.scatter(y_test_actual, y_pred, color='#3498db', alpha=0.6, edgecolor='k', s=80)
        
        # Add perfect prediction line
        max_val = max(max(y_test_actual), max(y_pred))
        min_val = min(min(y_test_actual), min(y_pred))
        plt.plot([min_val, max_val], [min_val, max_val], 'r--', linewidth=2)
        
        # Add labels and title
        plt.xlabel('Actual Sales (₱)', fontsize=12)
        plt.ylabel('Predicted Sales (₱)', fontsize=12)
        plt.title('Predicted vs Actual Sales', fontsize=14, fontweight='bold')
        
        # Add r2 value as text
        r2 = r2_score(y_test_actual, y_pred)
        plt.text(min_val + 0.05*(max_val-min_val), max_val - 0.05*(max_val-min_val), 
                f'R² = {r2:.3f}', fontsize=12, bbox=dict(facecolor='white', alpha=0.5))
        
        # Add grid and save
        plt.grid(True, linestyle='--', alpha=0.7)
        plt.tight_layout()
        plt.savefig(os.path.join(save_dir, 'predictions_vs_actual.png'), dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"Predictions visualization saved to {os.path.join(save_dir, 'predictions_vs_actual.png')}")


def feature_importance_plot(model, X, y, feature_names, n_repeats=10, random_state=42, save_dir='model_visualizations'):
    """
    Create a feature importance plot using permutation importance
    
    Args:
        model: Trained model (KerasRegressor wrapper)
        X: Feature data (unscaled)
        y: Target data (unscaled)
        feature_names: List of feature names
        n_repeats: Number of times to repeat permutation
        random_state: Random seed
        save_dir: Directory to save the visualization file
    """
    os.makedirs(save_dir, exist_ok=True)
    
    # Create KerasRegressor wrapper for scikit-learn compatibility
    keras_reg = KerasRegressor(
        model=model.model,
        scaler_X=model.scaler_X,
        scaler_y=model.scaler_y
    )
    
    # Calculate feature importance
    result = permutation_importance(
        keras_reg, X, y, 
        n_repeats=n_repeats, 
        random_state=random_state,
        n_jobs=-1
    )
    
    # Sort features by importance
    importance_df = pd.DataFrame({
        'Feature': feature_names,
        'Importance': result.importances_mean,
        'Std': result.importances_std
    })
    importance_df = importance_df.sort_values('Importance', ascending=False)
    
    # Create visualization
    plt.figure(figsize=(12, 8))
    
    # Plot horizontal bars with error bars
    plt.barh(
        importance_df['Feature'], 
        importance_df['Importance'], 
        xerr=importance_df['Std'],
        color='#3498db', 
        alpha=0.7,
        error_kw={'ecolor': '#e74c3c', 'capsize': 5}
    )
    
    # Add labels and title
    plt.xlabel('Mean Importance (decrease in model performance)', fontsize=12)
    plt.title('Feature Importance (Permutation Method)', fontsize=14, fontweight='bold')
    plt.grid(True, linestyle='--', alpha=0.7, axis='x')
    plt.tight_layout()
    
    # Save figure
    plt.savefig(os.path.join(save_dir, 'feature_importance.png'), dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"Feature importance visualization saved to {os.path.join(save_dir, 'feature_importance.png')}")
    return importance_df


def main():
    sales_predictor = SalesPredictionModel()
    X, y = sales_predictor.load_data("new_blk8_cafe_sales_2024.csv")

    if X is not None and y is not None:
        # Create visualizations directory
        os.makedirs('model_visualizations', exist_ok=True)
        
        # Train the model and get history and test data
        history, X_test, y_test = sales_predictor.train_model(X, y)

        # Evaluate the model
        performance = sales_predictor.evaluate_model(X_test, y_test)
        print("\n🏆 Model Performance:")
        for metric, value in performance.items():
            print(f"{metric}: {value}")
            
        # Create visualizations
        sales_predictor.visualize_metrics(performance)
        sales_predictor.visualize_training_history(history)
        sales_predictor.visualize_predictions(X_test, y_test)
        
        # Generate feature importance plot
        importance_df = feature_importance_plot(
            sales_predictor, X, y, sales_predictor.feature_names
        )
        print("\n🔍 Top 5 Important Features:")
        print(importance_df.head(5))

        # Save the model
        sales_predictor.save_model()
        
        # Load the model to verify it works
        loaded_predictor = SalesPredictionModel()
        loaded_predictor.load_model()

        # Make a sample prediction
        sample_input = {
            'Units Sold': 100, 'Unit Price': 50, 'Discount Applied (%)': 10,
            'Foot Traffic': 500, 'Social Media Engagement': 200, 'Ad Spend (₱)': 1000,
            'Holiday': 0, 'Local Event': 0, 'Category_Iced Coffee': 1,
            'Weather_Sunny': 1, 'Weather_Rainy': 0
        }

        print("\n🔮 Sample Sales Prediction:")
        predicted_sales = loaded_predictor.predict_sales(sample_input)
        print(f"Predicted Sales: {predicted_sales:.2f}")
        
        print("\n📊 Visualizations created in the 'model_visualizations' directory")

if __name__ == "__main__":
    main()