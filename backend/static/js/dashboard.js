// Global variables to store Chart.js instances for the two main forecast graphs
// These are used to properly manage chart updates and prevent memory leaks
let chart1, chart2;

// Event listener that triggers when the DOM is fully loaded
// This ensures all HTML elements are available before running JavaScript code
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the dashboard by fetching data from the server
    fetchDashboardData();
});

// Main function to fetch all dashboard data from the server
// This is the entry point for populating the dashboard with data
function fetchDashboardData() {
    // Make an HTTP GET request to the /dashboard_data endpoint
    fetch('/dashboard_data')
        .then(response => response.json())
        .then(data => {
            // Get references to DOM elements for displaying total forecasts and change
            const totalElement = document.getElementById('total-forecasts');
            const changeElement = document.getElementById('forecast-change');
            
            // Update the total number of forecasts display
            totalElement.textContent = data.total_forecasts;
            
            // Calculate the percentage change from the previous month
            // This is currently using a placeholder calculation (88% of current total)
            // In a real implementation, this would come from the server
            const prevMonthCount = Math.floor(data.total_forecasts * 0.88);
            const percentageChange = data.total_forecasts > 0 ? 
                Math.round(((data.total_forecasts - prevMonthCount) / prevMonthCount) * 100) : 0;
            
            // Update the percentage change display with proper formatting
            // Adds a '+' sign for positive changes
            changeElement.textContent = data.percentage_change >= 0 ?
                `+${data.percentage_change}% from last month` :
                `${data.percentage_change}% from last month`;

            // Update the recent forecasts section with the latest data
            updateRecentForecasts(data.recent_forecasts);
            
            // Update the pinned forecasts section with user's pinned forecasts
            updatePinnedForecasts(data.pinned_forecasts);
        })
        .catch(error => {
            // Handle any errors during data fetching
            console.error('Error fetching dashboard data:', error);
            document.getElementById('forecast-change').textContent = 'Data unavailable';
        });
}

// Function to update the recent forecasts section
// Takes an array of forecast objects and displays them in the dashboard
function updateRecentForecasts(forecasts) {
    if (forecasts.length > 0) {
        // Update the first recent forecast card
        const forecast1 = forecasts[0];
        updateForecastCard(forecast1, 1);
        
        // Update the second recent forecast card if available
        if (forecasts.length > 1) {
            const forecast2 = forecasts[1];
            updateForecastCard(forecast2, 2);
        }
    }
}

// Function to update a single forecast card with new data
// Parameters:
// - forecast: The forecast data object
// - cardNumber: The number of the card being updated (1 or 2)
function updateForecastCard(forecast, cardNumber) {
    // Get references to the card elements
    const card = document.getElementById(`recent-forecast-${cardNumber}`);
    const select = card.querySelector('select');
    
    // Update the dropdown select with the current forecast date
    select.innerHTML = `<option value="${forecast.id}" selected>${new Date(forecast.date).toLocaleDateString()}</option>`;
    
    // Update the statistics display
    document.getElementById(`threshold-${cardNumber}`).textContent = forecast.threshold;
    document.getElementById(`avg-prediction-${cardNumber}`).textContent = forecast.avg_prediction;
    
    // Get the canvas context for the chart
    const ctx = document.getElementById(`graph${cardNumber}`).getContext('2d');
    
    // Clean up existing charts to prevent memory leaks
    if (cardNumber === 1 && chart1) chart1.destroy();
    if (cardNumber === 2 && chart2) chart2.destroy();
    
    // Create a new Chart.js instance with the forecast data
    const newChart = new Chart(ctx, {
        type: 'line',
        data: {
            // Create labels for each day of predictions
            labels: forecast.predictions.map((_, i) => `Day ${i+1}`),
            datasets: [{
                // Main dataset showing predicted sales
                label: 'Predicted Sales',
                data: forecast.predictions,
                borderColor: '#4CAF50',
                tension: 0.1,
                fill: false
            }, {
                // Secondary dataset showing the threshold line
                label: 'Threshold',
                data: Array(forecast.predictions.length).fill(forecast.threshold),
                borderColor: '#9C27B0',
                borderDash: [5, 5],
                tension: 0,
                fill: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `${forecast.product} (${forecast.type})`
                },
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
    
    // Store the chart instance in the global variables
    if (cardNumber === 1) chart1 = newChart;
    if (cardNumber === 2) chart2 = newChart;
}

// Function to update the pinned forecasts section
// Creates mini-cards for each pinned forecast with a small preview chart
function updatePinnedForecasts(forecasts) {
    // Get the container for pinned forecasts
    const container = document.getElementById('pinned-forecasts');
    container.innerHTML = '';
    
    // Create a card for each pinned forecast
    forecasts.forEach(forecast => {
        const card = document.createElement('div');
        card.className = 'pinned-card';
        card.innerHTML = `
            <div class="mini-chart-container">
                <canvas id="mini-chart-${forecast.id}"></canvas>
            </div>
            <p>${forecast.title}</p>
            <a href="/forecast_details/${forecast.id}" class="view-details">View Details</a>
        `;
        container.appendChild(card);
        
        // Create a mini chart for the pinned forecast
        // Using setTimeout to ensure the canvas is properly rendered
        setTimeout(() => {
            const ctx = document.getElementById(`mini-chart-${forecast.id}`).getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: forecast.predictions.map((_, i) => i+1),
                    datasets: [{
                        data: forecast.predictions,
                        borderColor: '#4CAF50',
                        borderWidth: 2,
                        tension: 0.1,
                        fill: false,
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: { display: false },
                        y: { display: false }
                    }
                }
            });
        }, 100);
    });
}

// Function to load detailed forecast data when a forecast is selected
// Parameters:
// - forecastId: The ID of the selected forecast
// - cardNumber: The number of the card being updated (1 or 2)
function loadForecast(forecastId, cardNumber) {
    if (!forecastId) return;
    
    // Fetch detailed forecast data from the server
    fetch(`/forecast_details_data/${forecastId}`)
        .then(response => response.json())
        .then(forecast => {
            // Update the card with the new forecast data
            updateForecastCard(forecast, cardNumber);
        })
        .catch(error => {
            console.error('Error loading forecast:', error);
        });
}
