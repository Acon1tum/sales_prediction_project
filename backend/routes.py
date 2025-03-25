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
    """ Generates sales forecast and dynamic decisions """
    if model is None or scaler_X is None or scaler_y is None:
        return jsonify({"error": "Model not loaded properly"}), 500

    file_path = session.get("uploaded_file")
    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": "No uploaded file"}), 400

    try:
        # Load and preprocess CSV data
        df = pd.read_csv(file_path)
        df_numeric = df.drop(columns=["Date", "Product Name"], errors="ignore").fillna(0)

        X = df_numeric[feature_names] if all(f in df_numeric.columns for f in feature_names) else df_numeric
        X_scaled = scaler_X.transform(X)

        # Predict sales
        y_pred_scaled = model.predict(X_scaled).flatten()
        y_pred = scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()

        # Retrieve user-defined threshold (default to 0 if not set)
        threshold = session.get("threshold", 0)
        threshold = float(threshold) if threshold else 0

        # Generate dynamic decisions based on threshold
        decisions = []
        for i, predicted_sales in enumerate(y_pred):
            if predicted_sales >= threshold * 1.2:  # If sales exceed threshold by 20%
                decisions.append({"icon": "📈", "text": f"Increase production for Day {i+1}, sales expected: {predicted_sales:.2f}"})
            elif predicted_sales <= threshold * 0.8:  # If sales fall below 80% of threshold
                decisions.append({"icon": "📉", "text": f"Reduce stock for Day {i+1}, sales expected: {predicted_sales:.2f}"})
            else:
                decisions.append({"icon": "🔄", "text": f"Monitor trends for Day {i+1}, sales expected: {predicted_sales:.2f}"})

        return jsonify({"predictions": y_pred.tolist(), "decisions": decisions})

    except Exception as e:
        logging.error(f"❌ Error generating forecast: {e}")
        return jsonify({"error": "Failed to generate forecast"}), 500


@app.route("/logout")
def logout():
    """ Logs out the user and clears session data """
    session.clear()
    flash("You have been logged out", "info")
    return redirect(url_for("login"))

if __name__ == "__main__":
    app.run(debug=True)
