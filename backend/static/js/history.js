document.addEventListener("DOMContentLoaded", () => {
    let forecastHistory = [];
    let productList = ["all"];
    let forecastChart = null;
    let currentDecisionsPage = 1;
    const decisionsPerPage = 5;
    
    // Modal elements
    const modal = document.getElementById('forecast-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const forecastChartCtx = document.getElementById('forecast-chart').getContext('2d');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    // Close modal when clicking outside content
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close modal with button
    closeModalBtn.addEventListener('click', closeModal);
    
    // Pagination controls
    prevPageBtn.addEventListener('click', () => {
        if (currentDecisionsPage > 1) {
            currentDecisionsPage--;
            renderDecisionsPage();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        const forecastId = modal.dataset.currentForecast;
        const forecast = forecastHistory.find(f => f.id == forecastId);
        if (!forecast) return;
        
        const decisions = forecast.forecast_data.decisions || [];
        const totalPages = Math.ceil(decisions.length / decisionsPerPage);
        
        if (currentDecisionsPage < totalPages) {
            currentDecisionsPage++;
            renderDecisionsPage();
        }
    });
    
    function closeModal() {
        modal.classList.remove('active');
        currentDecisionsPage = 1;
        
        // Destroy chart when modal closes
        if (forecastChart) {
            forecastChart.destroy();
            forecastChart = null;
        }
    }
    
    function openModal(forecastId) {
        const forecast = forecastHistory.find(f => f.id == forecastId);
        if (!forecast) return;
        
        // Store current forecast ID in modal dataset
        modal.dataset.currentForecast = forecastId;
        
        const forecastData = forecast.forecast_data || {};
        const predictions = forecastData.predictions || [];
        const decisions = forecastData.decisions || [];
        const dataQuality = forecastData.data_quality || {};
        
        // Set modal title
        document.getElementById('modal-title').textContent = 
            `${forecast.product === "all" ? "All Products" : forecast.product} - ${forecast.forecast_type} Forecast`;
        
        // Render chart
        renderForecastChart(predictions, forecast.forecast_type);
        
        // Render decisions with pagination
        renderDecisionsPage();
        
        // Render data quality
        const dataQualityList = document.getElementById('data-quality-list');
        dataQualityList.innerHTML = '';
        
        for (const [key, value] of Object.entries(dataQuality)) {
            const item = document.createElement('div');
            item.className = 'data-quality-card';
            item.innerHTML = `
                <div class="data-quality-label">${formatLabel(key)}</div>
                <div class="data-quality-value">${formatValue(key, value)}</div>
            `;
            dataQualityList.appendChild(item);
        }
        
        // Render forecast metadata
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
        
        // Show modal
        modal.classList.add('active');
    }
    
    function renderDecisionsPage() {
        const forecastId = modal.dataset.currentForecast;
        const forecast = forecastHistory.find(f => f.id == forecastId);
        if (!forecast) return;
        
        const decisions = forecast.forecast_data.decisions || [];
        const totalPages = Math.ceil(decisions.length / decisionsPerPage);
        
        // Update pagination controls
        pageInfo.textContent = `Page ${currentDecisionsPage} of ${totalPages}`;
        prevPageBtn.disabled = currentDecisionsPage <= 1;
        nextPageBtn.disabled = currentDecisionsPage >= totalPages;
        
        // Calculate start and end index for current page
        const startIndex = (currentDecisionsPage - 1) * decisionsPerPage;
        const endIndex = Math.min(startIndex + decisionsPerPage, decisions.length);
        
        // Render decisions for current page
        const decisionsList = document.getElementById('decisions-list');
        decisionsList.innerHTML = '';
        
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
    
    function formatLabel(key) {
        return key.replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    
    function formatValue(key, value) {
        if (typeof value === 'number') {
            if (key.includes('percent') || key.includes('completeness')) {
                return `${(value * 100).toFixed(1)}%`;
            }
            return value.toFixed(2);
        }
        return value;
    }
    
    function renderForecastChart(predictions, forecastType) {
        // Destroy existing chart if it exists
        if (forecastChart) {
            forecastChart.destroy();
        }
        
        // Determine x-axis labels based on forecast type
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
        
        // Limit labels to predictions length
        labels = labels.slice(0, predictions.length);
        
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
    
    // Load history when page loads
    loadForecastHistory();
    
    // Setup refresh button
    document.getElementById("refresh-btn").addEventListener("click", loadForecastHistory);
    
    // Setup filter button
    document.getElementById("apply-filters").addEventListener("click", applyFilters);
    
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
                
                forecastHistory = data.history || [];
                
                // Extract unique products for filter
                const products = new Set(["all"]);
                forecastHistory.forEach(item => {
                    if (item.product && item.product !== "all") {
                        products.add(item.product);
                    }
                });
                
                productList = Array.from(products);
                updateProductFilter();
                
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
    
    function applyFilters() {
        const productFilter = document.getElementById("product-filter").value;
        const typeFilter = document.getElementById("type-filter").value;
        const dateFilter = document.getElementById("date-filter").value;
        
        let filtered = [...forecastHistory];
        
        if (productFilter !== "all") {
            filtered = filtered.filter(item => item.product === productFilter);
        }
        
        if (typeFilter !== "all") {
            filtered = filtered.filter(item => item.forecast_type === typeFilter);
        }
        
        if (dateFilter) {
            const filterDate = new Date(dateFilter).toISOString().split('T')[0];
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.created_at).toISOString().split('T')[0];
                return itemDate === filterDate;
            });
        }
        
        if (filtered.length === 0) {
            showEmptyState("No forecasts match your filters");
        } else {
            renderForecastCards(filtered);
        }
    }
    
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
    
    function renderForecastCards(forecasts) {
        const container = document.getElementById("forecast-cards");
        container.innerHTML = "";
        
        forecasts.forEach(forecast => {
            const forecastData = forecast.forecast_data || {};
            const predictions = forecastData.predictions || [];
            const decisions = forecastData.decisions || [];
            const dataQuality = forecastData.data_quality || {};
            
            const date = new Date(forecast.created_at);
            const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            // Calculate summary stats
            const totalSales = predictions.reduce((sum, val) => sum + val, 0).toFixed(2);
            const avgSales = predictions.length > 0 ? (totalSales / predictions.length).toFixed(2) : "0.00";
            const maxSales = predictions.length > 0 ? Math.max(...predictions).toFixed(2) : "0.00";
            
            // Count decision types
            const positiveDecisions = decisions.filter(d => d.trend === "positive").length;
            const negativeDecisions = decisions.filter(d => d.trend === "negative").length;
            const neutralDecisions = decisions.filter(d => d.trend === "neutral").length;
            
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
        
        // Add event listeners to the new buttons
        document.querySelectorAll(".view-btn").forEach(btn => {
            btn.addEventListener("click", () => viewForecast(btn.dataset.id));
        });
        
        document.querySelectorAll(".export-btn").forEach(btn => {
            btn.addEventListener("click", () => exportForecast(btn.dataset.id));
        });
    }
    
    function viewForecast(forecastId) {
    openModal(forecastId);
}
    
    function exportForecast(forecastId) {
    // Open the export directly as CSV
    window.open(`/export_forecast/${forecastId}`, '_blank');
}
    
    function showLoading() {
        const container = document.getElementById("forecast-cards");
        container.innerHTML = `
            <div class="loading">
                <div>⏳</div>
                <p>Loading your forecast history...</p>
            </div>
        `;
    }
    
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