// Global variables to store Chart.js instances
let productChart, trendChart, severityChart, rangeChart, thresholdChart, averageChart;

// Initialize charts and data
let charts = {};
let forecastData = [];
let currentFilters = {
    limit: 'all',
    graphType: 'all'
};

// DOM Elements
const forecastLimitSelect = document.getElementById('forecastLimit');
const graphFilterSelect = document.getElementById('graphFilter');
const applyFiltersBtn = document.getElementById('applyFilters');
const resetFiltersBtn = document.getElementById('resetFilters');
const statCards = document.querySelectorAll('.stat-card');

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add event listeners
    applyFiltersBtn.addEventListener('click', applyFilters);
    resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Initial data load
    loadData();
});

// Load data from the server
async function loadData() {
    try {
        const response = await fetch('/statistics_data');
        if (!response.ok) {
            throw new Error('Failed to fetch statistics data');
        }
        forecastData = await response.json();
        updateCharts();
    } catch (error) {
        console.error('Error loading statistics:', error);
        showError('Failed to load statistics data. Please try again later.');
    }
}

// Apply filters
function applyFilters() {
    currentFilters.limit = forecastLimitSelect.value;
    currentFilters.graphType = graphFilterSelect.value;
    
    // Update charts with new limit
    updateCharts();
    
    // Update graph visibility
    filterGraphs();
}

// Reset filters
function resetFilters() {
    forecastLimitSelect.value = 'all';
    graphFilterSelect.value = 'all';
    currentFilters.limit = 'all';
    currentFilters.graphType = 'all';
    
    // Update charts with reset values
    updateCharts();
    
    // Show all graphs
    statCards.forEach(card => card.classList.remove('hidden'));
}

// Update all charts based on the selected forecast limit
function updateCharts() {
    const limit = currentFilters.limit;
    let data = forecastData;
    
    // Apply limit if not 'all'
    if (limit !== 'all') {
        data = {
            ...forecastData,
            product_analysis: limitData(forecastData.product_analysis, limit),
            trend_analysis: limitData(forecastData.trend_analysis, limit),
            severity_analysis: limitData(forecastData.severity_analysis, limit),
            prediction_ranges: limitData(forecastData.prediction_ranges, limit),
            threshold_comparison: limitData(forecastData.threshold_comparison, limit),
            average_predictions: limitData(forecastData.average_predictions, limit)
        };
    }
    
    // Update each chart
    updateProductChart(data.product_analysis);
    updateTrendChart(data.trend_analysis);
    updateSeverityChart(data.severity_analysis);
    updateRangeChart(data.prediction_ranges);
    updateThresholdChart(data.threshold_comparison);
    updateAverageChart(data.average_predictions);
}

// Helper function to limit data
function limitData(data, limit) {
    if (typeof data === 'object' && !Array.isArray(data)) {
        const entries = Object.entries(data);
        const limitedEntries = entries.slice(-parseInt(limit));
        return Object.fromEntries(limitedEntries);
    }
    return data;
}

// Filter graphs based on selection
function filterGraphs() {
    const selectedType = currentFilters.graphType;
    
    statCards.forEach(card => {
        const graphType = card.getAttribute('data-graph-type');
        if (selectedType === 'all' || graphType === selectedType) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });
}

// Show error message
function showError(message) {
    // You can implement a more sophisticated error display if needed
    alert(message);
}

// Chart update functions
function updateProductChart(data) {
    const ctx = document.getElementById('productChart').getContext('2d');
    const labels = Object.keys(data);
    const counts = labels.map(product => data[product].count);
    
    if (charts.product) {
        charts.product.destroy();
    }
    
    charts.product = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Forecasts',
                data: counts,
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
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

function updateTrendChart(data) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (charts.trend) {
        charts.trend.destroy();
    }
    
    charts.trend = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Positive', 'Negative', 'Neutral'],
            datasets: [{
                data: [data.positive, data.negative, data.neutral],
                backgroundColor: [
                    'rgba(46, 204, 113, 0.7)',  // Green for positive
                    'rgba(231, 76, 60, 0.7)',   // Red for negative
                    'rgba(149, 165, 166, 0.7)'  // Gray for neutral
                ],
                borderColor: [
                    'rgba(46, 204, 113, 1)',    // Green border
                    'rgba(231, 76, 60, 1)',     // Red border
                    'rgba(149, 165, 166, 1)'    // Gray border
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    enabled: true
                },
                datalabels: {
                    color: '#fff',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: function(value, context) {
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = Math.round((value / total) * 100);
                        return `${value}\n(${percentage}%)`;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateSeverityChart(data) {
    const ctx = document.getElementById('severityChart').getContext('2d');
    
    if (charts.severity) {
        charts.severity.destroy();
    }
    
    charts.severity = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['High', 'Medium', 'Low', 'None'],
            datasets: [{
                data: [data.high, data.medium, data.low, data.none],
                backgroundColor: [
                    'rgba(46, 204, 113, 0.7)',  // Green for high
                    'rgba(241, 196, 15, 0.7)',  // Yellow for medium
                    'rgba(231, 76, 60, 0.7)',   // Red for low
                    'rgba(149, 165, 166, 0.7)'  // Gray for none
                ],
                borderColor: [
                    'rgba(46, 204, 113, 1)',    // Green border
                    'rgba(241, 196, 15, 1)',    // Yellow border
                    'rgba(231, 76, 60, 1)',     // Red border
                    'rgba(149, 165, 166, 1)'    // Gray border
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    enabled: true
                },
                datalabels: {
                    color: '#fff',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: function(value, context) {
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = Math.round((value / total) * 100);
                        return `${value}\n(${percentage}%)`;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateRangeChart(data) {
    const ctx = document.getElementById('rangeChart').getContext('2d');
    
    if (charts.range) {
        charts.range.destroy();
    }
    
    charts.range = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: 'Number of Forecasts',
                data: Object.values(data),
                backgroundColor: [
                    'rgba(46, 204, 113, 0.7)',   // Green for 0-500
                    'rgba(52, 152, 219, 0.7)',   // Blue for 501-1000
                    'rgba(241, 196, 15, 0.7)',   // Yellow for 1001-2000
                    'rgba(231, 76, 60, 0.7)'     // Red for 2001+
                ],
                borderColor: [
                    'rgba(46, 204, 113, 1)',     // Green border
                    'rgba(52, 152, 219, 1)',     // Blue border
                    'rgba(241, 196, 15, 1)',     // Yellow border
                    'rgba(231, 76, 60, 1)'       // Red border
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true
                },
                datalabels: {
                    color: '#2c3e50',
                    anchor: 'center',
                    align: 'center',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: function(value) {
                        if (value === 0) return '';
                        return value;
                    },
                    offset: 0,
                    padding: 0
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
        },
        plugins: [ChartDataLabels]
    });
}

function updateThresholdChart(data) {
    const ctx = document.getElementById('thresholdChart').getContext('2d');
    
    if (charts.threshold) {
        charts.threshold.destroy();
    }
    
    charts.threshold = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Above Threshold', 'Below Threshold'],
            datasets: [{
                data: [data.above, data.below],
                backgroundColor: [
                    'rgba(46, 204, 113, 0.7)',
                    'rgba(231, 76, 60, 0.7)'
                ],
                borderColor: [
                    'rgba(46, 204, 113, 1)',
                    'rgba(231, 76, 60, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    enabled: true
                },
                datalabels: {
                    color: '#fff',
                    font: {
                        weight: 'bold',
                        size: 14
                    },
                    formatter: function(value, context) {
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = Math.round((value / total) * 100);
                        return `${value}\n(${percentage}%)`;
                    }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function updateAverageChart(data) {
    const ctx = document.getElementById('averageChart').getContext('2d');
    
    if (charts.average) {
        charts.average.destroy();
    }
    
    charts.average = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(data),
            datasets: [{
                label: 'Average Prediction',
                data: Object.values(data),
                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
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