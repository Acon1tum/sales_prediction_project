// Global variables to store Chart.js instances
let productChart, trendChart, severityChart, rangeChart, thresholdChart, averageChart;

// Initialize charts and data
let charts = {};
let forecastData = [];
let currentFilters = {
    limit: 'all',
    graphType: 'all',
    product: 'all'
};

// DOM Elements
const forecastLimitSelect = document.getElementById('forecastLimit');
const graphFilterSelect = document.getElementById('graphFilter');
const productFilterSelect = document.getElementById('productFilter');
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
        
        // Update product filter options
        updateProductFilter(forecastData);
        
        updateCharts();
    } catch (error) {
        console.error('Error loading statistics:', error);
        showError('Failed to load statistics data. Please try again later.');
    }
}

// Update product filter options
function updateProductFilter(data) {
    const productFilter = document.getElementById('productFilter');
    if (!productFilter) return;

    // Get unique products from the data
    const products = new Set();
    if (data.product_analysis) {
        Object.keys(data.product_analysis).forEach(product => {
            if (product !== 'all') {
                products.add(product);
            }
        });
    }

    // Clear existing options except "All Products"
    productFilter.innerHTML = '<option value="all" selected>All Products</option>';

    // Add product options
    products.forEach(product => {
        const option = document.createElement('option');
        option.value = product;
        option.textContent = product;
        productFilter.appendChild(option);
    });
}

// Apply filters
function applyFilters() {
    currentFilters.limit = forecastLimitSelect.value;
    currentFilters.graphType = graphFilterSelect.value;
    currentFilters.product = productFilterSelect.value;
    
    // Update charts with new filters
    updateCharts();
    
    // Update graph visibility
    filterGraphs();
}

// Reset filters
function resetFilters() {
    forecastLimitSelect.value = 'all';
    graphFilterSelect.value = 'all';
    productFilterSelect.value = 'all';
    currentFilters.limit = 'all';
    currentFilters.graphType = 'all';
    currentFilters.product = 'all';
    
    // Update charts with reset values
    updateCharts();
    
    // Show all graphs
    statCards.forEach(card => card.classList.remove('hidden'));
}

// Update all charts based on the selected filters
function updateCharts() {
    const limit = currentFilters.limit;
    const selectedProduct = currentFilters.product;
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

    // Filter data by product if not 'all'
    if (selectedProduct !== 'all') {
        data = filterDataByProduct(data, selectedProduct);
    }
    
    // Update each chart
    updateProductChart(data.product_analysis);
    updateTrendChart(data.trend_analysis);
    updateSeverityChart(data.severity_analysis);
    updateRangeChart(data.prediction_ranges);
    updateThresholdChart(data.threshold_comparison);
    updateAverageChart(data.average_predictions);
}

// Filter data by selected product
function filterDataByProduct(data, product) {
    const filteredData = {
        ...data,
        product_analysis: {},
        trend_analysis: { positive: 0, negative: 0, neutral: 0 },
        severity_analysis: { high: 0, medium: 0, low: 0, none: 0 },
        prediction_ranges: { '0-500': 0, '501-1000': 0, '1001-2000': 0, '2001+': 0 },
        threshold_comparison: { above: 0, below: 0 },
        average_predictions: {}
    };

    // Filter product analysis
    if (data.product_analysis[product]) {
        filteredData.product_analysis[product] = data.product_analysis[product];
    }

    // Filter average predictions
    if (data.average_predictions[product]) {
        filteredData.average_predictions[product] = data.average_predictions[product];
    }

    // Return filtered data
    return filteredData;
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

    // Get product-specific data from the product analysis
    const productData = {};
    if (forecastData.product_analysis) {
        Object.entries(forecastData.product_analysis).forEach(([product, productInfo]) => {
            if (product !== 'all') {
                productData[product] = {
                    '0-500': 0,
                    '501-1000': 0,
                    '1001-2000': 0,
                    '2001+': 0
                };
                
                // Categorize predictions into ranges
                productInfo.predictions.forEach(prediction => {
                    if (prediction <= 500) {
                        productData[product]['0-500']++;
                    } else if (prediction <= 1000) {
                        productData[product]['501-1000']++;
                    } else if (prediction <= 2000) {
                        productData[product]['1001-2000']++;
                    } else {
                        productData[product]['2001+']++;
                    }
                });
            }
        });
    }

    const labels = ['0-500', '501-1000', '1001-2000', '2001+'];
    const datasets = Object.entries(productData).map(([product, ranges], index) => ({
        label: product,
        data: labels.map(range => ranges[range]),
        backgroundColor: getProductColor(index, 0.7),
        borderColor: getProductColor(index, 1),
        borderWidth: 1
    }));

    charts.range = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    align: 'start',
                    labels: {
                        padding: 20,
                        boxWidth: 15,
                        boxHeight: 15,
                        font: {
                            size: 11
                        },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    },
                    maxHeight: 150,
                    maxWidth: 800
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw} forecasts`;
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            },
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Sales Range (₱)',
                        font: {
                            weight: 'bold'
                        }
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Forecasts',
                        font: {
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            layout: {
                padding: {
                    bottom: 10
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

// Helper function to get consistent colors for products
function getProductColor(index, alpha) {
    const colors = [
        `rgba(46, 204, 113, ${alpha})`,    // Green
        `rgba(52, 152, 219, ${alpha})`,    // Blue
        `rgba(241, 196, 15, ${alpha})`,    // Yellow
        `rgba(231, 76, 60, ${alpha})`,     // Red
        `rgba(155, 89, 182, ${alpha})`,    // Purple
        `rgba(52, 73, 94, ${alpha})`,      // Dark Gray
        `rgba(26, 188, 156, ${alpha})`,    // Turquoise
        `rgba(230, 126, 34, ${alpha})`,    // Orange
        `rgba(149, 165, 166, ${alpha})`,   // Light Gray
        `rgba(192, 57, 43, ${alpha})`,     // Dark Red
        `rgba(41, 128, 185, ${alpha})`,    // Dark Blue
        `rgba(142, 68, 173, ${alpha})`,    // Dark Purple
        `rgba(39, 174, 96, ${alpha})`,     // Dark Green
        `rgba(211, 84, 0, ${alpha})`,      // Dark Orange
        `rgba(22, 160, 133, ${alpha})`,    // Dark Turquoise
        `rgba(243, 156, 18, ${alpha})`,    // Dark Yellow
        `rgba(127, 140, 141, ${alpha})`,   // Medium Gray
        `rgba(44, 62, 80, ${alpha})`,      // Navy Blue
        `rgba(248, 196, 113, ${alpha})`,   // Light Orange
        `rgba(116, 185, 255, ${alpha})`,   // Light Blue
        `rgba(162, 217, 206, ${alpha})`,   // Soft Turquoise
        `rgba(255, 118, 117, ${alpha})`,   // Coral
        `rgba(253, 203, 110, ${alpha})`,   // Soft Yellow
        `rgba(119, 139, 235, ${alpha})`,   // Periwinkle
        `rgba(129, 236, 236, ${alpha})`,   // Aqua
        `rgba(130, 88, 159, ${alpha})`,    // Royal Purple
        `rgba(255, 177, 66, ${alpha})`,    // Marigold
        `rgba(85, 230, 193, ${alpha})`,    // Mint
        `rgba(99, 205, 218, ${alpha})`,    // Sky Blue
        `rgba(255, 107, 129, ${alpha})`,   // Salmon
        `rgba(238, 90, 36, ${alpha})`,     // Burnt Orange
        `rgba(0, 210, 211, ${alpha})`,     // Teal
        `rgba(83, 82, 237, ${alpha})`,     // Electric Blue
        `rgba(225, 112, 85, ${alpha})`,    // Terra Cotta
        `rgba(255, 159, 243, ${alpha})`,   // Pink
        `rgba(46, 213, 115, ${alpha})`,    // Fresh Green
        `rgba(204, 174, 98, ${alpha})`,    // Gold
        `rgba(125, 95, 255, ${alpha})`,    // Indigo
        `rgba(0, 184, 148, ${alpha})`,     // Emerald
        `rgba(255, 118, 117, ${alpha})`    // Watermelon
    ];
    return colors[index];  // No modulo operator to ensure unique colors
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