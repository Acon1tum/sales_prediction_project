import os
import logging
from flask import Flask, render_template, redirect, url_for, request, session, flash
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import timedelta

# Load environment variables
load_dotenv()

# Initialize Flask
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "default-secret-key")

# Session timeout (optional)
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


@app.route("/")
def home():
    """ Redirects authenticated users to the dashboard, otherwise to login page """
    if 'email' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route("/login", methods=['GET', 'POST'])
def login():
    """ Handles user login """
    if 'email' in session:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '').strip()
        remember = request.form.get('remember') == 'on'

        logging.debug(f"Login attempt: {email}")

        try:
            # Query user from Supabase
            response = supabase_client.table("users").select("*").eq("email", email).execute()
            
            if not response.data:
                flash('Invalid email or password', 'danger')
                return redirect(url_for('login'))
                
            user = response.data[0]
            
            # In a real app, use proper password hashing like bcrypt
            # This is just for demonstration
            if user and user.get("password") == password:
                session['email'] = user['email']
                session['user_id'] = user['id']
                
                if remember:
                    session.permanent = True
                    app.permanent_session_lifetime = timedelta(days=30)
                
                flash('Login successful!', 'success')
                return redirect(url_for('dashboard'))
            else:
                flash('Invalid email or password', 'danger')
                return redirect(url_for('login'))
                
        except Exception as e:
            logging.error(f"Error querying Supabase: {e}")
            flash('Server error, please try again later.', 'danger')
            return redirect(url_for('login'))

    return render_template("login.html")

@app.route("/dashboard")
def dashboard():
    """ Renders the dashboard if logged in, otherwise redirects to login """
    if 'email' not in session:
        flash('Please login first', 'warning')
        return redirect(url_for('login'))

    return render_template("dashboard.html", user={'email': session['email']})


@app.route("/forecast")
def forecast():
    """ Renders the forecast page if logged in, otherwise redirects to login """
    if 'email' not in session:
        flash('Please login first', 'warning')
        return redirect(url_for('login'))

    return render_template("forecast.html", user={'email': session['email']})


@app.route("/logout")
def logout():
    """ Logs out the user and clears session data """
    session.clear()
    flash('You have been logged out', 'info')
    return redirect(url_for('login'))


if __name__ == "__main__":
    app.run(debug=True)
