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
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Get references to DOM elements for displaying total forecasts and change
            const totalElement = document.getElementById('total-forecasts');
            const changeElement = document.getElementById('forecast-change');
            
            // Update the total number of forecasts display
            totalElement.textContent = data.total_forecasts || 0;
            
            // Update the percentage change display with proper formatting
            const percentageChange = data.percentage_change || 0;
            changeElement.textContent = percentageChange >= 0 ?
                `+${percentageChange}% from last month` :
                `${percentageChange}% from last month`;

            // Update the recent forecasts section with the latest data
            if (Array.isArray(data.recent_forecasts)) {
                updateRecentForecasts(data.recent_forecasts);
            } else {
                console.warn('Recent forecasts data is not an array:', data.recent_forecasts);
                updateRecentForecasts([]);
            }
            
            // Update the year filter options
            if (Array.isArray(data.available_years)) {
                updateYearFilter(data.available_years, year);
            } else {
                console.warn('Available years data is not an array:', data.available_years);
                updateYearFilter([new Date().getFullYear()], year);
            }
            
            // Update the monthly forecasts chart
            if (Array.isArray(data.monthly_forecasts)) {
                updateMonthlyForecastsChart(data.monthly_forecasts);
            } else {
                console.warn('Monthly forecasts data is not an array:', data.monthly_forecasts);
                updateMonthlyForecastsChart(new Array(12).fill(0));
            }

            // Update product performance section
            if (data.product_performance) {
                updateProductPerformance(data.product_performance);
            } else {
                console.warn('Product performance data is missing');
                updateProductPerformance({
                    best_performers: [],
                    worst_performers: []
                });
            }
        })
        .catch(error => {
            // Handle any errors during data fetching
            console.error('Error fetching dashboard data:', error);
            document.getElementById('forecast-change').textContent = 'Data unavailable';
            // Reset all sections to empty state
            updateRecentForecasts([]);
            updateYearFilter([new Date().getFullYear()], new Date().getFullYear().toString());
            updateMonthlyForecastsChart(new Array(12).fill(0));
            updateProductPerformance({
                best_performers: [],
                worst_performers: []
            });
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
    // Ensure forecasts is an array
    if (!Array.isArray(forecasts)) {
        console.warn('updateRecentForecasts received non-array data:', forecasts);
        forecasts = [];
    }

    // Update the first recent forecast card
    if (forecasts.length > 0) {
        updateForecastCard(forecasts[0], 1);
    } else {
        // Show empty state for first card
        const card1 = document.getElementById('recent-forecast-1');
        if (card1) {
            card1.innerHTML = '<div class="loading">No recent forecasts available</div>';
        }
    }
    
    // Update the second recent forecast card if available
    if (forecasts.length > 1) {
        updateForecastCard(forecasts[1], 2);
    } else {
        // Show empty state for second card
        const card2 = document.getElementById('recent-forecast-2');
        if (card2) {
            card2.innerHTML = '<div class="loading">No recent forecasts available</div>';
        }
    }
}

// Function to update a single forecast card with new data
// Parameters:
// - forecast: The forecast data object
// - cardNumber: The number of the card being updated (1 or 2)
function updateForecastCard(forecast, cardNumber) {
    // Validate forecast data
    if (!forecast || typeof forecast !== 'object') {
        console.warn(`Invalid forecast data for card ${cardNumber}:`, forecast);
        return;
    }

    // Get references to the card elements
    const card = document.getElementById(`recent-forecast-${cardNumber}`);
    if (!card) {
        console.warn(`Card element not found for number ${cardNumber}`);
        return;
    }
    
    // Update the date display
    const dateDisplay = document.getElementById(`date-${cardNumber}`);
    if (dateDisplay) {
        try {
            const date = new Date(forecast.date || '');
            dateDisplay.textContent = date instanceof Date && !isNaN(date) ?
                date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                }) : 'Date unavailable';
        } catch (e) {
            console.warn(`Error formatting date for card ${cardNumber}:`, e);
            dateDisplay.textContent = 'Date unavailable';
        }
    }
    
    // Update the statistics display
    const thresholdElement = document.getElementById(`threshold-${cardNumber}`);
    const avgPredictionElement = document.getElementById(`avg-prediction-${cardNumber}`);
    
    if (thresholdElement) {
        thresholdElement.textContent = forecast.threshold || 0;
    }
    if (avgPredictionElement) {
        avgPredictionElement.textContent = forecast.avg_prediction || 0;
    }
    
    // Get the canvas context for the chart
    const canvas = document.getElementById(`graph${cardNumber}`);
    if (!canvas) {
        console.warn(`Canvas element not found for card ${cardNumber}`);
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.warn(`Could not get 2D context for canvas ${cardNumber}`);
        return;
    }
    
    // Clean up existing charts to prevent memory leaks
    if (cardNumber === 1 && chart1) chart1.destroy();
    if (cardNumber === 2 && chart2) chart2.destroy();
    
    // Ensure we have valid prediction data
    const predictions = Array.isArray(forecast.predictions) ? forecast.predictions : [];
    
    // Create a new Chart.js instance with the forecast data
    const newChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: predictions.map((_, i) => `Day ${i+1}`),
            datasets: [{
                label: 'Predicted Sales',
                data: predictions,
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
                data: Array(predictions.length).fill(forecast.threshold || 0),
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
                    text: `${forecast.product || 'Unknown'} (${forecast.type || 'Unknown'})`,
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

// Function to update the product performance section
function updateProductPerformance(performanceData) {
    const bestPerformersContainer = document.getElementById('best-performers');
    const worstPerformersContainer = document.getElementById('worst-performers');

    // Clear existing content
    bestPerformersContainer.innerHTML = '';
    worstPerformersContainer.innerHTML = '';

    // Update best performers
    if (performanceData.best_performers && performanceData.best_performers.length > 0) {
        performanceData.best_performers.forEach(product => {
            const productElement = createProductElement(product, 'promote');
            bestPerformersContainer.appendChild(productElement);
        });
    } else {
        bestPerformersContainer.innerHTML = '<div class="loading">No best performers found</div>';
    }

    // Update worst performers
    if (performanceData.worst_performers && performanceData.worst_performers.length > 0) {
        performanceData.worst_performers.forEach(product => {
            const productElement = createProductElement(product, 'review');
            worstPerformersContainer.appendChild(productElement);
        });
    } else {
        worstPerformersContainer.innerHTML = '<div class="loading">No products needing attention</div>';
    }
}

// Helper function to create a product element
function createProductElement(product, actionType) {
    const productDiv = document.createElement('div');
    productDiv.className = 'product-item';

    const productInfo = document.createElement('div');
    productInfo.className = 'product-info';

    const productName = document.createElement('div');
    productName.className = 'product-name';
    productName.textContent = product.name;

    // Enhanced product stats with more metrics
    const productStats = document.createElement('div');
    productStats.className = 'product-stats';
    const avgSales = product.avg_sales;
    const growthRate = product.growth;
    const salesTrend = growthRate >= 0 ? 'upward' : 'downward';
    const performanceLevel = Math.abs(growthRate) > 20 ? 'significant' : 
                           Math.abs(growthRate) > 10 ? 'moderate' : 'slight';
    
    productStats.innerHTML = `
        <span>Avg Sales: ${avgSales.toFixed(2)}</span>
        <span>Growth: ${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%</span>
        <span>Trend: ${salesTrend}</span>
        <span>Performance: ${performanceLevel}</span>
    `;

    const suggestionDiv = document.createElement('div');
    suggestionDiv.className = `product-suggestion ${actionType}`;

    // Enhanced metrics for more detailed analysis
    const isHighGrowth = growthRate > 20;
    const isModerateGrowth = growthRate > 10 && growthRate <= 20;
    const isLowGrowth = growthRate > 0 && growthRate <= 10;
    const isDeclining = growthRate < 0;
    const isHighSales = avgSales > 1000;
    const isModerateSales = avgSales > 500 && avgSales <= 1000;
    const isLowSales = avgSales <= 500;
    const isRapidDecline = growthRate < -15;
    const isModerateDecline = growthRate < -5 && growthRate >= -15;
    const isSlightDecline = growthRate < 0 && growthRate >= -5;

    if (actionType === 'promote') {
        let suggestionText = '';
        
        if (isHighGrowth && isHighSales) {
            suggestionText = `
                <strong>Premium Promotion Opportunity:</strong> This product is showing exceptional performance with 
                ${growthRate.toFixed(1)}% growth and strong average sales of ${avgSales.toFixed(2)}.
                <div class="performance-metrics">
                    <strong>Key Performance Indicators:</strong>
                    <ul>
                        <li>Growth Rate: ${growthRate.toFixed(1)}% (Exceeds industry average)</li>
                        <li>Average Sales: ${avgSales.toFixed(2)} (Top tier performance)</li>
                        <li>Sales Trend: Strong upward momentum</li>
                    </ul>
                </div>
                <div class="action-items">
                    <strong>Recommended Actions:</strong>
                    <ul>
                        <li><strong>Inventory Management:</strong>
                            <ul>
                                <li>Increase stock levels by 25-30% to meet growing demand</li>
                                <li>Implement just-in-time inventory system for optimal stock levels</li>
                                <li>Set up automated reorder points based on current growth rate</li>
                            </ul>
                        </li>
                        <li><strong>Marketing Strategy:</strong>
                            <ul>
                                <li>Allocate 40% of marketing budget to this product</li>
                                <li>Launch targeted social media campaigns highlighting success metrics</li>
                                <li>Create case studies showcasing product performance</li>
                            </ul>
                        </li>
                        <li><strong>Sales Optimization:</strong>
                            <ul>
                                <li>Implement premium placement in high-traffic areas</li>
                                <li>Develop a loyalty program with tiered rewards</li>
                                <li>Create bundle offers with complementary products</li>
                            </ul>
                        </li>
                        <li><strong>Customer Engagement:</strong>
                            <ul>
                                <li>Launch a customer feedback program</li>
                                <li>Develop a referral program with incentives</li>
                                <li>Create exclusive early access for loyal customers</li>
                            </ul>
                        </li>
                    </ul>
                </div>
            `;
        } else if (isHighGrowth && (isModerateSales || isLowSales)) {
            suggestionText = `
                <strong>Growth Acceleration Opportunity:</strong> Despite lower average sales of ${avgSales.toFixed(2)}, 
                the product shows strong growth potential at ${growthRate.toFixed(1)}%.
                <div class="performance-metrics">
                    <strong>Key Performance Indicators:</strong>
                    <ul>
                        <li>Growth Rate: ${growthRate.toFixed(1)}% (Above average)</li>
                        <li>Average Sales: ${avgSales.toFixed(2)} (Room for improvement)</li>
                        <li>Sales Trend: Positive momentum</li>
                    </ul>
                </div>
                <div class="action-items">
                    <strong>Recommended Actions:</strong>
                    <ul>
                        <li><strong>Price Optimization:</strong>
                            <ul>
                                <li>Conduct competitive price analysis</li>
                                <li>Implement dynamic pricing strategy</li>
                                <li>Test price elasticity with A/B testing</li>
                            </ul>
                        </li>
                        <li><strong>Marketing Enhancement:</strong>
                            <ul>
                                <li>Increase marketing spend by 15-20%</li>
                                <li>Focus on high-converting channels</li>
                                <li>Develop targeted email campaigns</li>
                            </ul>
                        </li>
                        <li><strong>Distribution Strategy:</strong>
                            <ul>
                                <li>Expand to new market segments</li>
                                <li>Optimize channel mix</li>
                                <li>Develop strategic partnerships</li>
                            </ul>
                        </li>
                        <li><strong>Product Development:</strong>
                            <ul>
                                <li>Consider product line extensions</li>
                                <li>Develop complementary products</li>
                                <li>Implement customer feedback loop</li>
                            </ul>
                        </li>
                    </ul>
                </div>
            `;
        } else if (isModerateGrowth) {
            suggestionText = `
                <strong>Steady Growth Opportunity:</strong> The product shows consistent growth of ${growthRate.toFixed(1)}% 
                with average sales of ${avgSales.toFixed(2)}.
                <div class="performance-metrics">
                    <strong>Key Performance Indicators:</strong>
                    <ul>
                        <li>Growth Rate: ${growthRate.toFixed(1)}% (Stable growth)</li>
                        <li>Average Sales: ${avgSales.toFixed(2)} (Consistent performance)</li>
                        <li>Sales Trend: Steady improvement</li>
                    </ul>
                </div>
                <div class="action-items">
                    <strong>Recommended Actions:</strong>
                    <ul>
                        <li><strong>Pricing Strategy:</strong>
                            <ul>
                                <li>Implement 5-10% price increase</li>
                                <li>Introduce volume-based discounts</li>
                                <li>Create seasonal pricing tiers</li>
                            </ul>
                        </li>
                        <li><strong>Customer Retention:</strong>
                            <ul>
                                <li>Develop email marketing campaigns</li>
                                <li>Create customer loyalty program</li>
                                <li>Implement feedback collection system</li>
                            </ul>
                        </li>
                        <li><strong>Inventory Management:</strong>
                            <ul>
                                <li>Optimize stock levels based on growth</li>
                                <li>Implement demand forecasting</li>
                                <li>Set up automated reordering</li>
                            </ul>
                        </li>
                        <li><strong>Marketing Optimization:</strong>
                            <ul>
                                <li>Focus on high-performing channels</li>
                                <li>Develop seasonal promotions</li>
                                <li>Create targeted campaigns</li>
                            </ul>
                        </li>
                    </ul>
                </div>
            `;
        } else {
            suggestionText = `
                <strong>Stable Performance Opportunity:</strong> With ${growthRate.toFixed(1)}% growth and 
                average sales of ${avgSales.toFixed(2)}, this product shows potential for improvement.
                <div class="performance-metrics">
                    <strong>Key Performance Indicators:</strong>
                    <ul>
                        <li>Growth Rate: ${growthRate.toFixed(1)}% (Needs improvement)</li>
                        <li>Average Sales: ${avgSales.toFixed(2)} (Stable)</li>
                        <li>Sales Trend: Minimal growth</li>
                    </ul>
                </div>
                <div class="action-items">
                    <strong>Recommended Actions:</strong>
                    <ul>
                        <li><strong>Pricing Analysis:</strong>
                            <ul>
                                <li>Conduct market price research</li>
                                <li>Analyze price elasticity</li>
                                <li>Test different price points</li>
                            </ul>
                        </li>
                        <li><strong>Customer Insights:</strong>
                            <ul>
                                <li>Implement feedback program</li>
                                <li>Conduct customer surveys</li>
                                <li>Analyze purchase patterns</li>
                            </ul>
                        </li>
                        <li><strong>Product Development:</strong>
                            <ul>
                                <li>Consider product improvements</li>
                                <li>Develop new variations</li>
                                <li>Test new features</li>
                            </ul>
                        </li>
                        <li><strong>Marketing Testing:</strong>
                            <ul>
                                <li>Run A/B testing campaigns</li>
                                <li>Test new marketing channels</li>
                                <li>Optimize messaging</li>
                            </ul>
                        </li>
                    </ul>
                </div>
            `;
        }
        suggestionDiv.innerHTML = suggestionText;
    } else {
        let suggestionText = '';
        
        if (isDeclining && isHighSales) {
            suggestionText = `
                <strong>Critical Performance Review Needed:</strong> Despite high average sales of ${avgSales.toFixed(2)}, 
                the product is declining at ${Math.abs(growthRate).toFixed(1)}%.
                <div class="performance-metrics">
                    <strong>Key Performance Indicators:</strong>
                    <ul>
                        <li>Growth Rate: ${growthRate.toFixed(1)}% (Critical decline)</li>
                        <li>Average Sales: ${avgSales.toFixed(2)} (Historically strong)</li>
                        <li>Sales Trend: Significant downward trend</li>
                    </ul>
                </div>
                <div class="action-items">
                    <strong>Recommended Actions:</strong>
                    <ul>
                        <li><strong>Immediate Price Analysis:</strong>
                            <ul>
                                <li>Conduct competitive benchmarking</li>
                                <li>Analyze price sensitivity</li>
                                <li>Review pricing strategy</li>
                            </ul>
                        </li>
                        <li><strong>Marketing Review:</strong>
                            <ul>
                                <li>Audit current marketing efforts</li>
                                <li>Identify underperforming channels</li>
                                <li>Develop new marketing strategy</li>
                            </ul>
                        </li>
                        <li><strong>Customer Analysis:</strong>
                            <ul>
                                <li>Review customer feedback</li>
                                <li>Analyze complaint patterns</li>
                                <li>Conduct customer surveys</li>
                            </ul>
                        </li>
                        <li><strong>Product Strategy:</strong>
                            <ul>
                                <li>Consider product refresh</li>
                                <li>Evaluate rebranding options</li>
                                <li>Develop improvement plan</li>
                            </ul>
                        </li>
                    </ul>
                </div>
            `;
        } else if (isDeclining && (isModerateSales || isLowSales)) {
            suggestionText = `
                <strong>Urgent Strategy Review Required:</strong> The product shows concerning performance with 
                ${Math.abs(growthRate).toFixed(1)}% decline and low average sales of ${avgSales.toFixed(2)}.
                <div class="performance-metrics">
                    <strong>Key Performance Indicators:</strong>
                    <ul>
                        <li>Growth Rate: ${growthRate.toFixed(1)}% (Severe decline)</li>
                        <li>Average Sales: ${avgSales.toFixed(2)} (Below target)</li>
                        <li>Sales Trend: Critical downward trend</li>
                    </ul>
                </div>
                <div class="action-items">
                    <strong>Recommended Actions:</strong>
                    <ul>
                        <li><strong>Viability Assessment:</strong>
                            <ul>
                                <li>Evaluate market fit</li>
                                <li>Analyze competitive position</li>
                                <li>Review product lifecycle</li>
                            </ul>
                        </li>
                        <li><strong>Price Strategy:</strong>
                            <ul>
                                <li>Implement temporary price reduction</li>
                                <li>Test promotional pricing</li>
                                <li>Review margin structure</li>
                            </ul>
                        </li>
                        <li><strong>Inventory Management:</strong>
                            <ul>
                                <li>Optimize stock levels</li>
                                <li>Reduce excess inventory</li>
                                <li>Implement clearance strategy</li>
                            </ul>
                        </li>
                        <li><strong>Turnaround Plan:</strong>
                            <ul>
                                <li>Develop clear KPIs</li>
                                <li>Set short-term goals</li>
                                <li>Create action timeline</li>
                            </ul>
                        </li>
                    </ul>
                </div>
            `;
        } else if (isLowGrowth) {
            suggestionText = `
                <strong>Performance Optimization Needed:</strong> The product shows minimal growth of ${growthRate.toFixed(1)}% 
                with average sales of ${avgSales.toFixed(2)}.
                <div class="performance-metrics">
                    <strong>Key Performance Indicators:</strong>
                    <ul>
                        <li>Growth Rate: ${growthRate.toFixed(1)}% (Below target)</li>
                        <li>Average Sales: ${avgSales.toFixed(2)} (Needs improvement)</li>
                        <li>Sales Trend: Stagnant growth</li>
                    </ul>
                </div>
                <div class="action-items">
                    <strong>Recommended Actions:</strong>
                    <ul>
                        <li><strong>Product Positioning:</strong>
                            <ul>
                                <li>Review market positioning</li>
                                <li>Analyze target audience</li>
                                <li>Update value proposition</li>
                            </ul>
                        </li>
                        <li><strong>Cost Analysis:</strong>
                            <ul>
                                <li>Review acquisition costs</li>
                                <li>Optimize marketing spend</li>
                                <li>Analyze ROI by channel</li>
                            </ul>
                        </li>
                        <li><strong>Sales Strategy:</strong>
                            <ul>
                                <li>Develop bundling strategy</li>
                                <li>Create cross-selling program</li>
                                <li>Implement upselling tactics</li>
                            </ul>
                        </li>
                        <li><strong>Customer Retention:</strong>
                            <ul>
                                <li>Launch retention program</li>
                                <li>Improve customer service</li>
                                <li>Develop loyalty rewards</li>
                            </ul>
                        </li>
                    </ul>
                </div>
            `;
        } else {
            suggestionText = `
                <strong>Strategy Enhancement Required:</strong> With ${growthRate.toFixed(1)}% growth and 
                average sales of ${avgSales.toFixed(2)}, this product needs attention.
                <div class="performance-metrics">
                    <strong>Key Performance Indicators:</strong>
                    <ul>
                        <li>Growth Rate: ${growthRate.toFixed(1)}% (Needs improvement)</li>
                        <li>Average Sales: ${avgSales.toFixed(2)} (Below target)</li>
                        <li>Sales Trend: Requires attention</li>
                    </ul>
                </div>
                <div class="action-items">
                    <strong>Recommended Actions:</strong>
                    <ul>
                        <li><strong>Market Research:</strong>
                            <ul>
                                <li>Identify new opportunities</li>
                                <li>Analyze market trends</li>
                                <li>Study competitor strategies</li>
                            </ul>
                        </li>
                        <li><strong>Pricing Strategy:</strong>
                            <ul>
                                <li>Review pricing model</li>
                                <li>Analyze profit margins</li>
                                <li>Test price points</li>
                            </ul>
                        </li>
                        <li><strong>Channel Analysis:</strong>
                            <ul>
                                <li>Evaluate sales channels</li>
                                <li>Optimize distribution</li>
                                <li>Identify new channels</li>
                            </ul>
                        </li>
                        <li><strong>Product Development:</strong>
                            <ul>
                                <li>Create improvement roadmap</li>
                                <li>Plan feature updates</li>
                                <li>Develop new variations</li>
                            </ul>
                        </li>
                    </ul>
                </div>
            `;
        }
        suggestionDiv.innerHTML = suggestionText;
    }

    productInfo.appendChild(productName);
    productInfo.appendChild(productStats);
    productDiv.appendChild(productInfo);
    productDiv.appendChild(suggestionDiv);

    return productDiv;
}

// Function to handle product action button clicks - no longer needed
function handleProductAction(productId, actionType) {
    // This function is kept for backward compatibility but is no longer used
    console.log(`Action ${actionType} clicked for product ${productId}`);
}
