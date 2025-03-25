from flask import Flask, render_template, redirect, url_for, request, session, flash
from supabase import create_client, Client

# Initialize Flask
app = Flask(__name__)
app.secret_key = 'dev-key-123'  # Change this for production

# Supabase configuration
SUPABASE_URL = "https://driauwkawifyigenjvga.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyaWF1d2thd2lmeWlnZW5qdmdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4ODUzODAsImV4cCI6MjA1ODQ2MTM4MH0.97L1KTIH0P_wjwogM_Z4r4ydYZOeYZTCiWg5IiiIkfc"

supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.route("/")
def home():
    if 'email' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route("/login", methods=['GET', 'POST'])
def login():
    if 'email' in session:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')

        # Query user from Supabase
        response = supabase_client.table("users").select("id, email, password").eq("email", email).execute()
        user = response.data[0] if response.data else None

        # Check credentials
        if user and user["password"] == password:  # Since passwords are plain text (not recommended)
            session['email'] = user['email']
            session['user_id'] = user['id']
            flash('Login successful!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid email or password', 'danger')

    return render_template("login.html")

@app.route("/dashboard")
def dashboard():
    if 'email' not in session:
        flash('Please login first', 'warning')
        return redirect(url_for('login'))

    return render_template("dashboard.html", user={
        'email': session['email']
    })

@app.route("/forecast")
def forecast():
    if 'email' not in session:
        flash('Please login first', 'warning')
        return redirect(url_for('login'))

    return render_template("forecast.html", user={
        'email': session['email']
    })

@app.route("/logout")
def logout():
    session.clear()
    flash('You have been logged out', 'info')
    return redirect(url_for('login'))

if __name__ == "__main__":
    app.run(debug=True)
