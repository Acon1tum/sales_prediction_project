import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, MinMaxScaler
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
        self.scaler_y = MinMaxScaler()  # Use MinMaxScaler for target
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
        Create a TensorFlow linear regression model
        """
        model = tf.keras.Sequential([
            tf.keras.layers.Input(shape=(input_shape,)),
            tf.keras.layers.Dense(1)  # No activation function for linear regression
        ])

        model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
                      loss='mean_squared_error', metrics=['mae'])

        return model

    def train_model(self, X, y, test_size=0.2, epochs=200, batch_size=32):
        """
        Train the linear regression model
        """
        X_scaled = self.scaler_X.fit_transform(X)
        y_scaled = self.scaler_y.fit_transform(y.values.reshape(-1, 1)).flatten()

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_scaled, test_size=test_size, random_state=42
        )

        # Create the linear regression model
        self.model = self.create_model(X_train.shape[1])

        # Train the model (no early stopping needed for linear regression)
        history = self.model.fit(
            X_train, y_train, validation_split=0.2, epochs=epochs, 
            batch_size=batch_size, verbose=1
        )

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

        return max(0, prediction[0])  # Clip negative predictions to zero

    # Visualization methods
    def visualize_metrics(self, metrics_dict, save_dir='model_visualizations'):

        os.makedirs(save_dir, exist_ok=True)
        
        # Create figure with multiple subplots
        fig = plt.figure(figsize=(18, 10))
        
        # 1. Bar chart for error metrics
        ax1 = fig.add_subplot(221)
        error_metrics = {'MAE': metrics_dict['MAE'], 'RMSE': metrics_dict['RMSE']}
        
        bars = ax1.bar(error_metrics.keys(), error_metrics.values(), 
                      color=['#3498db', '#e74c3c'], width=0.6)
        ax1.set_title('Error Metrics', fontsize=14, fontweight='bold')
        ax1.set_ylabel('Value (₱)', fontsize=12)
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax1.text(bar.get_x() + bar.get_width()/2., height + 5,
                    f'{height:.2f}', ha='center', fontsize=10)
        
        # 2. Gauge chart for r2 score
        ax2 = fig.add_subplot(222, polar=True)
        r2_value = metrics_dict['R2']
        
        # Create color zones
        theta = np.linspace(0.1, 1.9*np.pi, 100)
        ax2.set_theta_direction(-1)
        ax2.set_theta_zero_location('N')
        
        # Add colored arcs
        for i, (start, end) in enumerate(zip([0, 0.3, 0.7], [0.3, 0.7, 1])):
            ax2.bar(np.pi, end-start, width=1.8*np.pi, bottom=start, 
                   color=['#f39c12', '#f1c40f', '#2ecc71'][i], alpha=0.7)
        
        # Add needle pointer
        needle_angle = np.pi + 0.9*np.pi * (1 - r2_value)
        ax2.plot([0, 0.8 * np.cos(needle_angle)], [0, 0.8 * np.sin(needle_angle)], 'k-', lw=2)
        ax2.plot([0], [0], 'ko', markersize=8)
        
        # Add quality labels
        ax2.text(np.pi+0.9*np.pi*0.85, 0.15, 'Excellent', ha='center', fontsize=10)
        ax2.text(np.pi+0.9*np.pi*0.5, 0.15, 'Good', ha='center', fontsize=10)
        ax2.text(np.pi+0.9*np.pi*0.15, 0.15, 'Poor', ha='center', fontsize=10)
        
        # 3. Metrics comparison radar chart
        ax3 = fig.add_subplot(223, polar=True)
        
        # Normalize metrics for comparison
        max_error = max(metrics_dict['MAE'], metrics_dict['RMSE'])
        normalized_metrics = {
            'R2': metrics_dict['R2'],  # Use 'R2' instead of 'r2'
            'MAE': 1 - (metrics_dict['MAE'] / max_error),
            'RMSE': 1 - (metrics_dict['RMSE'] / max_error)
        }
        
        # Plot radar
        categories = list(normalized_metrics.keys())
        values = list(normalized_metrics.values()) + [normalized_metrics['R2']]  # Use 'R2' here as well
        
        angles = [n / len(categories) * 2 * np.pi for n in range(len(categories))] + [0]
        ax3.plot(angles, values, 'o-', linewidth=2)
        ax3.fill(angles, values, alpha=0.25)
        ax3.set_title('Normalized Performance Metrics', fontsize=14, fontweight='bold')
        
        # 4. Text summary
        ax4 = fig.add_subplot(224)
        ax4.axis('off')
        
        # Create interpretation text
        mae_desc = f"MAE: {metrics_dict['MAE']:.2f} ₱\nAverage prediction error"
        rmse_desc = f"RMSE: {metrics_dict['RMSE']:.2f} ₱\nPenalizes large errors more"
        
        if metrics_dict['R2'] >= 0.7:  # Use 'R2' instead of 'r2'
            r2_desc = f"R2: {metrics_dict['R2']:.3f}\nExcellent! Explains {metrics_dict['R2']*100:.1f}% of variation"
        elif metrics_dict['R2'] >= 0.3:
            r2_desc = f"R2: {metrics_dict['R2']:.3f}\nGood. Explains {metrics_dict['R2']*100:.1f}% of variation"
        else:
            r2_desc = f"R2: {metrics_dict['R2']:.3f}\nNeeds improvement. Explains {metrics_dict['R2']*100:.1f}%"
        
        summary_text = f"MODEL PERFORMANCE\n\n{mae_desc}\n\n{rmse_desc}\n\n{r2_desc}"
        ax4.text(0.5, 0.5, summary_text, ha='center', va='center', fontsize=12,
                bbox=dict(boxstyle="round", facecolor='#f8f9fa', alpha=0.7))
        
        # Save complete visualization
        plt.tight_layout()
        plt.savefig(os.path.join(save_dir, 'model_metrics.png'), dpi=300)
        plt.close()
        
        print(f"Saved metrics visualization to {save_dir}")

    def visualize_training_history(self, history=None, save_dir='model_visualizations'):
        """
        Create training progress charts:
        - Loss over time (MSE)
        - Error over time (MAE)
        - Marks early stopping point
        
        Helps diagnose training issues
        """
        if history is None:
            history = self.history
            
        if history is None:
            print("No training history available")
            return
            
        os.makedirs(save_dir, exist_ok=True)
        
        # Create figure with two side-by-side charts
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))
        
        # Loss chart
        ax1.plot(history.history['loss'], label='Training', color='#3498db')
        ax1.plot(history.history['val_loss'], label='Validation', color='#e74c3c')
        ax1.set_title('Model Loss Over Time')
        ax1.set_ylabel('Loss (MSE)')
        ax1.legend()
        
        # MAE chart
        ax2.plot(history.history['mae'], label='Training', color='#2ecc71')
        ax2.plot(history.history['val_mae'], label='Validation', color='#9b59b6')
        ax2.set_title('Prediction Error Over Time')
        ax2.set_ylabel('MAE')
        ax2.legend()
        
        # Mark early stopping if used
        if len(history.epoch) < history.params['epochs']:
            stop_epoch = len(history.epoch) - 1
            for ax in (ax1, ax2):
                ax.axvline(stop_epoch, color='red', linestyle='--', alpha=0.5)
                ax.text(stop_epoch, ax.get_ylim()[0]*1.1, 'Early Stop', 
                       color='red', rotation=90, va='bottom')
        
        plt.tight_layout()
        plt.savefig(os.path.join(save_dir, 'training_history.png'), dpi=300)
        plt.close()
        
        print(f"Saved training history to {save_dir}")

    def visualize_predictions(self, X_test, y_test, save_dir='model_visualizations'):
        """
        Create prediction accuracy plot:
        - Actual vs predicted values
        - Perfect prediction line
        - r2 score displayed
        
        Shows how close predictions are to reality
        """
        os.makedirs(save_dir, exist_ok=True)
        
        # Get predictions in original units
        y_pred_scaled = self.model.predict(X_test).flatten()
        y_pred = self.scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()
        y_true = self.scaler_y.inverse_transform(y_test.reshape(-1, 1)).flatten()
        
        # Create scatter plot
        plt.figure(figsize=(10, 8))
        plt.scatter(y_true, y_pred, color='#3498db', alpha=0.6, s=80)
        
        # Add perfect prediction line
        min_val = min(min(y_true), min(y_pred))
        max_val = max(max(y_true), max(y_pred))
        plt.plot([min_val, max_val], [min_val, max_val], 'r--')
        
        # Add labels and r2
        plt.xlabel('Actual Sales (₱)')
        plt.ylabel('Predicted Sales (₱)')
        plt.title('Prediction Accuracy')
        
        r2 = r2_score(y_true, y_pred)
        plt.text(min_val*1.05, max_val*0.9, f'r2 = {r2:.3f}', 
                bbox=dict(facecolor='white', alpha=0.8))
        
        plt.grid(True, linestyle='--', alpha=0.3)
        plt.tight_layout()
        plt.savefig(os.path.join(save_dir, 'predictions_vs_actual.png'), dpi=300)
        plt.close()
        
        print(f"Saved prediction plot to {save_dir}")

    def feature_importance_plot(self, X, y, save_dir='model_visualizations'):
        """
        Plot feature importance based on the trained model.
        """
        if not hasattr(self.model, 'feature_importances_'):
            raise AttributeError("The model does not support feature importance.")

        os.makedirs(save_dir, exist_ok=True)

        # Get feature importance
        feature_importances = self.model.feature_importances_
        feature_names = X.columns if hasattr(X, 'columns') else [f'Feature {i}' for i in range(X.shape[1])]

        # Sort features by importance
        sorted_idx = np.argsort(feature_importances)[::-1]
        sorted_features = [feature_names[i] for i in sorted_idx]
        sorted_importances = feature_importances[sorted_idx]

        # Plot
        plt.figure(figsize=(10, 6))
        plt.barh(sorted_features, sorted_importances, color='#3498db')
        plt.xlabel('Importance')
        plt.title('Feature Importance')
        plt.gca().invert_yaxis()  # Invert y-axis to show the most important feature at the top
        plt.tight_layout()

        # Save plot
        plot_path = os.path.join(save_dir, 'feature_importance.png')
        plt.savefig(plot_path, dpi=300)
        plt.close()

        print(f"Saved feature importance plot to {plot_path}")

def feature_importance_plot(model, X, y, feature_names, n_repeats=10, 
                          random_state=42, save_dir='model_visualizations'):
    """
    Determine and visualize which factors most influence predictions:
    - Tests how much shuffling each feature reduces accuracy
    - Creates horizontal bar chart
    - Includes variability measures
    
    Returns DataFrame with importance scores
    """
    os.makedirs(save_dir, exist_ok=True)
    
    # Set up model for scikit-learn compatibility
    keras_reg = KerasRegressor(
        model=model.model,
        scaler_X=model.scaler_X,
        scaler_y=model.scaler_y
    )
    
    # Calculate importance by testing each feature
    result = permutation_importance(
        keras_reg, X, y, 
        n_repeats=n_repeats,  # Number of shuffle tests per feature
        random_state=random_state,
        n_jobs=-1  # Use all CPU cores
    )
    
    # Organize results
    importance_df = pd.DataFrame({
        'Feature': feature_names,
        'Importance': result.importances_mean,
        'Variability': result.importances_std
    }).sort_values('Importance', ascending=False)
    
    # Create visualization
    plt.figure(figsize=(12, 8))
    
    # Plot bars with error ranges
    plt.barh(
        importance_df['Feature'], 
        importance_df['Importance'], 
        xerr=importance_df['Variability'],
        color='#3498db', 
        alpha=0.7
    )
    
    plt.xlabel('Importance (Higher = More Impact)')
    plt.title('Which Factors Most Affect Sales Predictions?')
    plt.tight_layout()
    
    plt.savefig(os.path.join(save_dir, 'feature_importance.png'), dpi=300)
    plt.close()
    
    print(f"Saved feature importance to {save_dir}")
    return importance_df

def main():
    sales_predictor = SalesPredictionModel()
    X, y = sales_predictor.load_data("new_blk8_cafe_sales_2024.csv")

    if X is not None and y is not None:
        history, X_test, y_test = sales_predictor.train_model(X, y)

        performance = sales_predictor.evaluate_model(X_test, y_test)
        print("\n🏆 Model Performance:")
        for metric, value in performance.items():
            print(f"{metric}: {value}")

        # Visualize metrics
        sales_predictor.visualize_metrics(performance)
        sales_predictor.visualize_training_history(history)
        sales_predictor.visualize_predictions(X_test, y_test)
        sales_predictor.feature_importance_plot(X, y)

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
