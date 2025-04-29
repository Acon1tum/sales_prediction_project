import os
import logging
import re
import pandas as pd
import joblib
import tensorflow as tf
import csv
import secrets
import string
from flask import Flask, render_template, redirect, url_for, request, session, flash, jsonify
from werkzeug.utils import secure_filename
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime, timedelta
from flask import make_response
from io import StringIO
from base64 import b64encode

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

def generate_token(length=32):
    """Generate a random token for password reset"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def store_reset_token(email, token):
    """Store password reset token in Supabase"""
    try:
        # Set token expiration to 1 hour from now
        expiration = datetime.now() + timedelta(hours=1)
        
        # First check if user exists
        user_response = supabase_client.table("users").select("id").eq("email", email).execute()
        if not user_response.data:
            return False
        
        # Store token with expiration (first delete any existing tokens for this user)
        supabase_client.table("password_resets").delete().eq("email", email).execute()
        
        token_data = {
            "email": email,
            "token": token,
            "expires_at": expiration.isoformat(),
            "created_at": "now()"
        }
        
        response = supabase_client.table("password_resets").insert(token_data).execute()
        return bool(response.data)
        
    except Exception as e:
        logging.error(f"Error storing reset token: {e}")
        return False

def validate_reset_token(token):
    """Validate that a password reset token is valid and not expired"""
    try:
        # Get token data from Supabase
        response = supabase_client.table("password_resets").select("*").eq("token", token).execute()
        
        if not response.data:
            logging.warning(f"Token not found in database: {token[:10]}...")
            return None
            
        token_data = response.data[0]
        
        # Ensure proper datetime parsing with error handling
        try:
            # Strip any timezone info to make comparison consistent
            expiration_str = token_data["expires_at"]
            if 'T' in expiration_str and '+' in expiration_str:
                expiration_str = expiration_str.split('+')[0]
                
            expiration = datetime.fromisoformat(expiration_str)
            now = datetime.now()
            
            logging.info(f"Token expiration: {expiration}, Current time: {now}")
            
            # Check if token is expired
            if now > expiration:
                logging.warning(f"Token expired at {expiration}")
                return None
                
            return token_data["email"]
        except ValueError as e:
            logging.error(f"Error parsing date from token data: {e}")
            return None
        
    except Exception as e:
        logging.error(f"Error validating reset token: {e}")
        return None

@app.context_processor
def utility_processor():
    return dict(b64encode=b64encode)   

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

            # Check if the account is pending approval
            if user.get("status") == "pending":
                flash("Your account is pending approval from an administrator. Please try again later.", "warning")
                return redirect(url_for("login"))

            # In a real app, use proper password hashing like bcrypt
            if user and user.get("password") == password:
                session["email"] = user["email"]
                session["user_id"] = user["id"]
                if "role" in user:
                    session["role"] = user["role"]

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

@app.route("/register", methods=["GET", "POST"])
def register():
    """ Handle user registration """
    if "email" in session:
        return redirect(url_for("dashboard"))
        
    if request.method == "POST":
        # Get form data
        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        email = request.form.get("email", "").strip().lower()
        position = request.form.get("position", "").strip()
        security_question = request.form.get("security_question", "").strip()
        security_answer = request.form.get("security_answer", "").strip()
        password = request.form.get("password", "").strip()
        confirm_password = request.form.get("confirm_password", "").strip()
        
        # Basic validation
        if not first_name or not last_name or not email or not password or not security_question or not security_answer:
            flash("All required fields must be filled", "danger")
            return redirect(url_for("register"))
            
        if password != confirm_password:
            flash("Passwords do not match", "danger")
            return redirect(url_for("register"))
            
        if len(password) < 8:
            flash("Password must be at least 8 characters long", "danger")
            return redirect(url_for("register"))
            
        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            flash("Invalid email format", "danger")
            return redirect(url_for("register"))
            
        try:
            # Check if email already exists
            check_response = supabase_client.table("users").select("id").eq("email", email).execute()
            if check_response.data:
                flash("Email already registered. Please use a different email or try to login.", "danger")
                return redirect(url_for("register"))
                
            # Create new user with pending status
            new_user = {
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "position": position,
                "security_question": security_question,
                "security_answer": security_answer,
                "password": password,  # In a real app, hash this password
                "status": "pending",   # Set initial status to pending
                "created_at": "now()",
                "updated_at": "now()"
            }
            
            response = supabase_client.table("users").insert(new_user).execute()
            
            if response.data:
                # Get admin users for notification
                admin_response = supabase_client.table("users").select("email").eq("role", "admin").execute()
                admin_emails = [admin["email"] for admin in admin_response.data] if admin_response.data else []
                
                # In a real app, send email notifications to admins
                # For this demo, just log the notification
                if admin_emails:
                    admin_emails_str = ", ".join(admin_emails)
                    logging.info(f"New registration pending approval: {email}. Notifying admins: {admin_emails_str}")
                
                flash("Registration submitted! Your account is pending approval from an administrator.", "info")
                return redirect(url_for("login"))
            else:
                flash("Registration failed. Please try again.", "danger")
                return redirect(url_for("register"))
                
        except Exception as e:
            logging.error(f"Registration error: {e}")
            flash("Server error during registration. Please try again later.", "danger")
            return redirect(url_for("register"))
    
    return render_template("register.html")

@app.route("/forgot_password", methods=["GET", "POST"])
def forgot_password():
    """ Handle direct password reset with security questions """
    if "email" in session:
        return redirect(url_for("dashboard"))
        
    if request.method == "POST":
        step = request.form.get("step", "")
        
        # Step 1: Check if email exists and get security question
        if step == "check_email":
            email = request.form.get("email", "").strip().lower()
            
            if not email or not re.match(r"[^@]+@[^@]+\.[^@]+", email):
                flash("Please enter a valid email address", "danger")
                return redirect(url_for("forgot_password"))
                
            try:
                # Check if email exists and get security question
                check_response = supabase_client.table("users").select("security_question").eq("email", email).execute()
                
                if not check_response.data:
                    # Security best practice: Don't reveal if email exists or not
                    flash("If your email is registered, you'll be asked a security question.", "info")
                    return redirect(url_for("forgot_password"))
                
                security_question = check_response.data[0].get("security_question")
                
                if not security_question:
                    flash("Your account doesn't have a security question set. Please contact support.", "warning")
                    return redirect(url_for("login"))
                    
                # Show security question form
                return render_template(
                    "forgot_password.html", 
                    security_question=security_question, 
                    email=email
                )
                
            except Exception as e:
                logging.error(f"Password reset error: {e}")
                flash("Server error during password reset request. Please try again later.", "danger")
                return redirect(url_for("forgot_password"))
                
        # Step 2: Verify security answer
        elif step == "verify_answer":
            email = request.form.get("email", "").strip().lower()
            security_answer = request.form.get("security_answer", "").strip()
            
            if not email or not security_answer:
                flash("All fields are required", "danger")
                return redirect(url_for("forgot_password"))
                
            try:
                # Verify security answer
                user_response = supabase_client.table("users").select("security_answer, security_question").eq("email", email).execute()
                
                if not user_response.data:
                    flash("Invalid email or security answer", "danger")
                    return redirect(url_for("forgot_password"))
                    
                stored_answer = user_response.data[0].get("security_answer")
                
                if not stored_answer or stored_answer != security_answer:
                    # Show the question again but with error
                    return render_template(
                        "forgot_password.html", 
                        security_question=user_response.data[0].get("security_question"), 
                        email=email,
                        error="Incorrect answer. Please try again."
                    )
                
                # Generate reset token
                token = generate_token()
                
                # Store token in database with short expiry (15 minutes)
                expiration = datetime.now() + timedelta(minutes=15)
                
                # Format expiration with ISO format and timezone information
                expiration_str = expiration.isoformat()
                
                # Store token with expiration (first delete any existing tokens for this user)
                supabase_client.table("password_resets").delete().eq("email", email).execute()
                
                token_data = {
                    "email": email,
                    "token": token,
                    "expires_at": expiration_str,
                    "created_at": "now()"
                }
                
                response = supabase_client.table("password_resets").insert(token_data).execute()
                
                if not response.data:
                    flash("Error processing password reset. Please try again.", "danger")
                    return redirect(url_for("forgot_password"))
                
                # Log token creation for debugging
                logging.info(f"Reset token created for {email}. Expires at: {expiration_str}")
                
                # Show password reset form
                return render_template("forgot_password.html", reset_token=token)
                
            except Exception as e:
                logging.error(f"Security answer verification error: {e}")
                flash("Server error during verification. Please try again later.", "danger")
                return redirect(url_for("forgot_password"))
                
        # Step 3: Reset password
        elif step == "reset_password":
            token = request.form.get("token", "")
            password = request.form.get("password", "").strip()
            confirm_password = request.form.get("confirm_password", "").strip()
            
            if not token or not password or not confirm_password:
                flash("All fields are required", "danger")
                return redirect(url_for("forgot_password"))
                
            if password != confirm_password:
                flash("Passwords do not match", "danger")
                return render_template("forgot_password.html", reset_token=token)
                
            if len(password) < 8:
                flash("Password must be at least 8 characters long", "danger")
                return render_template("forgot_password.html", reset_token=token)
                
            # Validate token
            logging.info(f"Validating reset token: {token[:8]}...")
            email = validate_reset_token(token)
            
            if not email:
                logging.warning(f"Token validation failed: {token[:8]}...")
                flash("Invalid or expired reset token. Please restart the password reset process.", "danger")
                return redirect(url_for("forgot_password"))
                
            try:
                # Update password in Supabase
                logging.info(f"Updating password for user: {email}")
                response = supabase_client.table("users").update({
                    "password": password,  # In a real app, hash this password
                    "updated_at": "now()"
                }).eq("email", email).execute()
                
                # Delete the used token
                token_deleted = supabase_client.table("password_resets").delete().eq("token", token).execute()
                logging.info(f"Token deleted: {bool(token_deleted.data)}")
                
                if response.data:
                    flash("Your password has been reset successfully. Please login with your new password.", "success")
                    return redirect(url_for("login"))
                else:
                    flash("Error resetting password. Please try again.", "danger")
                    return redirect(url_for("forgot_password"))
                    
            except Exception as e:
                logging.error(f"Password update error: {e}")
                flash("Server error during password reset. Please try again later.", "danger")
                return redirect(url_for("forgot_password"))
    
    return render_template("forgot_password.html")

@app.route("/dashboard")
def dashboard():
    """ Renders the dashboard if logged in, otherwise redirects to login """
    if "email" not in session:
        flash("Please login first", "warning")
        return redirect(url_for("login"))

    try:
        # Get user data including profile picture and first_name
        response = supabase_client.table("users").select("profile_pic, first_name").eq("id", session["user_id"]).execute()
        user_data = response.data[0] if response.data else {}
        
        return render_template("dashboard.html", 
            user={
                "email": session["email"],
                "profile_pic": user_data.get("profile_pic"),
                "first_name": user_data.get("first_name")
            },
            active_page="dashboard")
    except Exception as e:
        logging.error(f"Error fetching user data: {e}")
        return render_template("dashboard.html", user={"email": session["email"]}, active_page="dashboard")

@app.route("/forecast")
def forecast():
    """ Renders the forecast page if logged in, otherwise redirects to login """
    if "email" not in session:
        flash("Please login first", "warning")
        return redirect(url_for("login"))

    try:
        # Get user data including profile picture and first_name
        response = supabase_client.table("users").select("profile_pic, first_name").eq("id", session["user_id"]).execute()
        user_data = response.data[0] if response.data else {}
        
        return render_template("forecast.html", 
            user={
                "email": session["email"],
                "profile_pic": user_data.get("profile_pic"),
                "first_name": user_data.get("first_name")
            },
            active_page="forecast")
    except Exception as e:
        logging.error(f"Error fetching user data: {e}")
        return render_template("forecast.html", user={"email": session["email"]}, active_page="forecast")

@app.route("/history")
def history():
    """ Renders the history page if logged in, otherwise redirects to login """
    if "email" not in session:
        flash("Please login first", "warning")
        return redirect(url_for("login"))

    try:
        # Get user data including profile picture and first_name
        response = supabase_client.table("users").select("profile_pic, first_name").eq("id", session["user_id"]).execute()
        user_data = response.data[0] if response.data else {}
        
        return render_template("history.html", 
            user={
                "email": session["email"],
                "profile_pic": user_data.get("profile_pic"),
                "first_name": user_data.get("first_name")
            },
            active_page="history")
    except Exception as e:
        logging.error(f"Error fetching user data: {e}")
        return render_template("history.html", user={"email": session["email"]}, active_page="history")

@app.route("/settings")
def settings():
    if "user_id" not in session:
        flash("Please login first", "warning")
        return redirect(url_for("login"))

    try:
        response = supabase_client.table("users").select(
            "first_name", "last_name", "position", "profile_pic"
        ).eq("id", session["user_id"]).execute()
        
        if not response.data:
            flash("User data not found", "danger")
            return redirect(url_for("dashboard"))
            
        user_data = response.data[0]
        
        # Safely handle profile picture
        profile_pic = user_data.get("profile_pic")
        if profile_pic and not isinstance(profile_pic, str):
            profile_pic = None
        elif profile_pic and not profile_pic.startswith('data:image/'):
            profile_pic = None
        
        return render_template("settings.html", 
            user={
                "email": session["email"],
                "first_name": user_data.get("first_name", ""),
                "last_name": user_data.get("last_name", ""),
                "position": user_data.get("position", ""),
                "profile_pic": profile_pic
            }, 
            active_page="settings")
            
    except Exception as e:
        logging.error(f"Settings error: {e}")
        flash("Error loading settings", "danger")
        return redirect(url_for("dashboard"))
    

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
                    "text": (
                        f"Significant sales surge expected on Day {i+1} {product_context}. "
                        f"Predicted sales: {predicted_sales:.2f}, which is a {percentage_change:.1f}% increase compared to the threshold ({threshold}). "
                        "This indicates a strong market demand. Ensure sufficient stock levels and optimize supply chain logistics."
                    ),
                    "severity": "high",
                    "trend": "positive"
                })
            elif 20 <= percentage_change < 50 or 1 < z_score <= 2:
                decisions.append({
                    "icon": "📈", 
                    "text": (
                        f"Moderate sales growth anticipated on Day {i+1} {product_context}. "
                        f"Sales projection: {predicted_sales:.2f}, marking a {percentage_change:.1f}% increase. "
                        "This suggests a steady upward trend. Consider slight inventory adjustments and marketing enhancements."
                    ),
                    "severity": "medium",
                    "trend": "positive"
                })
            elif 5 <= percentage_change < 20 or 0.5 < z_score <= 1:
                decisions.append({
                    "icon": "🔼", 
                    "text": (
                        f"Slight increase in sales on Day {i+1} {product_context}. "
                        f"Predicted: {predicted_sales:.2f} ({percentage_change:.1f}% above threshold). "
                        "This could be due to minor seasonal effects or increased visibility. Continue monitoring market response."
                    ),
                    "severity": "low",
                    "trend": "positive"
                })
            elif -5 <= percentage_change < 5 or -0.5 <= z_score <= 0.5:
                decisions.append({
                    "icon": "🔄", 
                    "text": (
                        f"Stable sales expected on Day {i+1} {product_context}, with a projection of {predicted_sales:.2f}. "
                        "No significant changes detected. Keep a close watch on any emerging trends."
                    ),
                    "severity": "none",
                    "trend": "neutral"
                })
            elif -20 <= percentage_change < -5 or -1 <= z_score < -0.5:
                decisions.append({
                    "icon": "📉", 
                    "text": (
                        f"Slight decline in sales anticipated on Day {i+1} {product_context}. "
                        f"Expected sales: {predicted_sales:.2f}, which is {abs(percentage_change):.1f}% lower than the threshold. "
                        "This could be a normal fluctuation, but monitoring customer behavior and promotional efforts is advised."
                    ),
                    "severity": "low",
                    "trend": "negative"
                })
            elif -50 <= percentage_change < -20 or -2 <= z_score < -1:
                decisions.append({
                    "icon": "📉", 
                    "text": (
                        f"Moderate drop in sales predicted on Day {i+1} {product_context}. "
                        f"Projected: {predicted_sales:.2f}, a {abs(percentage_change):.1f}% decrease. "
                        "Possible factors include reduced demand or increased competition. Consider running targeted promotions."
                    ),
                    "severity": "medium",
                    "trend": "negative"
                })
            else:
                decisions.append({
                    "icon": "🆘", 
                    "text": (
                        f"Critical sales drop warning for Day {i+1} {product_context}. "
                        f"Forecasted sales: {predicted_sales:.2f}, a drastic {abs(percentage_change):.1f}% decline. "
                        "Immediate action is required—evaluate pricing, marketing, and inventory strategies to mitigate losses."
                    ),
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


@app.route("/get_forecast_history")
def get_forecast_history():
    """Retrieve forecast history for the current user"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        # Query forecasts for the current user
        response = supabase_client.table("forecasts").select(
            "id", "forecast_data", "product", "forecast_type", "threshold", "created_at", "upload_id"
        ).eq("user_id", session["user_id"]).order("created_at", desc=True).execute()

        # Also get the associated upload file names if available
        upload_ids = [f.get("upload_id") for f in response.data if f.get("upload_id")]
        upload_names = {}
        
        if upload_ids:
            upload_response = supabase_client.table("uploaded_data").select(
                "id", "file_name"
            ).in_("id", upload_ids).execute()
            
            upload_names = {u["id"]: u["file_name"] for u in upload_response.data}

        # Enhance the forecast data with upload file names
        enhanced_data = []
        for forecast in response.data:
            enhanced = forecast.copy()
            if forecast.get("upload_id") and forecast["upload_id"] in upload_names:
                enhanced["upload_name"] = upload_names[forecast["upload_id"]]
            enhanced_data.append(enhanced)

        return jsonify({"history": enhanced_data})

    except Exception as e:
        logging.error(f"Error fetching forecast history: {e}")
        return jsonify({"error": str(e)}), 500
    

@app.route("/export_forecast/<int:forecast_id>", methods=["GET"])
def export_forecast(forecast_id):
    """Export forecast as CSV document"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        # Get the forecast
        response = supabase_client.table("forecasts").select("*").eq("id", forecast_id).eq("user_id", session["user_id"]).execute()
        
        if not response.data:
            return jsonify({"error": "Forecast not found"}), 404
            
        forecast = response.data[0]
        forecast_data = forecast.get("forecast_data", {})
        
        return export_as_csv(forecast, forecast_data)
            
    except Exception as e:
        logging.error(f"Error exporting forecast: {e}")
        return jsonify({"error": str(e)}), 500

def export_as_csv(forecast, forecast_data):
    """Generate CSV export with full decision text"""
    si = StringIO()
    cw = csv.writer(si)
    
    # Write header
    cw.writerow(["Forecast Report"])
    cw.writerow([])
    cw.writerow(["Forecast ID:", forecast["id"]])
    cw.writerow(["Product:", forecast.get("product", "All Products")])
    cw.writerow(["Forecast Type:", forecast.get("forecast_type", "Unknown")])
    cw.writerow(["Created At:", forecast.get("created_at", "")])
    cw.writerow(["Threshold:", session.get("threshold", 100)])
    cw.writerow([])
    
    # Write predictions with full decision text
    cw.writerow(["Day", "Predicted Sales", "Decision"])
    for i, (pred, decision) in enumerate(zip(
        forecast_data.get("predictions", []),
        forecast_data.get("decisions", [])
    )):
        cw.writerow([
            i+1,
            f"{pred:.2f}",
            decision.get("text", "")  # Include full text without truncation
        ])
    
    # Write data quality
    cw.writerow([])
    cw.writerow(["Data Quality Metrics"])
    for k, v in forecast_data.get("data_quality", {}).items():
        cw.writerow([k.replace("_", " ").title(), v])
    
    output = make_response(si.getvalue())
    output.headers["Content-Disposition"] = f"attachment; filename=forecast_{forecast['id']}.csv"
    output.headers["Content-type"] = "text/csv"
    return output

@app.route("/forecast_details/<int:forecast_id>")
def forecast_details(forecast_id):
    """Show detailed view of a specific forecast"""
    if "user_id" not in session:
        flash("Please login first", "warning")
        return redirect(url_for("login"))

    try:
        # Get the forecast
        response = supabase_client.table("forecasts").select("*").eq("id", forecast_id).eq("user_id", session["user_id"]).execute()
        
        if not response.data:
            flash("Forecast not found", "danger")
            return redirect(url_for("history"))
            
        forecast = response.data[0]
        
        # Get the upload data if available
        upload_data = None
        if forecast.get("upload_id"):
            upload_response = supabase_client.table("uploaded_data").select("*").eq("id", forecast["upload_id"]).execute()
            if upload_response.data:
                upload_data = upload_response.data[0]
        
        return render_template(
            "forecast_details.html",
            forecast=forecast,
            upload_data=upload_data,
            user={"email": session["email"]}
        )
        
    except Exception as e:
        logging.error(f"Error fetching forecast details: {e}")
        flash("Error loading forecast details", "danger")
        return redirect(url_for("history"))
    

@app.route("/dashboard_data")
def dashboard_data():
    """Provides data for the dashboard"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        user_id = session["user_id"]
        
        # Get total forecasts count
        forecast_count = supabase_client.table("forecasts") \
            .select("count", count="exact") \
            .eq("user_id", user_id) \
            .execute().count
        
        # Get count from previous period (e.g., last month)
        one_month_ago = (datetime.now() - timedelta(days=30)).isoformat()
        prev_count = supabase_client.table("forecasts") \
            .select("count", count="exact") \
            .eq("user_id", user_id) \
            .lt("created_at", one_month_ago) \
            .execute().count or 0  # Use 0 if no previous forecasts
        
        # Calculate percentage change
        percentage_change = 0
        if prev_count > 0:
            percentage_change = round(((forecast_count - prev_count) / prev_count) * 100)
        
        # Get recent forecasts (last 2)
        recent_forecasts = supabase_client.table("forecasts") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(2) \
            .execute().data
        
        # Get pinned forecasts
        pinned_forecasts = supabase_client.table("forecasts") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(2) \
            .execute().data
        
        
        # Process recent forecasts data
        processed_recent = []
        for forecast in recent_forecasts:
            forecast_data = forecast.get("forecast_data", {})
            predictions = forecast_data.get("predictions", [])
            avg_prediction = sum(predictions) / len(predictions) if predictions else 0
            
            processed_recent.append({
                "id": forecast["id"],
                "date": forecast["created_at"],
                "product": forecast["product"],
                "type": forecast["forecast_type"],
                "avg_prediction": round(avg_prediction, 2),
                "threshold": forecast["threshold"],
                "predictions": predictions[:7]  # Just show first week for preview
            })
        
        # Process pinned forecasts
        processed_pinned = []
        for forecast in pinned_forecasts:
            forecast_data = forecast.get("forecast_data", {})
            predictions = forecast_data.get("predictions", [])
            
            processed_pinned.append({
                "id": forecast["id"],
                "title": f"{forecast['product']} - {forecast['forecast_type']} forecast",
                "predictions": predictions[:5]  # Just show first few for preview
            })
        
        return jsonify({
            "total_forecasts": forecast_count,
            "percentage_change": percentage_change,
            "recent_forecasts": processed_recent,
            "pinned_forecasts": processed_pinned
        })
        
    except Exception as e:
        logging.error(f"Error fetching dashboard data: {e}")
        return jsonify({"error": str(e)}), 500
    

@app.route("/forecast_details_data/<int:forecast_id>")
def forecast_details_data(forecast_id):
    """Provides data for a specific forecast"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        # Get the forecast
        response = supabase_client.table("forecasts") \
            .select("*") \
            .eq("id", forecast_id) \
            .eq("user_id", session["user_id"]) \
            .execute()
        
        if not response.data:
            return jsonify({"error": "Forecast not found"}), 404
            
        forecast = response.data[0]
        forecast_data = forecast.get("forecast_data", {})
        predictions = forecast_data.get("predictions", [])
        avg_prediction = sum(predictions) / len(predictions) if predictions else 0
        
        return jsonify({
            "id": forecast["id"],
            "date": forecast["created_at"],
            "product": forecast["product"],
            "type": forecast["forecast_type"],
            "avg_prediction": round(avg_prediction, 2),
            "threshold": forecast["threshold"],
            "predictions": predictions
        })
        
    except Exception as e:
        logging.error(f"Error fetching forecast details data: {e}")
        return jsonify({"error": str(e)}), 500
    
    

@app.route("/update_profile_picture", methods=["POST"])
def update_profile_picture():
    """Update user's profile picture in Supabase"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        data = request.json
        profile_pic = data.get("profile_pic")

        if not profile_pic:
            return jsonify({"error": "No image provided"}), 400

        # Validate the image data
        try:
            import base64
            # Check if it's a proper data URI
            if not profile_pic.startswith('data:image/'):
                return jsonify({"error": "Invalid image format. Must be a data URI starting with 'data:image/'"}), 400
                
            # Extract the base64 portion
            header, encoded = profile_pic.split(',', 1)
            # Verify the base64 data
            base64.b64decode(encoded)
            
            # Check image type from header
            if 'png' not in header and 'jpeg' not in header and 'jpg' not in header and 'gif' not in header:
                return jsonify({"error": "Only PNG, JPEG, or GIF images are allowed"}), 400

        except ValueError as e:
            logging.error(f"Invalid base64 image data: {e}")
            return jsonify({"error": "Invalid image data"}), 400

        # Update profile picture in Supabase
        response = supabase_client.table("users").update({
            "profile_pic": profile_pic,
            "updated_at": "now()"
        }).eq("id", session["user_id"]).execute()

        if response.data:
            return jsonify({"message": "Profile picture updated successfully"})
        return jsonify({"error": "Failed to update profile picture"}), 400

    except Exception as e:
        logging.error(f"Error updating profile picture: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/update_profile", methods=["POST"])
def update_profile():
    """Update user's profile information in Supabase"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        data = request.json
        update_data = {}

        # Validate and prepare update data
        if "first_name" in data:
            update_data["first_name"] = data["first_name"].strip()
        if "last_name" in data:
            update_data["last_name"] = data["last_name"].strip()
        if "email" in data:
            new_email = data["email"].strip().lower()
            if not re.match(r"[^@]+@[^@]+\.[^@]+", new_email):
                return jsonify({"error": "Invalid email format"}), 400
            update_data["email"] = new_email
        if "position" in data:
            update_data["position"] = data["position"].strip()

        if not update_data:
            return jsonify({"error": "No valid fields to update"}), 400

        # Update user in Supabase
        response = supabase_client.table("users").update({
            **update_data,
            "updated_at": "now()"
        }).eq("id", session["user_id"]).execute()

        if response.data:
            # Update session email if it was changed
            if "email" in update_data:
                session["email"] = update_data["email"]
            return jsonify({"message": "Profile updated successfully"})
        return jsonify({"error": "Failed to update profile"}), 400

    except Exception as e:
        logging.error(f"Error updating profile: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/change_password", methods=["POST"])
def change_password():
    """Change user's password in Supabase"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        data = request.json
        current_password = data.get("current_password")
        new_password = data.get("new_password")

        if not current_password or not new_password:
            return jsonify({"error": "Current and new password required"}), 400

        if len(new_password) < 8:
            return jsonify({"error": "New password must be at least 8 characters"}), 400

        # Get current user data
        response = supabase_client.table("users").select("*").eq("id", session["user_id"]).execute()
        if not response.data:
            return jsonify({"error": "User not found"}), 404

        user = response.data[0]

        # Verify current password (in a real app, use proper password hashing)
        if user.get("password") != current_password:
            return jsonify({"error": "Current password is incorrect"}), 401

        # Update password in Supabase
        update_response = supabase_client.table("users").update({
            "password": new_password,
            "updated_at": "now()"
        }).eq("id", session["user_id"]).execute()

        if update_response.data:
            return jsonify({"message": "Password changed successfully"})
        return jsonify({"error": "Failed to change password"}), 400

    except Exception as e:
        logging.error(f"Error changing password: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/logout")
def logout():
    """ Logs out the user and clears session data """
    session.clear()
    flash("You have been logged out", "info")
    return redirect(url_for("login"))

# Helper function to check if the current user is an admin
def is_admin():
    if "role" not in session:
        return False
    return session["role"] == "admin"

@app.route("/manage_users")
def manage_users():
    """Admin page to manage user approvals"""
    if "user_id" not in session:
        flash("Please login first", "warning")
        return redirect(url_for("login"))
        
    # Check if the user is an admin
    if not is_admin():
        flash("You don't have permission to access this page", "danger")
        return redirect(url_for("dashboard"))
    
    try:
        # Get all users
        response = supabase_client.table("users").select("*").execute()
        users = response.data
        
        # Group users by status
        pending_users = []
        active_users = []
        
        for user in users:
            if user.get("status") == "pending":
                pending_users.append(user)
            else:
                active_users.append(user)
        
        # Get current user information for the template
        user_response = supabase_client.table("users").select("profile_pic, first_name").eq("id", session["user_id"]).execute()
        user_data = user_response.data[0] if user_response.data else {}
        
        # Set default profile picture if none exists
        profile_pic = user_data.get("profile_pic")
        if not profile_pic:
            profile_pic = url_for('static', filename='images/user.png')
        
        return render_template(
            "manage_users.html",
            pending_users=pending_users,
            active_users=active_users,
            user={
                "email": session["email"],
                "profile_pic": profile_pic,
                "first_name": user_data.get("first_name")
            },
            active_page="manage_users"
        )
        
    except Exception as e:
        logging.error(f"Error fetching users: {e}")
        flash("Error loading users", "danger")
        return redirect(url_for("dashboard"))

@app.route("/approve_user/<string:user_id>", methods=["POST"])
def approve_user(user_id):
    """Endpoint to approve a pending user"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
        
    # Check if the current user is an admin
    if not is_admin():
        return jsonify({"error": "Permission denied"}), 403
        
    try:
        # Update user status to active
        response = supabase_client.table("users").update({
            "status": "active",
            "updated_at": "now()"
        }).eq("id", user_id).execute()
        
        if response.data:
            # In a real app, send email notification to the approved user
            approved_user = response.data[0]
            logging.info(f"User approved: {approved_user.get('email')}")
            
            return jsonify({"message": "User approved successfully"})
        else:
            return jsonify({"error": "User not found or already approved"}), 404
            
    except Exception as e:
        logging.error(f"Error approving user: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/reject_user/<string:user_id>", methods=["POST"])
def reject_user(user_id):
    """Endpoint to reject and delete a pending user"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401
        
    # Check if the current user is an admin
    if not is_admin():
        return jsonify({"error": "Permission denied"}), 403
        
    try:
        # Get user email before deletion for logging
        user_response = supabase_client.table("users").select("email").eq("id", user_id).execute()
        user_email = user_response.data[0].get("email") if user_response.data else "Unknown"
        
        # Delete the user
        response = supabase_client.table("users").delete().eq("id", user_id).execute()
        
        if response.data:
            logging.info(f"User rejected and deleted: {user_email}")
            return jsonify({"message": "User rejected successfully"})
        else:
            return jsonify({"error": "User not found"}), 404
            
    except Exception as e:
        logging.error(f"Error rejecting user: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/get_historical_forecasts")
def get_historical_forecasts():
    """Retrieve historical forecast data for the current user"""
    if "user_id" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        # Query forecasts for the current user
        response = supabase_client.table("forecasts").select(
            "id", 
            "forecast_data", 
            "product", 
            "created_at",
            "forecast_type"  # Add forecast_type to the selection
        ).eq("user_id", session["user_id"]).order("created_at", desc=True).execute()

        # Process the data to extract predictions and dates
        historical_data = []
        for forecast in response.data:
            forecast_data = forecast.get("forecast_data", {})
            predictions = forecast_data.get("predictions", [])
            if predictions:
                historical_data.append({
                    "id": forecast["id"],
                    "date": forecast["created_at"],
                    "product": forecast["product"],
                    "forecast_type": forecast["forecast_type"],  # Include forecast_type in the response
                    "predictions": predictions
                })

        return jsonify({"historical_data": historical_data})

    except Exception as e:
        logging.error(f"Error fetching historical forecasts: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
