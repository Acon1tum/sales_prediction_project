import os
import logging
import pandas as pd
import joblib
import tensorflow as tf
from flask import Flask, render_template, redirect, url_for, request, session, flash, jsonify
from werkzeug.utils import secure_filename
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import timedelta

# Load environment variables
load_dotenv()

# Initialize Flask
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "default-secret-key")

# Session timeout
app.permanent_session_lifetime = timedelta(hours=2)

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase URL or Key is missing. Check your .env file.")

# Initialize Supabase client
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Logging setup
logging.basicConfig(level=logging.DEBUG)

# Upload settings
UPLOAD_FOLDER = "backend/uploads"
ALLOWED_EXTENSIONS = {"csv"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)  # Ensure upload folder exists

# Load Model from `sales_prediction_model` folder
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_DIR = os.path.join(BASE_DIR, "sales_prediction_model")
MODEL_PATH = os.path.join(MODEL_DIR, "keras_model.keras")

print(f"🔍 Checking for model at: {MODEL_PATH}")  # Debugging output

if not os.path.exists(MODEL_PATH):
    print(f"❌ Model file not found at: {MODEL_PATH}")
else:
    print(f"✅ Model found at: {MODEL_PATH}")

try:
    model = tf.keras.models.load_model(os.path.join(MODEL_DIR, "keras_model.keras"))
    scaler_X = joblib.load(os.path.join(MODEL_DIR, "scaler_X.joblib"))
    scaler_y = joblib.load(os.path.join(MODEL_DIR, "scaler_y.joblib"))

    with open(os.path.join(MODEL_DIR, "feature_names.txt"), "r", encoding="utf-8") as f:
        feature_names = f.read().splitlines()

    logging.info("✅ Sales prediction model loaded successfully!")

except Exception as e:
    logging.error(f"❌ Error loading sales prediction model: {e}")
    model = None
    scaler_X = None
    scaler_y = None
    feature_names = []

def allowed_file(filename):
    """Check if the uploaded file has a valid CSV extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/")
def home():
    """ Redirect authenticated users to the dashboard, otherwise to login page """
    if "email" in session:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))

@app.route("/login", methods=["GET", "POST"])
def login():
    """ Handles user login """
    if "email" in session:
        return redirect(url_for("dashboard"))

    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "").strip()
        remember = request.form.get("remember") == "on"

        logging.debug(f"Login attempt: {email}")

        try:
            # Query user from Supabase
            response = supabase_client.table("users").select("*").eq("email", email).execute()
            
            if not response.data:
                flash("Invalid email or password", "danger")
                return redirect(url_for("login"))
                
            user = response.data[0]

            # In a real app, use proper password hashing like bcrypt
            if user and user.get("password") == password:
                session["email"] = user["email"]
                session["user_id"] = user["id"]

                if remember:
                    session.permanent = True
                    app.permanent_session_lifetime = timedelta(days=30)
                
                flash("Login successful!", "success")
                return redirect(url_for("dashboard"))
            else:
                flash("Invalid email or password", "danger")
                return redirect(url_for("login"))
                
        except Exception as e:
            logging.error(f"❌ Error querying Supabase: {e}")
            flash("Server error, please try again later.", "danger")
            return redirect(url_for("login"))

    return render_template("login.html")

@app.route("/dashboard")
def dashboard():
    """ Renders the dashboard if logged in, otherwise redirects to login """
    if "email" not in session:
        flash("Please login first", "warning")
        return redirect(url_for("login"))

    return render_template("dashboard.html", user={"email": session["email"]})

@app.route("/forecast")
def forecast():
    """ Renders the forecast page if logged in, otherwise redirects to login """
    if "email" not in session:
        flash("Please login first", "warning")
        return redirect(url_for("login"))

    return render_template("forecast.html", user={"email": session["email"]})

@app.route("/history")
def history():
    """ Renders the history page if logged in, otherwise redirects to login """
    if "email" not in session:
        flash("Please login first", "warning")
        return redirect(url_for("login"))

    return render_template("history.html", user={"email": session["email"]})

@app.route("/settings")
def settings():
    """ Renders the settings page if logged in, otherwise redirects to login """
    if "email" not in session:
        flash("Please login first", "warning")
        return redirect(url_for("login"))

    return render_template("settings.html", user={"email": session["email"]}, active_page="settings")


@app.route("/set_threshold", methods=["POST"])
def set_threshold():
    """ Stores the threshold value in session """
    data = request.json
    session["threshold"] = data.get("threshold", 0)
    return jsonify({"message": f"Threshold set to {session['threshold']}"}), 200

@app.route("/upload_csv", methods=["POST"])
def upload_csv():
    """ Handles CSV file upload """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "" or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    file.save(filepath)

    session["uploaded_file"] = filepath
    return jsonify({"message": "File uploaded successfully!"})


@app.route("/generate_forecast", methods=["POST"])
def generate_forecast():
    """Generates sales forecast based on data characteristics with product-specific forecasting"""
    if model is None or scaler_X is None or scaler_y is None:
        return jsonify({"error": "Model not loaded properly"}), 500

    file_path = session.get("uploaded_file")
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "No uploaded file"}), 400

    try:
        # Load and preprocess CSV data
        df = pd.read_csv(file_path)

        if "Date" not in df.columns:
            return jsonify({"error": "Dataset must contain a 'Date' column"}), 400
            
        # Check if Product Name column exists
        if "Product Name" not in df.columns:
            return jsonify({"error": "Dataset must contain a 'Product Name' column"}), 400

        # Parse dates and create year-month periods
        df["Date"] = pd.to_datetime(df["Date"], format="%d/%m/%Y", dayfirst=True, errors="coerce")
        df.dropna(subset=["Date"], inplace=True)
        
        # Extract more granular time components
        df["YearMonth"] = df["Date"].dt.to_period("M")
        df["Year"] = df["Date"].dt.year
        df["Month"] = df["Date"].dt.month
        df["Week"] = df["Date"].dt.isocalendar().week
        df["Day"] = df["Date"].dt.day
        
        # Get product from request or use "all" as default
        selected_product = request.json.get("product", "all")
        
        # Filter by product if a specific product is selected
        if selected_product != "all" and selected_product in df["Product Name"].unique():
            product_df = df[df["Product Name"] == selected_product]
            logging.info(f"Filtering data for product: {selected_product}")
        else:
            product_df = df
            selected_product = "all"
            logging.info("Using all product data for forecast")
        
        # Get unique product list for the dropdown
        product_list = ["all"] + df["Product Name"].unique().tolist()
        
        # Analyze data characteristics for better forecast determination
        date_range = (product_df["Date"].max() - product_df["Date"].min()).days
        unique_days = product_df["Date"].nunique()
        data_density = unique_days / max(date_range, 1)  # Avoid division by zero
        
        # Count unique periods
        unique_months = product_df["YearMonth"].nunique()
        unique_weeks = product_df.groupby(["Year", "Week"]).ngroups
        
        # Determine data completeness by period
        monthly_completeness = product_df.groupby("YearMonth")["Day"].nunique().mean() / 30
        weekly_completeness = product_df.groupby(["Year", "Week"])["Day"].nunique().mean() / 7
        
        # Dynamic forecast type determination based on data characteristics
        if unique_months >= 4 and monthly_completeness >= 0.7:
            # If we have good monthly data coverage for 4+ months, use quarterly forecast
            forecast_type = "quarterly"
            forecast_days = 90
            logging.info(f"Using quarterly forecast (data spans {unique_months} months with {monthly_completeness:.2f} completeness)")
        elif unique_months >= 2 and monthly_completeness >= 0.5:
            # If we have decent monthly data coverage for 2+ months, use monthly forecast
            forecast_type = "monthly"
            forecast_days = 30
            logging.info(f"Using monthly forecast (data spans {unique_months} months with {monthly_completeness:.2f} completeness)")
        elif unique_weeks >= 3 and weekly_completeness >= 0.6:
            # If we have good weekly data coverage for 3+ weeks, use weekly forecast
            forecast_type = "weekly"
            forecast_days = 7
            logging.info(f"Using weekly forecast (data spans {unique_weeks} weeks with {weekly_completeness:.2f} completeness)")
        else:
            # Default to a short-term forecast if data quality is uncertain
            forecast_type = "short-term"
            forecast_days = max(3, min(15, unique_days // 2))  # More adaptive based on available data
            logging.info(f"Using short-term forecast of {forecast_days} days (limited data quality)")
        
        # Allow user to override with query parameter or session value
        user_forecast_type = request.json.get("forecast_type") or session.get("forecast_type")
        if user_forecast_type in ["weekly", "monthly", "quarterly"]:
            forecast_type = user_forecast_type
            forecast_days = {"weekly": 7, "monthly": 30, "quarterly": 90}[forecast_type]
            logging.info(f"User overrode forecast type to {forecast_type}")

        # Prepare data for prediction
        product_df_numeric = product_df.drop(columns=["Date", "Product Name", "YearMonth", "Year", "Month", "Week", "Day"], errors="ignore").fillna(0)
        
        # Make sure all expected features are present
        if all(f in product_df_numeric.columns for f in feature_names):
            X = product_df_numeric[feature_names]
        else:
            # Fallback if feature names don't match
            logging.warning("Feature names don't match model expectations. Using available numeric columns.")
            X = product_df_numeric
            
        X_scaled = scaler_X.transform(X)

        # Predict sales
        y_pred_scaled = model.predict(X_scaled).flatten()
        y_pred = scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()

        # User-defined threshold with default fallback
        threshold = float(session.get("threshold", 100))
        
        # Calculate baseline metrics for more contextual decisions
        avg_sales = y_pred.mean()
        sales_std = y_pred.std() if len(y_pred) > 1 else avg_sales * 0.1
        
        # Generate dynamic decisions based on predictions and context
        decisions = []
        for i in range(min(len(y_pred), forecast_days)):
            predicted_sales = y_pred[i]
            
            # Calculate various metrics for decision making
            absolute_change = predicted_sales - threshold
            percentage_change = (absolute_change / threshold * 100) if threshold > 0 else 0
            z_score = (predicted_sales - avg_sales) / max(sales_std, 1)  # Standardized score
            
            # Use multiple factors for more nuanced decisions
            product_context = f"for {selected_product}" if selected_product != "all" else "overall"
            
            if percentage_change >= 50 or z_score > 2:
                decisions.append({
                    "icon": "🚀", 
                    "text": f"Major increase expected on Day {i+1} {product_context}, sales: {predicted_sales:.2f}. Consider expanding stock and promotions!",
                    "severity": "high",
                    "trend": "positive"
                })
            elif 20 <= percentage_change < 50 or 1 < z_score <= 2:
                decisions.append({
                    "icon": "📈", 
                    "text": f"Moderate growth expected on Day {i+1} {product_context}, sales: {predicted_sales:.2f}. Increase production cautiously.",
                    "severity": "medium",
                    "trend": "positive"
                })
            elif 5 <= percentage_change < 20 or 0.5 < z_score <= 1:
                decisions.append({
                    "icon": "🔼", 
                    "text": f"Small sales increase on Day {i+1} {product_context}, sales: {predicted_sales:.2f}. Keep an eye on trends.",
                    "severity": "low",
                    "trend": "positive"
                })
            elif -5 <= percentage_change < 5 or -0.5 <= z_score <= 0.5:
                decisions.append({
                    "icon": "🔄", 
                    "text": f"Stable sales on Day {i+1} {product_context}, sales: {predicted_sales:.2f}. No immediate action needed.",
                    "severity": "none",
                    "trend": "neutral"
                })
            elif -20 <= percentage_change < -5 or -1 <= z_score < -0.5:
                decisions.append({
                    "icon": "📉", 
                    "text": f"Small decline in sales on Day {i+1} {product_context}, sales: {predicted_sales:.2f}. Consider minor stock adjustments.",
                    "severity": "low",
                    "trend": "negative"
                })
            elif -50 <= percentage_change < -20 or -2 <= z_score < -1:
                decisions.append({
                    "icon": "⚠️", 
                    "text": f"Moderate drop in sales on Day {i+1} {product_context}, sales: {predicted_sales:.2f}. Reduce stock and evaluate promotions.",
                    "severity": "medium",
                    "trend": "negative"
                })
            else:
                decisions.append({
                    "icon": "🆘", 
                    "text": f"Major sales drop on Day {i+1} {product_context}, sales: {predicted_sales:.2f}. Immediate action required!",
                    "severity": "high",
                    "trend": "negative"
                })

        # Return more comprehensive forecast information
        return jsonify({
            "forecast_type": forecast_type,
            "forecast_days": forecast_days,
            "predictions": y_pred[:forecast_days].tolist(),
            "decisions": decisions,
            "selected_product": selected_product,
            "product_list": product_list,
            "data_quality": {
                "date_range_days": date_range,
                "unique_days": unique_days,
                "unique_months": unique_months,
                "unique_weeks": unique_weeks,
                "data_density": round(data_density, 2),
                "monthly_completeness": round(monthly_completeness, 2),
                "weekly_completeness": round(weekly_completeness, 2)
            }
        })

    except Exception as e:
        logging.error(f"❌ Error generating forecast: {e}", exc_info=True)
        return jsonify({"error": f"Failed to generate forecast: {str(e)}"}), 500


@app.route("/reset", methods=["POST"])
def reset():
    """ Reset session data related to forecasting """
    # Remove uploaded file reference from session
    if "uploaded_file" in session:
        # Optionally: Delete the actual file from server
        if os.path.exists(session["uploaded_file"]):
            try:
                os.remove(session["uploaded_file"])
            except Exception as e:
                logging.error(f"Error removing file: {e}")
        
        # Remove from session
        session.pop("uploaded_file", None)
    
    # Reset threshold
    session["threshold"] = 0
    
    # Reset forecast type if it was set
    if "forecast_type" in session:
        session.pop("forecast_type", None)
    
    return jsonify({"message": "Reset successful"}), 200

@app.route("/logout")
def logout():
    """ Logs out the user and clears session data """
    session.clear()
    flash("You have been logged out", "info")
    return redirect(url_for("login"))

if __name__ == "__main__":
    app.run(debug=True)
