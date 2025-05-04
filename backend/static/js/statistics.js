// Global variables to store Chart.js instances
let productChart, trendChart, severityChart, monthlyChart, rangeChart, typeChart, thresholdChart, averageChart;

// Tooltip data for each chart
const chartTooltips = {
    productChart: {
        title: 'Product Performance',
        description: 'Shows the distribution of forecasts across different products, helping identify which products are being forecasted most frequently.'
    },
    trendChart: {
        title: 'Trend Analysis',
        description: 'Displays the proportion of positive, negative, and neutral trends in your forecasts, helping identify overall market direction.'
    },
    severityChart: {
        title: 'Severity Analysis',
        description: 'Shows the distribution of forecast severity levels, helping identify the frequency of high-impact predictions.'
    },
    monthlyChart: {
        title: 'Forecast Activity Timeline',
        description: 'Tracks the number of forecasts generated each month, helping identify patterns in forecasting activity over time.'
    },
    rangeChart: {
        title: 'Sales Volume Distribution',
        description: 'Shows the distribution of predicted sales volumes across different ranges, helping identify typical sales patterns.'
    },
    typeChart: {
        title: 'Forecast Methodology',
        description: 'Shows the distribution of different forecast types used, helping understand the variety of forecasting approaches employed.'
    },
    thresholdChart: {
        title: 'Performance Against Targets',
        description: 'Compares predictions against set thresholds, helping identify how often forecasts exceed or fall below target values.'
    },
    averageChart: {
        title: 'Product Performance Averages',
        description: 'Shows the average predicted sales for each product, helping identify which products typically have higher or lower sales forecasts.'
    }
};

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    document.body.appendChild(tooltip);

    // Add event listeners for all chart titles
    Object.keys(chartTooltips).forEach(chartId => {
        const chartElement = document.getElementById(chartId);
        if (chartElement) {
            const titleElement = chartElement.closest('.stat-card').querySelector('h3');
            
            titleElement.addEventListener('mouseenter', function(e) {
                const tooltipData = chartTooltips[chartId];
                tooltip.innerHTML = `
                    <div class="tooltip-title">${tooltipData.title}</div>
                    <div class="tooltip-description">${tooltipData.description}</div>
                `;
                tooltip.style.display = 'block';
            });

            titleElement.addEventListener('mousemove', function(e) {
                tooltip.style.left = (e.pageX + 10) + 'px';
                tooltip.style.top = (e.pageY + 10) + 'px';
            });

            titleElement.addEventListener('mouseleave', function() {
                tooltip.style.display = 'none';
            });
        }
    });

    fetchStatisticsData();
});

// Fetch statistics data from the server
function fetchStatisticsData() {
    fetch('/statistics_data')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error fetching statistics:', data.error);
                return;
            }
            
            // Create all charts
            createProductChart(data.product_analysis);
            createTrendChart(data.trend_analysis);
            createSeverityChart(data.severity_analysis);
            createMonthlyChart(data.monthly_forecasts);
            createRangeChart(data.prediction_ranges);
            createTypeChart(data.forecast_types);
            createThresholdChart(data.threshold_comparison);
            createAverageChart(data.average_predictions);
        })
        .catch(error => {
            console.error('Error fetching statistics data:', error);
        });
}

// Create product performance chart
function createProductChart(productData) {
    const ctx = document.getElementById('productChart').getContext('2d');
    const products = Object.keys(productData);
    const counts = products.map(product => productData[product].count);
    
    productChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: products,
            datasets: [{
                label: 'Number of Forecasts',
                data: counts,
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Forecasts by Product',
                    tooltip: {
                        callbacks: {
                            title: function() {
                                return 'Product Performance';
                            },
                            label: function() {
                                return 'Shows the distribution of forecasts across different products, helping identify which products are being forecasted most frequently.';
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Create trend analysis chart
function createTrendChart(trendData) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    trendChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Positive', 'Negative', 'Neutral'],
            datasets: [{
                data: [trendData.positive, trendData.negative, trendData.neutral],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(255, 206, 86, 0.8)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 206, 86, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Trend Distribution',
                    tooltip: {
                        callbacks: {
                            title: function() {
                                return 'Trend Analysis';
                            },
                            label: function() {
                                return 'Displays the proportion of positive, negative, and neutral trends in your forecasts, helping identify overall market direction.';
                            }
                        }
                    }
                }
            }
        }
    });
}

// Create severity distribution chart
function createSeverityChart(severityData) {
    const ctx = document.getElementById('severityChart').getContext('2d');
    
    severityChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['High', 'Medium', 'Low', 'None'],
            datasets: [{
                data: [severityData.high, severityData.medium, severityData.low, severityData.none],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(255, 159, 64, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Severity Distribution',
                    tooltip: {
                        callbacks: {
                            title: function() {
                                return 'Severity Analysis';
                            },
                            label: function() {
                                return 'Shows the distribution of forecast severity levels, helping identify the frequency of high-impact predictions.';
                            }
                        }
                    }
                }
            }
        }
    });
}

// Create monthly forecasts chart
function createMonthlyChart(monthlyData) {
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    
    // Convert monthly data to array of objects for sorting
    const monthlyArray = Object.entries(monthlyData).map(([month, count]) => ({
        month,
        count,
        // Create a date object for sorting (using first day of each month)
        date: new Date(month)
    }));
    
    // Sort by date
    monthlyArray.sort((a, b) => a.date - b.date);
    
    // Extract sorted months and counts
    const months = monthlyArray.map(item => item.month);
    const counts = monthlyArray.map(item => item.count);
    
    monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Number of Forecasts',
                data: counts,
                fill: false,
                borderColor: 'rgba(153, 102, 255, 0.8)',
                tension: 0.1,
                backgroundColor: 'rgba(153, 102, 255, 0.1)',
                pointBackgroundColor: 'rgba(153, 102, 255, 0.8)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Monthly Forecast Activity',
                    tooltip: {
                        callbacks: {
                            title: function() {
                                return 'Forecast Activity Timeline';
                            },
                            label: function() {
                                return 'Tracks the number of forecasts generated each month, helping identify patterns in forecasting activity over time.';
                            }
                        }
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
                    cornerRadius: 5
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// Create prediction ranges chart
function createRangeChart(rangeData) {
    const ctx = document.getElementById('rangeChart').getContext('2d');
    
    rangeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['0-500', '501-1000', '1001-2000', '2001+'],
            datasets: [{
                label: 'Number of Predictions',
                data: [
                    rangeData['0-500'],
                    rangeData['501-1000'],
                    rangeData['1001-2000'],
                    rangeData['2001+']
                ],
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Prediction Ranges',
                    tooltip: {
                        callbacks: {
                            title: function() {
                                return 'Sales Volume Distribution';
                            },
                            label: function() {
                                return 'Shows the distribution of predicted sales volumes across different ranges, helping identify typical sales patterns.';
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Create forecast types chart
function createTypeChart(typeData) {
    const ctx = document.getElementById('typeChart').getContext('2d');
    const types = Object.keys(typeData);
    const counts = Object.values(typeData);
    
    typeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: types,
            datasets: [{
                data: counts,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Forecast Types Distribution',
                    tooltip: {
                        callbacks: {
                            title: function() {
                                return 'Forecast Methodology';
                            },
                            label: function() {
                                return 'Shows the distribution of different forecast types used, helping understand the variety of forecasting approaches employed.';
                            }
                        }
                    }
                }
            }
        }
    });
}

// Create threshold comparison chart
function createThresholdChart(thresholdData) {
    const ctx = document.getElementById('thresholdChart').getContext('2d');
    
    thresholdChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Above Threshold', 'Below Threshold'],
            datasets: [{
                data: [thresholdData.above, thresholdData.below],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 99, 132, 0.8)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 99, 132, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Threshold Comparison',
                    tooltip: {
                        callbacks: {
                            title: function() {
                                return 'Performance Against Targets';
                            },
                            label: function() {
                                return 'Compares predictions against set thresholds, helping identify how often forecasts exceed or fall below target values.';
                            }
                        }
                    }
                }
            }
        }
    });
}

// Create average predictions chart
function createAverageChart(averageData) {
    const ctx = document.getElementById('averageChart').getContext('2d');
    const products = Object.keys(averageData);
    const averages = Object.values(averageData);
    
    averageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: products,
            datasets: [{
                label: 'Average Prediction',
                data: averages,
                backgroundColor: 'rgba(75, 192, 192, 0.8)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Average Predictions by Product',
                    tooltip: {
                        callbacks: {
                            title: function() {
                                return 'Product Performance Averages';
                            },
                            label: function() {
                                return 'Shows the average predicted sales for each product, helping identify which products typically have higher or lower sales forecasts.';
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
} 