# Project Setup Guide

Follow these steps to set up and run the project.

## Requirements
- Install [Python 3.11.7](https://www.python.org/downloads/release/python-3117/)
- Ensure `pip` is installed (included with Python)

## Installation Steps

1. **Create a Virtual Environment**
   ```sh
   python -m venv venv
   ```

2. **Activate the Virtual Environment**
   - Windows:
     ```sh
     venv\Scripts\Activate
     ```
   - macOS/Linux:
     ```sh
     source venv/bin/activate
     ```

3. **Install Dependencies**
   ```sh
   pip install -r requirements.txt
   ```

4. **Run the Application**
   ```sh
   python routes.py
   ```

**FOR ADMIN ACCOUNT**
   admin@example.com
   adminpassword123



## Notes
- To deactivate the virtual environment, run `deactivate`.
- If you face issues, check your Python version and dependencies.

##########################################################################################
# Sales Prediction System Documentation

## Table of Contents
1. System Overview
2. Architecture Components
3. Frontend Structure
4. Backend Structure
5. Database Integration
6. Authentication System
7. Core Features
8. API Endpoints
9. Data Flow
10. Security Considerations

## 1. System Overview

The Sales Prediction System is a web-based application that helps businesses predict sales trends and make data-driven decisions. The system uses machine learning models to analyze historical sales data and generate forecasts with actionable insights.

### Key Features:
- User authentication and profile management
- CSV data upload and processing
- Sales forecasting with multiple time horizons
- Interactive dashboards and visualizations
- Historical forecast tracking
- Export functionality
- Profile customization

## 2. Architecture Components

### Frontend:
- HTML templates (Jinja2)
- JavaScript for dynamic interactions
- CSS for styling
- Static assets (images, CSS, JS files)

### Backend:
- Flask web framework
- TensorFlow for ML predictions
- Pandas for data processing
- Supabase for database and authentication

### Database:
- Supabase PostgreSQL database
- Tables: users, forecasts, uploaded_data

## 3. Frontend Structure

### Templates:
- `base.html`: Base template with common layout
- `login.html`: User authentication
- `dashboard.html`: Main dashboard view
- `forecast.html`: Forecast generation interface
- `history.html`: Historical forecasts view
- `settings.html`: User profile settings

### JavaScript Files:
- `scripts.js`: Common utilities
- `dashboard.js`: Dashboard functionality
- `forecast.js`: Forecast generation logic
- `history.js`: History view management
- `settings.js`: Profile settings management

## 4. Backend Structure

### Main Components:
- Flask application (`routes.py`)
- Machine learning model integration
- Data processing utilities
- Database operations
- File handling

### Key Functions:
- User authentication
- File upload processing
- Forecast generation
- Data export
- Profile management

## 5. Database Integration

### Supabase Tables:

#### users:
- id: Primary key
- email: User email
- password: Hashed password
- first_name: User's first name
- last_name: User's last name
- position: User's position
- profile_pic: Base64 encoded profile picture
- created_at: Account creation timestamp
- updated_at: Last update timestamp

#### forecasts:
- id: Primary key
- user_id: Foreign key to users
- upload_id: Foreign key to uploaded_data
- forecast_data: JSON containing predictions and decisions
- product: Product name
- forecast_type: Type of forecast (weekly/monthly/quarterly)
- threshold: Sales threshold value
- created_at: Forecast creation timestamp

#### uploaded_data:
- id: Primary key
- user_id: Foreign key to users
- file_name: Original file name
- data: JSON of processed CSV data
- uploaded_at: Upload timestamp

## 6. Authentication System

### Features:
- Email/password authentication
- Session management
- Remember me functionality
- Password change capability
- Profile picture management

### Security:
- Session timeout (2 hours)
- Secure password handling
- CSRF protection
- Input validation

## 7. Core Features

### Sales Forecasting:
1. Data Upload:
   - CSV file validation
   - Data preprocessing
   - Storage in Supabase

2. Forecast Generation:
   - Product-specific analysis
   - Multiple time horizons
   - Threshold-based decisions
   - Data quality assessment

3. Decision Making:
   - Sales trend analysis
   - Threshold comparisons
   - Z-score calculations
   - Actionable insights generation

### Dashboard:
- Recent forecasts overview
- Performance metrics
- Quick actions
- Data visualization

### History Management:
- Forecast tracking
- Export capabilities
- Detailed view
- Filtering options

## 8. API Endpoints

### Authentication:
- `/login`: User login
- `/logout`: User logout
- `/change_password`: Password update

### Forecast Management:
- `/upload_csv`: CSV file upload
- `/generate_forecast`: Generate new forecast
- `/get_forecast_history`: Retrieve forecast history
- `/export_forecast/<id>`: Export forecast as CSV
- `/forecast_details/<id>`: Get detailed forecast view

### Profile Management:
- `/update_profile`: Update user profile
- `/update_profile_picture`: Update profile picture
- `/settings`: User settings page

### Dashboard:
- `/dashboard`: Main dashboard view
- `/dashboard_data`: Dashboard data API

## 9. Data Flow

### 1. User Authentication Flow
```
1. User Access:
   - User visits login page (/login)
   - Enters email and password
   - Optionally checks "Remember me"

2. Frontend Processing:
   - JavaScript validates input format
   - Prevents empty submissions
   - Shows loading state

3. Backend Processing:
   - Flask route (/login) receives POST request
   - Validates input data
   - Queries Supabase users table
   - Verifies password hash
   - Creates session with user data

4. Session Management:
   - Sets session cookie
   - Configures timeout (2 hours)
   - Stores user_id and email
   - Redirects to dashboard
```

### 2. Data Upload Flow
```
1. File Selection:
   - User selects CSV file
   - Frontend validates file type
   - Shows upload progress

2. Initial Processing:
   - File sent to /upload_csv endpoint
   - Flask validates file extension
   - Checks file size limits
   - Secures filename

3. Data Processing:
   - Pandas reads CSV
   - Validates required columns
   - Handles missing values
   - Converts data types
   - Performs initial cleaning

4. Storage:
   - Data converted to JSON
   - Stored in Supabase uploaded_data table
   - Links to user_id
   - Stores original filename
   - Returns upload_id to frontend
```

### 3. Forecast Generation Flow
```
1. User Input:
   - Selects product (or "all")
   - Sets forecast type (weekly/monthly/quarterly)
   - Configures threshold value
   - Triggers generation

2. Data Preparation:
   - Retrieves uploaded data from Supabase
   - Filters by selected product
   - Extracts relevant features
   - Applies data scaling

3. Model Processing:
   - Loads TensorFlow model
   - Applies feature scaling
   - Generates predictions
   - Calculates confidence scores

4. Decision Generation:
   - Compares predictions to threshold
   - Calculates z-scores
   - Generates actionable insights
   - Creates decision categories

5. Result Storage:
   - Formats forecast data
   - Stores in Supabase forecasts table
   - Links to upload_id and user_id
   - Includes metadata and quality metrics
```

### 4. Data Retrieval Flow
```
1. User Request:
   - Accesses specific page/feature
   - Triggers API endpoint
   - Includes authentication token

2. Backend Processing:
   - Validates user session
   - Queries appropriate Supabase table
   - Applies filters and sorting
   - Processes data as needed

3. Data Transformation:
   - Formats for frontend display
   - Calculates derived metrics
   - Handles pagination
   - Applies security filters

4. Response Delivery:
   - Sends JSON response
   - Includes status codes
   - Handles errors gracefully
   - Updates UI accordingly
```

### 5. Export Flow
```
1. User Request:
   - Selects forecast to export
   - Chooses export format (CSV)
   - Triggers export action

2. Data Collection:
   - Retrieves forecast data
   - Gets associated upload data
   - Gathers metadata
   - Formats timestamps

3. File Generation:
   - Creates CSV structure
   - Includes headers and metadata
   - Formats data for CSV
   - Handles special characters

4. Delivery:
   - Sets appropriate headers
   - Triggers file download
   - Handles large files
   - Provides progress feedback
```

### 6. Profile Update Flow
```
1. User Input:
   - Modifies profile fields
   - Uploads profile picture
   - Changes password
   - Submits changes

2. Validation:
   - Frontend validates input
   - Checks file types/sizes
   - Verifies password strength
   - Prevents duplicate emails

3. Processing:
   - Handles image upload
   - Converts to base64
   - Updates Supabase records
   - Manages session data

4. Confirmation:
   - Updates UI
   - Shows success message
   - Handles errors
   - Maintains session state
```

### 7. Dashboard Data Flow
```
1. Initial Load:
   - Authenticates user
   - Loads dashboard template
   - Initializes JavaScript

2. Data Fetching:
   - Calls /dashboard_data endpoint
   - Retrieves recent forecasts
   - Gets performance metrics
   - Loads pinned items

3. Real-time Updates:
   - Polls for new data
   - Updates visualizations
   - Refreshes metrics
   - Handles notifications

4. User Interactions:
   - Handles quick actions
   - Updates pinned items
   - Manages filters
   - Controls refresh rate
```

## 10. Security Considerations

### Data Protection:
- Secure file handling
- Input validation
- SQL injection prevention
- XSS protection

### Authentication:
- Session management
- Password hashing
- CSRF protection
- Rate limiting

### File Security:
- File type validation
- Secure filename handling
- Upload size limits
- Malware scanning

## Technical Requirements

### Backend Dependencies:
- Flask
- TensorFlow
- Pandas
- Supabase-py
- python-dotenv
- Werkzeug

### Frontend Dependencies:
- Modern web browser
- JavaScript enabled
- CSS3 support

### Database:
- Supabase account
- PostgreSQL database
- Storage bucket

## Deployment Considerations

1. Environment Setup:
   - Python virtual environment
   - Required packages installation
   - Environment variables configuration

2. Database Setup:
   - Supabase project creation
   - Table creation
   - Index configuration

3. Security Configuration:
   - SSL/TLS setup
   - CORS configuration
   - API key management

4. Monitoring:
   - Error logging
   - Performance monitoring
   - User activity tracking


## ✅ Panelist Feedback Implementation Checklist

- [ ] **Highlight Best & Worst Performing Products**
  - Display top and bottom performers.
  - Include a simple decision support section (e.g., "Put on Promotion").

- [ ] **Design UI to Be Simple and Non-Technical**
  - Use clear, easy-to-understand visuals.
  - Avoid relying on hover effects—important data should be visible at a glance.

- [ ] **Display Past and Predicted Sales Side-by-Side**
  - Left: Past sales data (from CSV input).
  - Right: Forecasted sales (predicted output).

- [ ] **Use ₱ Symbol for Sales Values**
  - Clearly indicate currency (Philippine Peso) in all charts and data displays.

- [ ] **Visualize Quantity Sold in Graphs**
  - Clearly show how many units are expected to sell (not just trends).

- [ ] **Prioritize Visuals Over Text**
  - Focus on charts/graphs for insight.
  - Keep it simple even if only showing 5 products—visual clarity is key.

- [ ] **Provide Concise, Actionable Decision Summaries**
  - Include:
    - Total sales in ₱
    - Stock needed
    - Product name
    - Recommended action (e.g., "Restock", "Discount", etc.)

