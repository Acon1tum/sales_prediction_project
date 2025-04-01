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

# Add these helper functions at the top of routes.py

def save_upload_to_supabase(file_path, user_id):
    """Save uploaded CSV data to Supabase"""
    try:
        # Read the CSV file
        df = pd.read_csv(file_path)
        
        # Convert to JSON for storage
        data_json = df.to_json(orient='records')
        
        # Prepare insert data
        insert_data = {
            "file_name": os.path.basename(file_path),
            "data": data_json,
            "uploaded_at": "now()"
        }
        
        # Only add user_id if it exists and is valid
        if user_id:
            # Verify user exists in your custom users table
            user_response = supabase_client.table("users").select("id").eq("id", user_id).execute()
            if user_response.data:
                insert_data["user_id"] = user_id
            else:
                logging.warning(f"User {user_id} not found in users table")
        
        # Insert into Supabase
        response = supabase_client.table('uploaded_data').insert(insert_data).execute()
        
        if response.data:
            return response.data[0]['id']
        return None
        
    except Exception as e:
        logging.error(f"Error saving upload to Supabase: {e}")
        return None

def save_forecast_to_supabase(user_id, upload_id, forecast_data, product):
    """Save forecast results to Supabase"""
    try:
        # Prepare the forecast data for storage
        forecast_json = {
            "predictions": forecast_data.get("predictions", []),
            "decisions": forecast_data.get("decisions", []),
            "metadata": {
                "forecast_type": forecast_data.get("forecast_type"),
                "forecast_days": forecast_data.get("forecast_days"),
                "data_quality": forecast_data.get("data_quality", {}),
                "product": product
            }
        }
        
        # Prepare insert data
        insert_data = {
            "upload_id": upload_id,
            "forecast_data": forecast_json,
            "product": product,
            "forecast_type": forecast_data.get("forecast_type", "unknown"),
            "threshold": float(session.get("threshold", 100)),
            "created_at": "now()"
        }
        
        # Only add user_id if it exists and is valid
        if user_id:
            # Verify user exists in your custom users table
            user_response = supabase_client.table("users").select("id").eq("id", user_id).execute()
            if user_response.data:
                insert_data["user_id"] = user_id
            else:
                logging.warning(f"User {user_id} not found in users table")
        
        # Insert into Supabase
        response = supabase_client.table('forecast_results').insert(insert_data).execute()
        
        if response.data:
            return response.data[0]['id']
        return None
        
    except Exception as e:
        logging.error(f"Error saving forecast to Supabase: {e}")
        return None


def validate_user_session():
    """Check if user is properly authenticated with your custom users table"""
    if "email" not in session or "user_id" not in session:
        return False
    
    try:
        # Check against your custom users table
        response = supabase_client.table("users").select("id").eq("id", session["user_id"]).execute()
        return len(response.data) > 0
    except Exception as e:
        logging.error(f"Error validating user session: {e}")
        return False
    

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

    # Save to Supabase
    upload_id = save_upload_to_supabase(filepath, session.get("user_id"))
    if not upload_id:
        return jsonify({"error": "Failed to save upload data"}), 500

    session["uploaded_file"] = filepath
    session["upload_id"] = upload_id  # Store the Supabase upload ID
    
    return jsonify({
        "message": "File uploaded successfully!",
        "upload_id": upload_id
    })



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
            
        if "Product Name" not in df.columns:
            return jsonify({"error": "Dataset must contain a 'Product Name' column"}), 400

        # Parse dates and create periods
        df["Date"] = pd.to_datetime(df["Date"], format="%d/%m/%Y", dayfirst=True, errors="coerce")
        df.dropna(subset=["Date"], inplace=True)
        
        # Extract time components
        df["YearMonth"] = df["Date"].dt.to_period("M")
        df["Year"] = df["Date"].dt.year
        df["Month"] = df["Date"].dt.month
        df["Week"] = df["Date"].dt.isocalendar().week
        df["Day"] = df["Date"].dt.day
        
        # Get product selection
        selected_product = request.json.get("product", "all")
        
        # Filter by product if specified
        if selected_product != "all" and selected_product in df["Product Name"].unique():
            product_df = df[df["Product Name"] == selected_product]
            logging.info(f"Filtering data for product: {selected_product}")
        else:
            product_df = df
            selected_product = "all"
            logging.info("Using all product data for forecast")
        
        # Get product list for dropdown
        product_list = ["all"] + df["Product Name"].unique().tolist()
        
        # Analyze data characteristics
        date_range = (product_df["Date"].max() - product_df["Date"].min()).days
        unique_days = product_df["Date"].nunique()
        data_density = unique_days / max(date_range, 1)
        
        unique_months = product_df["YearMonth"].nunique()
        unique_weeks = product_df.groupby(["Year", "Week"]).ngroups
        
        monthly_completeness = product_df.groupby("YearMonth")["Day"].nunique().mean() / 30
        weekly_completeness = product_df.groupby(["Year", "Week"])["Day"].nunique().mean() / 7
        
        # Determine forecast type based on data
        if unique_months >= 4 and monthly_completeness >= 0.7:
            forecast_type = "quarterly"
            forecast_days = 90
        elif unique_months >= 2 and monthly_completeness >= 0.5:
            forecast_type = "monthly"
            forecast_days = 30
        elif unique_weeks >= 3 and weekly_completeness >= 0.6:
            forecast_type = "weekly"
            forecast_days = 7
        else:
            forecast_type = "short-term"
            forecast_days = max(3, min(15, unique_days // 2))
        
        # Allow user override
        user_forecast_type = request.json.get("forecast_type") or session.get("forecast_type")
        if user_forecast_type in ["weekly", "monthly", "quarterly"]:
            forecast_type = user_forecast_type
            forecast_days = {"weekly": 7, "monthly": 30, "quarterly": 90}[forecast_type]

        # Prepare data for prediction
        product_df_numeric = product_df.drop(columns=["Date", "Product Name", "YearMonth", "Year", "Month", "Week", "Day"], 
                                           errors="ignore").fillna(0)
        
        if all(f in product_df_numeric.columns for f in feature_names):
            X = product_df_numeric[feature_names]
        else:
            logging.warning("Feature names don't match model expectations. Using available numeric columns.")
            X = product_df_numeric
            
        X_scaled = scaler_X.transform(X)

        # Predict sales
        y_pred_scaled = model.predict(X_scaled).flatten()
        y_pred = scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()

        # Get threshold
        threshold = float(session.get("threshold", 100))
        
        # Generate decisions
        avg_sales = y_pred.mean()
        sales_std = y_pred.std() if len(y_pred) > 1 else avg_sales * 0.1
        decisions = []
        
        for i in range(min(len(y_pred), forecast_days)):
            predicted_sales = y_pred[i]
            absolute_change = predicted_sales - threshold
            percentage_change = (absolute_change / threshold * 100) if threshold > 0 else 0
            z_score = (predicted_sales - avg_sales) / max(sales_std, 1)
            product_context = f"for {selected_product}" if selected_product != "all" else "overall"
            
            if percentage_change >= 50 or z_score > 2:
                decisions.append({
                    "icon": "🚀", 
                    "text": f"Major increase expected on Day {i+1} {product_context}, sales: {predicted_sales:.2f}",
                    "severity": "high",
                    "trend": "positive"
                })
            elif 20 <= percentage_change < 50 or 1 < z_score <= 2:
                decisions.append({
                    "icon": "📈", 
                    "text": f"Moderate growth expected on Day {i+1} {product_context}, sales: {predicted_sales:.2f}",
                    "severity": "medium",
                    "trend": "positive"
                })
            elif 5 <= percentage_change < 20 or 0.5 < z_score <= 1:
                decisions.append({
                    "icon": "🔼", 
                    "text": f"Small sales increase on Day {i+1} {product_context}, sales: {predicted_sales:.2f}",
                    "severity": "low",
                    "trend": "positive"
                })
            elif -5 <= percentage_change < 5 or -0.5 <= z_score <= 0.5:
                decisions.append({
                    "icon": "🔄", 
                    "text": f"Stable sales on Day {i+1} {product_context}, sales: {predicted_sales:.2f}",
                    "severity": "none",
                    "trend": "neutral"
                })
            elif -20 <= percentage_change < -5 or -1 <= z_score < -0.5:
                decisions.append({
                    "icon": "📉", 
                    "text": f"Small decline in sales on Day {i+1} {product_context}, sales: {predicted_sales:.2f}",
                    "severity": "low",
                    "trend": "negative"
                })
            elif -50 <= percentage_change < -20 or -2 <= z_score < -1:
                decisions.append({
                    "icon": "⚠️", 
                    "text": f"Moderate drop in sales on Day {i+1} {product_context}, sales: {predicted_sales:.2f}",
                    "severity": "medium",
                    "trend": "negative"
                })
            else:
                decisions.append({
                    "icon": "🆘", 
                    "text": f"Major sales drop on Day {i+1} {product_context}, sales: {predicted_sales:.2f}",
                    "severity": "high",
                    "trend": "negative"
                })

        # Prepare data for Supabase
        forecast_data = {
            "forecast_type": forecast_type,
            "forecast_days": forecast_days,
            "predictions": y_pred[:forecast_days].tolist(),
            "decisions": decisions,
            "data_quality": {
                "date_range_days": date_range,
                "unique_days": unique_days,
                "unique_months": unique_months,
                "unique_weeks": unique_weeks,
                "data_density": round(data_density, 2),
                "monthly_completeness": round(monthly_completeness, 2),
                "weekly_completeness": round(weekly_completeness, 2)
            },
            "product": selected_product,
            "threshold": threshold
        }

        # Save to Supabase with proper user reference
        saved_to_db = False
        try:
            # Verify user exists in your custom users table
            user_id = session.get("user_id")
            if user_id:
                user_response = supabase_client.table("users").select("id").eq("id", user_id).execute()
                if not user_response.data:
                    logging.warning(f"User {user_id} not found in users table")
                    user_id = None

            # Prepare insert data
            insert_data = {
                "forecast_data": forecast_data,
                "product": selected_product,
                "forecast_type": forecast_type,
                "threshold": threshold,
                "created_at": "now()"
            }

            # Add user_id if valid
            if user_id:
                insert_data["user_id"] = user_id

            # Add upload_id if exists
            upload_id = session.get("upload_id")
            if upload_id:
                insert_data["upload_id"] = upload_id

            # Save to forecasts table
            response = supabase_client.table("forecasts").insert(insert_data).execute()
            saved_to_db = bool(response.data)

        except Exception as e:
            logging.error(f"Error saving to Supabase: {e}")

        # Return response
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
            },
            "saved_to_db": saved_to_db
        })

    except Exception as e:
        logging.error(f"Error generating forecast: {e}", exc_info=True)
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
    
    # Remove Supabase references
    session.pop("upload_id", None)
    session.pop("forecast_id", None)
    
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
