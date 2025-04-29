// Global variables to store Chart.js instances for the two main forecast graphs
// These are used to properly manage chart updates and prevent memory leaks
let chart1, chart2, dailyForecastsChart, monthlyForecastsChart;

// Event listener that triggers when the DOM is fully loaded
// This ensures all HTML elements are available before running JavaScript code
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the dashboard by fetching data from the server
    fetchDashboardData();
    
    // Add event listener for the year filter
    const yearFilter = document.getElementById('year-filter');
    if (yearFilter) {
        yearFilter.addEventListener('change', function() {
            fetchDashboardData();
        });
    }
});

// Main function to fetch all dashboard data from the server
// This is the entry point for populating the dashboard with data
function fetchDashboardData() {
    // Get the selected year from the filter
    const yearFilter = document.getElementById('year-filter');
    const year = yearFilter ? yearFilter.value : new Date().getFullYear().toString();
    
    // Make an HTTP GET request to the /dashboard_data endpoint with the year parameter
    fetch(`/dashboard_data?year=${year}`)
        .then(response => response.json())
        .then(data => {
            // Get references to DOM elements for displaying total forecasts and change
            const totalElement = document.getElementById('total-forecasts');
            const changeElement = document.getElementById('forecast-change');
            
            // Update the total number of forecasts display
            totalElement.textContent = data.total_forecasts;
            
            // Update the percentage change display with proper formatting
            changeElement.textContent = data.percentage_change >= 0 ?
                `+${data.percentage_change}% from last month` :
                `${data.percentage_change}% from last month`;

            // Update the recent forecasts section with the latest data
            updateRecentForecasts(data.recent_forecasts);
            
            // Update the year filter options
            updateYearFilter(data.available_years, year);
            
            // Update the monthly forecasts chart
            updateMonthlyForecastsChart(data.monthly_forecasts);
        })
        .catch(error => {
            // Handle any errors during data fetching
            console.error('Error fetching dashboard data:', error);
            document.getElementById('forecast-change').textContent = 'Data unavailable';
        });
}

// Function to update the year filter options
function updateYearFilter(availableYears, selectedYear) {
    const yearFilter = document.getElementById('year-filter');
    if (!yearFilter) return;
    
    // Clear existing options
    yearFilter.innerHTML = '';
    
    // Add new options based on available years
    availableYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year.toString() === selectedYear) {
            option.selected = true;
        }
        yearFilter.appendChild(option);
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
    
    // Update the date display
    const dateDisplay = document.getElementById(`date-${cardNumber}`);
    const date = new Date(forecast.date);
    dateDisplay.textContent = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
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
            labels: forecast.predictions.map((_, i) => `Day ${i+1}`),
            datasets: [{
                label: 'Predicted Sales',
                data: forecast.predictions,
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.4,
                fill: true,
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: '#4CAF50',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#4CAF50',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }, {
                label: 'Threshold',
                data: Array(forecast.predictions.length).fill(forecast.threshold),
                borderColor: '#9C27B0',
                borderDash: [5, 5],
                borderWidth: 2,
                tension: 0,
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${forecast.product} (${forecast.type})`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 10,
                    cornerRadius: 5,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        padding: 10
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        padding: 10
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    // Store the chart instance in the global variables
    if (cardNumber === 1) chart1 = newChart;
    if (cardNumber === 2) chart2 = newChart;
}

// Function to update the monthly forecasts chart
function updateMonthlyForecastsChart(monthlyData) {
    // Get the canvas context for the chart
    const ctx = document.getElementById('monthly-forecasts-chart').getContext('2d');
    
    // Clean up existing chart to prevent memory leaks
    if (monthlyForecastsChart) monthlyForecastsChart.destroy();
    
    // Create a new Chart.js instance with the monthly forecast data
    monthlyForecastsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ],
            datasets: [{
                label: 'Forecasts Generated',
                data: monthlyData,
                backgroundColor: [
                    'rgba(54, 162, 235, 0.8)',  // January
                    'rgba(255, 99, 132, 0.8)',  // February
                    'rgba(75, 192, 192, 0.8)',  // March
                    'rgba(255, 159, 64, 0.8)',   // April
                    'rgba(153, 102, 255, 0.8)',  // May
                    'rgba(255, 205, 86, 0.8)',   // June
                    'rgba(54, 162, 235, 0.8)',  // July
                    'rgba(255, 99, 132, 0.8)',  // August
                    'rgba(75, 192, 192, 0.8)',  // September
                    'rgba(255, 159, 64, 0.8)',  // October
                    'rgba(153, 102, 255, 0.8)', // November
                    'rgba(255, 205, 86, 0.8)'   // December
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 205, 86, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 205, 86, 1)'
                ],
                borderWidth: 1,
                borderRadius: 8,
                hoverBackgroundColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 205, 86, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 205, 86, 1)'
                ],
                hoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14,
                        weight: 'bold',
                        family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
                    },
                    bodyFont: {
                        size: 13,
                        family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
                    },
                    padding: 12,
                    cornerRadius: 6,
                    displayColors: false,
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            const count = context.parsed.y;
                            return `${count} forecast${count === 1 ? '' : 's'}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 12,
                            family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
                        },
                        padding: 10,
                        stepSize: 1
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12,
                            family: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif"
                        },
                        padding: 10,
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });
}
