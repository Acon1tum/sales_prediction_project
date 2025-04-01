// Global variables to store chart instances
let chart1, chart2;

document.addEventListener('DOMContentLoaded', function() {
    fetchDashboardData();
});

function fetchDashboardData() {
    fetch('/dashboard_data')
        .then(response => response.json())
        .then(data => {
            // Update total forecasts count
            const totalElement = document.getElementById('total-forecasts');
            const changeElement = document.getElementById('forecast-change');
            
            totalElement.textContent = data.total_forecasts;
            
            // Calculate percentage change (you'll need to implement this logic)
            // For now, we'll use a placeholder calculation
            const prevMonthCount = Math.floor(data.total_forecasts * 0.88); // Example: 12% increase
            const percentageChange = data.total_forecasts > 0 ? 
                Math.round(((data.total_forecasts - prevMonthCount) / prevMonthCount) * 100) : 0;
            
                changeElement.textContent = data.percentage_change >= 0 ?
                    `+${data.percentage_change}% from last month` :
                    `${data.percentage_change}% from last month`;
            // Update recent forecasts
            updateRecentForecasts(data.recent_forecasts);
            
            // Update pinned forecasts
            updatePinnedForecasts(data.pinned_forecasts);
        })
        .catch(error => {
            console.error('Error fetching dashboard data:', error);
            document.getElementById('forecast-change').textContent = 'Data unavailable';
        });
}

function updateRecentForecasts(forecasts) {
    if (forecasts.length > 0) {
        // First recent forecast
        const forecast1 = forecasts[0];
        updateForecastCard(forecast1, 1);
        
        // Second recent forecast if available
        if (forecasts.length > 1) {
            const forecast2 = forecasts[1];
            updateForecastCard(forecast2, 2);
        }
    }
}

function updateForecastCard(forecast, cardNumber) {
    const card = document.getElementById(`recent-forecast-${cardNumber}`);
    const select = card.querySelector('select');
    
    // Update select options
    select.innerHTML = `<option value="${forecast.id}" selected>${new Date(forecast.date).toLocaleDateString()}</option>`;
    
    // Update stats
    document.getElementById(`threshold-${cardNumber}`).textContent = forecast.threshold;
    document.getElementById(`avg-prediction-${cardNumber}`).textContent = forecast.avg_prediction;
    
    // Create or update chart
    const ctx = document.getElementById(`graph${cardNumber}`).getContext('2d');
    
    // Destroy previous chart if exists
    if (cardNumber === 1 && chart1) chart1.destroy();
    if (cardNumber === 2 && chart2) chart2.destroy();
    
    const newChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: forecast.predictions.map((_, i) => `Day ${i+1}`),
            datasets: [{
                label: 'Predicted Sales',
                data: forecast.predictions,
                borderColor: '#4CAF50',
                tension: 0.1,
                fill: false
            }, {
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
    
    // Store chart reference
    if (cardNumber === 1) chart1 = newChart;
    if (cardNumber === 2) chart2 = newChart;
}

function updatePinnedForecasts(forecasts) {
    const container = document.getElementById('pinned-forecasts');
    container.innerHTML = '';
    
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
        
        // Render mini chart
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

function loadForecast(forecastId, cardNumber) {
    if (!forecastId) return;
    
    fetch(`/forecast_details_data/${forecastId}`)
        .then(response => response.json())
        .then(forecast => {
            updateForecastCard(forecast, cardNumber);
        })
        .catch(error => {
            console.error('Error loading forecast:', error);
        });
}
