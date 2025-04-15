import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
from datetime import datetime

# Load environment variables
load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase URL or Key is missing. Check your .env file.")

# Initialize Supabase client
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def create_admin_user(email, password, first_name, last_name):
    """Create an admin user if one doesn't already exist"""
    try:
        # Check if user already exists
        response = supabase_client.table("users").select("*").eq("email", email).execute()
        
        if response.data:
            # User exists, check if they're an admin
            user = response.data[0]
            if user.get("role") == "admin":
                logging.info(f"Admin user '{email}' already exists.")
                return True
            else:
                # Upgrade to admin
                update_response = supabase_client.table("users").update({
                    "role": "admin",
                    "updated_at": datetime.now().isoformat()
                }).eq("id", user["id"]).execute()
                
                if update_response.data:
                    logging.info(f"User '{email}' upgraded to admin role.")
                    return True
                else:
                    logging.error("Failed to upgrade user to admin role.")
                    return False
        
        # Create new admin user
        new_admin = {
            "email": email,
            "password": password,  # In a real app, hash this password
            "first_name": first_name,
            "last_name": last_name,
            "role": "admin",
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        response = supabase_client.table("users").insert(new_admin).execute()
        
        if response.data:
            logging.info(f"Admin user '{email}' created successfully.")
            return True
        else:
            logging.error("Failed to create admin user.")
            return False
            
    except Exception as e:
        logging.error(f"Error creating admin user: {e}")
        return False

def setup_database_tables():
    """Ensure the required tables exist"""
    try:
        # Check if password_resets table exists
        # This is just a check - in Supabase you'd normally create tables through the dashboard
        response = supabase_client.table("password_resets").select("count", count="exact").limit(1).execute()
        logging.info("Database tables are set up correctly.")
        return True
    except Exception as e:
        logging.error(f"Database tables may not be set up correctly: {e}")
        logging.info("Please ensure you have the following tables in your Supabase database:")
        logging.info("- users (with columns: id, email, password, first_name, last_name, role, status, created_at, updated_at)")
        logging.info("- password_resets (with columns: id, email, token, expires_at, created_at)")
        return False

if __name__ == "__main__":
    print("Setting up admin account...")
    
    # Check database tables
    setup_database_tables()
    
    # Default admin credentials - in production, prompt for these or use environment variables
    admin_email = "admin@example.com"
    admin_password = "adminpassword123"  # In a real app, use a strong password
    admin_first_name = "Admin"
    admin_last_name = "User"
    
    if create_admin_user(admin_email, admin_password, admin_first_name, admin_last_name):
        print(f"Admin user setup complete. You can login with:")
        print(f"Email: {admin_email}")
        print(f"Password: {admin_password}")
    else:
        print("Failed to set up admin user. Check the logs for details.") 