// Main event listener that initializes the history page functionality when the DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    // Global state variables to store forecast data and UI state
    let forecastHistory = []; // Stores all forecast records fetched from the server
    let productList = ["all"]; // List of unique products for filtering, initialized with "all" option
    let forecastChart = null; // Reference to the Chart.js instance for displaying forecasts
    let currentDecisionsPage = 1; // Tracks current page number for paginated decisions
    const decisionsPerPage = 5; // Number of decisions to show per page in the modal
    
    // DOM element references for the modal and its components
    const modal = document.getElementById('forecast-modal'); // Main modal container for forecast details
    const closeModalBtn = document.getElementById('close-modal'); // Button to close the modal
    const forecastChartCtx = document.getElementById('forecast-chart').getContext('2d'); // Canvas context for the chart
    const prevPageBtn = document.getElementById('prev-page'); // Button to navigate to previous decisions page
    const nextPageBtn = document.getElementById('next-page'); // Button to navigate to next decisions page
    const pageInfo = document.getElementById('page-info'); // Element to display current page information
    
    // Event listener to close modal when clicking outside the modal content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Event listener to close modal when clicking the close button
    closeModalBtn.addEventListener('click', closeModal);
    
    // Event listener for previous page button in decisions pagination
    prevPageBtn.addEventListener('click', () => {
        if (currentDecisionsPage > 1) {
            currentDecisionsPage--;
            renderDecisionsPage();
        }
    });
    
    // Event listener for next page button in decisions pagination
    nextPageBtn.addEventListener('click', () => {
        const forecastId = modal.dataset.currentForecast; // Get current forecast ID from modal data
        const forecast = forecastHistory.find(f => f.id == forecastId);
        if (!forecast) return;
        
        const decisions = forecast.forecast_data.decisions || [];
        const totalPages = Math.ceil(decisions.length / decisionsPerPage);
        
        if (currentDecisionsPage < totalPages) {
            currentDecisionsPage++;
            renderDecisionsPage();
        }
    });
    
    // Function to close the modal and clean up resources
    function closeModal() {
        modal.classList.remove('active'); // Hide the modal
        currentDecisionsPage = 1; // Reset pagination to first page
        
        // Clean up chart instance to prevent memory leaks
        if (forecastChart) {
            forecastChart.destroy();
            forecastChart = null;
        }
    }
    
    // Function to open the modal and display forecast details
    function openModal(forecastId) {
        const forecast = forecastHistory.find(f => f.id == forecastId);
        if (!forecast) return;
        
        // Store current forecast ID in modal for pagination and other operations
        modal.dataset.currentForecast = forecastId;
        
        // Extract forecast data components
        const forecastData = forecast.forecast_data || {};
        const predictions = forecastData.predictions || [];
        const decisions = forecastData.decisions || [];
        const dataQuality = forecastData.data_quality || {};
        
        // Update modal title with product and forecast type
        document.getElementById('modal-title').textContent = 
            `${forecast.product === "all" ? "All Products" : forecast.product} - ${forecast.forecast_type} Forecast`;
        
        // Initialize chart with prediction data
        renderForecastChart(predictions, forecast.forecast_type);
        
        // Display paginated decisions
        renderDecisionsPage();
        
        // Render data quality metrics
        const dataQualityList = document.getElementById('data-quality-list');
        dataQualityList.innerHTML = '';
        
        // Create cards for each data quality metric
        for (const [key, value] of Object.entries(dataQuality)) {
            const item = document.createElement('div');
            item.className = 'data-quality-card';
            item.innerHTML = `
                <div class="data-quality-label">${formatLabel(key)}</div>
                <div class="data-quality-value">${formatValue(key, value)}</div>
            `;
            dataQualityList.appendChild(item);
        }
        
        // Display forecast metadata
        const forecastMeta = document.getElementById('forecast-meta');
        forecastMeta.innerHTML = `
            <div class="metadata-card">
                <div class="metadata-label">Forecast Type</div>
                <div class="metadata-value">${forecast.forecast_type}</div>
            </div>
            <div class="metadata-card">
                <div class="metadata-label">Threshold</div>
                <div class="metadata-value">${forecast.threshold}</div>
            </div>
            <div class="metadata-card">
                <div class="metadata-label">Created At</div>
                <div class="metadata-value">${new Date(forecast.created_at).toLocaleDateString()}</div>
            </div>
            ${forecast.upload_name ? `
                <div class="metadata-card">
                    <div class="metadata-label">Source File</div>
                    <div class="metadata-value">${forecast.upload_name}</div>
                </div>
            ` : ''}
        `;
        
        // Show the modal
        modal.classList.add('active');
    }
    
    // Function to render the current page of decisions in the modal
    function renderDecisionsPage() {
        const forecastId = modal.dataset.currentForecast;
        const forecast = forecastHistory.find(f => f.id == forecastId);
        if (!forecast) return;
        
        const decisions = forecast.forecast_data.decisions || [];
        const totalPages = Math.ceil(decisions.length / decisionsPerPage);
        
        // Update pagination UI elements
        pageInfo.textContent = `Page ${currentDecisionsPage} of ${totalPages}`;
        prevPageBtn.disabled = currentDecisionsPage <= 1;
        nextPageBtn.disabled = currentDecisionsPage >= totalPages;
        
        // Calculate the range of decisions to display
        const startIndex = (currentDecisionsPage - 1) * decisionsPerPage;
        const endIndex = Math.min(startIndex + decisionsPerPage, decisions.length);
        
        // Render decisions for the current page
        const decisionsList = document.getElementById('decisions-list');
        decisionsList.innerHTML = '';
        
        // Create decision elements with appropriate styling based on trend
        for (let i = startIndex; i < endIndex; i++) {
            const decision = decisions[i];
            const decisionEl = document.createElement('div');
            decisionEl.className = `decision-item ${decision.trend || 'neutral'}`;
            decisionEl.innerHTML = `
                <span class="decision-icon">${decision.icon || 'ℹ️'}</span>
                <div class="decision-text">${decision.text}</div>
            `;
            decisionsList.appendChild(decisionEl);
        }
    }
    
    // Helper function to format labels for display
    function formatLabel(key) {
        return key.replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Helper function to format values based on their type and context
    function formatValue(key, value) {
        if (typeof value === 'number') {
            if (key.includes('percent') || key.includes('completeness')) {
                return `${(value * 100).toFixed(1)}%`;
            }
            return value.toFixed(2);
        }
        return value;
    }
    
    // Function to render the forecast chart using Chart.js
    function renderForecastChart(predictions, forecastType) {
        // Clean up existing chart instance
        if (forecastChart) {
            forecastChart.destroy();
        }
        
        // Determine appropriate x-axis labels based on forecast type
        let labels = [];
        let xAxisTitle = 'Day';
        
        if (forecastType === 'weekly') {
            labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            xAxisTitle = 'Day of Week';
        } else if (forecastType === 'monthly') {
            const daysInMonth = 30;
            labels = Array.from({length: daysInMonth}, (_, i) => `Day ${i + 1}`);
            xAxisTitle = 'Day of Month';
        } else if (forecastType === 'quarterly') {
            labels = ['Week 1-2', 'Week 3-4', 'Week 5-6', 'Week 7-8', 'Week 9-10', 'Week 11-12', 'Week 13'];
            xAxisTitle = 'Week of Quarter';
        } else {
            labels = Array.from({length: predictions.length}, (_, i) => `Day ${i + 1}`);
        }
        
        // Ensure labels array matches predictions length
        labels = labels.slice(0, predictions.length);
        
        // Create new Chart.js instance with forecast data
        forecastChart = new Chart(forecastChartCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Predicted Sales',
                    data: predictions,
                    borderColor: '#6C5CE7',
                    backgroundColor: 'rgba(108, 92, 231, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Sales Forecast',
                        font: {
                            size: 16
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Sales: ${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Sales Amount'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: xAxisTitle
                        }
                    }
                }
            }
        });
    }
    
    // Initialize the page by loading forecast history
    loadForecastHistory();
    
    // Set up event listeners for UI controls
    document.getElementById("refresh-btn").addEventListener("click", loadForecastHistory);
    document.getElementById("apply-filters").addEventListener("click", applyFilters);
    
    // Function to fetch and load forecast history from the server
    function loadForecastHistory() {
        showLoading();
        
        fetch("/get_forecast_history")
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    showError(data.error);
                    return;
                }
                
                // Update global forecast history
                forecastHistory = data.history || [];
                
                // Extract unique products for filter dropdown
                const products = new Set(["all"]);
                forecastHistory.forEach(item => {
                    if (item.product && item.product !== "all") {
                        products.add(item.product);
                    }
                });
                
                productList = Array.from(products);
                updateProductFilter();
                
                // Show appropriate UI state based on data
                if (forecastHistory.length === 0) {
                    showEmptyState();
                } else {
                    renderForecastCards(forecastHistory);
                }
            })
            .catch(error => {
                console.error("Error loading history:", error);
                showError("Failed to load forecast history. Please try again.");
            });
    }
    
    // Function to apply filters to the forecast history
    function applyFilters() {
        const productFilter = document.getElementById("product-filter").value;
        const typeFilter = document.getElementById("type-filter").value;
        const dateFilter = document.getElementById("date-filter").value;
        
        let filtered = [...forecastHistory];
        
        // Apply product filter
        if (productFilter !== "all") {
            filtered = filtered.filter(item => item.product === productFilter);
        }
        
        // Apply forecast type filter
        if (typeFilter !== "all") {
            filtered = filtered.filter(item => item.forecast_type === typeFilter);
        }
        
        // Apply date filter
        if (dateFilter) {
            const filterDate = new Date(dateFilter).toISOString().split('T')[0];
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.created_at).toISOString().split('T')[0];
                return itemDate === filterDate;
            });
        }
        
        // Show appropriate UI state based on filtered results
        if (filtered.length === 0) {
            showEmptyState("No forecasts match your filters");
        } else {
            renderForecastCards(filtered);
        }
    }
    
    // Function to update the product filter dropdown with available products
    function updateProductFilter() {
        const productFilter = document.getElementById("product-filter");
        productFilter.innerHTML = "";
        
        productList.forEach(product => {
            const option = document.createElement("option");
            option.value = product;
            option.textContent = product === "all" ? "All Products" : product;
            productFilter.appendChild(option);
        });
    }
    
    // Function to render forecast cards in the main view
    function renderForecastCards(forecasts) {
        const container = document.getElementById("forecast-cards");
        container.innerHTML = "";
        
        forecasts.forEach(forecast => {
            // Extract forecast data components
            const forecastData = forecast.forecast_data || {};
            const predictions = forecastData.predictions || [];
            const decisions = forecastData.decisions || [];
            const dataQuality = forecastData.data_quality || {};
            
            // Format date for display
            const date = new Date(forecast.created_at);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            // Calculate summary statistics
            const totalSales = predictions.reduce((sum, val) => sum + val, 0).toFixed(2);
            const avgSales = predictions.length > 0 ? (totalSales / predictions.length).toFixed(2) : "0.00";
            const maxSales = predictions.length > 0 ? Math.max(...predictions).toFixed(2) : "0.00";
            
            // Count different types of decisions
            const positiveDecisions = decisions.filter(d => d.trend === "positive").length;
            const negativeDecisions = decisions.filter(d => d.trend === "negative").length;
            const neutralDecisions = decisions.filter(d => d.trend === "neutral").length;
            
            // Create and append forecast card element
            const card = document.createElement("div");
            card.className = "forecast-card";
            card.innerHTML = `
                <div class="forecast-header">
                    <h3 class="forecast-title">${forecast.forecast_type ? forecast.forecast_type.charAt(0).toUpperCase() + forecast.forecast_type.slice(1) : 'Unknown'} Forecast</h3>
                    <span class="forecast-date">${formattedDate}</span>
                </div>
                
                <div class="forecast-meta">
                    <span class="forecast-product">${forecast.product === "all" ? "All Products" : forecast.product || "Unknown"}</span>
                    ${forecast.upload_name ? `<span class="forecast-source">From: ${forecast.upload_name}</span>` : ''}
                </div>
                
                <div class="forecast-stats">
                    <div class="stat-item">
                        <div class="stat-value">${predictions.length}</div>
                        <div class="stat-label">Days</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${totalSales}</div>
                        <div class="stat-label">Total Sales</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${maxSales}</div>
                        <div class="stat-label">Peak Sales</div>
                    </div>
                </div>
                
                <div class="forecast-insights">
                    <div class="insight positive">
                        <span class="insight-count">${positiveDecisions}</span>
                        <span class="insight-label">Positive Trends</span>
                    </div>
                    <div class="insight negative">
                        <span class="insight-count">${negativeDecisions}</span>
                        <span class="insight-label">Negative Trends</span>
                    </div>
                    <div class="insight neutral">
                        <span class="insight-count">${neutralDecisions}</span>
                        <span class="insight-label">Neutral</span>
                    </div>
                </div>
                
                <div class="forecast-actions">
                    <button class="view-btn" data-id="${forecast.id}">
                        <span>👁️</span> View Details
                    </button>
                    <button class="primary export-btn" data-id="${forecast.id}">
                        <span>📤</span> Export
                    </button>
                </div>
            `;
            
            container.appendChild(card);
        });
        
        // Add event listeners to the newly created buttons
        document.querySelectorAll(".view-btn").forEach(btn => {
            btn.addEventListener("click", () => viewForecast(btn.dataset.id));
        });
        
        document.querySelectorAll(".export-btn").forEach(btn => {
            btn.addEventListener("click", () => exportForecast(btn.dataset.id));
        });
    }
    
    // Function to handle viewing forecast details
    function viewForecast(forecastId) {
        openModal(forecastId);
    }
    
    // Function to handle exporting forecast data
    function exportForecast(forecastId) {
        window.open(`/export_forecast/${forecastId}`, '_blank');
    }
    
    // Function to show loading state while fetching data
    function showLoading() {
        const container = document.getElementById("forecast-cards");
        container.innerHTML = `
            <div class="loading">
                <div>⏳</div>
                <p>Loading your forecast history...</p>
            </div>
        `;
    }
    
    // Function to show empty state when no forecasts are available
    function showEmptyState(message = "You haven't generated any forecasts yet") {
        const container = document.getElementById("forecast-cards");
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p class="empty-state-text">${message}</p>
                <button class="action-btn" onclick="window.location.href='/forecast'">
                    <span>✨</span> Create Your First Forecast
                </button>
            </div>
        `;
    }
    
    // Function to show error state when something goes wrong
    function showError(message) {
        const container = document.getElementById("forecast-cards");
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <p class="empty-state-text">${message}</p>
                <button onclick="window.location.reload()" class="action-btn">
                    <span>🔄</span> Try Again
                </button>
            </div>
        `;
    }
});