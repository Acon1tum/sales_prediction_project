document.addEventListener("DOMContentLoaded", () => {
    // Register the datalabels plugin globally
    Chart.register(ChartDataLabels);

    let areDataLabelsGloballyVisible = true; // State for global datalabel visibility

    // Handle user guide toggle
    const guideToggle = document.querySelector('.guide-toggle');
    const guideContent = document.querySelector('.guide-content');
    
    if (guideToggle && guideContent) {
        guideToggle.addEventListener('click', () => {
            guideContent.classList.toggle('active');
        });
    }

    // Handle user guide modal
    const guideIcon = document.getElementById('guide-icon');
    const guideModal = document.getElementById('guide-modal');
    const closeModal = document.querySelector('.close-modal');

    guideIcon.addEventListener('click', () => {
        guideModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    closeModal.addEventListener('click', () => {
        guideModal.classList.remove('active');
        document.body.style.overflow = '';
    });

    guideModal.addEventListener('click', (e) => {
        if (e.target === guideModal) {
            guideModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Global state variables to store application data
    let predictions = []; // Array to store sales predictions
    let decisions = []; // Array to store business decisions/recommendations
    let currentPage = 0; // Current page number for pagination
    const itemsPerPage = 3; // Number of decisions to show per page
    let productList = ["all"]; // List of available products, initialized with "all" option
    let selectedProduct = "all"; // Currently selected product for filtering
    let forecastChart = null; // Chart.js instance for forecast visualization
    let predictionsChart = null; // Chart.js instance for predictions visualization
    let historicalChart = null; // Chart.js instance for historical visualization
    let pastSalesChart = null; // Chart.js instance for past sales visualization
    let predictedSalesChart = null; // Chart.js instance for predicted sales visualization

    // Get references to important DOM elements for manipulation
    const uploadBtn = document.getElementById("upload-btn"); // File upload button
    const generateBtn = document.getElementById("generate-btn"); // Forecast generation button
    const productSelect = document.getElementById("product-select"); // Product selection dropdown
    const decisionSection = document.getElementById("decision-section"); // Container for decisions display
    const prevBtn = document.getElementById("prev-btn"); // Previous page button for pagination
    const nextBtn = document.getElementById("next-btn"); // Next page button for pagination
    const pageIndicator = document.getElementById("page-indicator"); // Page number indicator
    const exportBtn = document.getElementById("export-btn"); // Export report button
    const productSelector = document.getElementById('product-selector');
    const toggleDataLabelsBtn = document.getElementById('toggle-datalabels-btn'); // Get the new button

    // Create export button if it doesn't exist in the DOM
    if (!exportBtn) {
        const actionsDiv = document.querySelector('.actions'); // Get the actions container
        const exportButton = document.createElement('button'); // Create new button element
        exportButton.innerHTML = '<span>📤</span> Export Report'; // Set button content
        exportButton.className = 'action-btn'; // Add styling class
        exportButton.id = 'export-btn'; // Set unique identifier
        exportButton.disabled = true; // Initially disabled until forecast is generated
        actionsDiv.appendChild(exportButton); // Add button to the DOM
    }

    // Add event listener for the legend toggle button
    if (toggleDataLabelsBtn) {
        toggleDataLabelsBtn.addEventListener('click', () => {
            const forecastLegend = document.getElementById('forecastChart-legend');
            const predictionsLegend = document.getElementById('predictionsChart-legend');
            const pastSalesLegend = document.getElementById('pastSalesChart-legend');
            const predictedSalesLegend = document.getElementById('predictedSalesChart-legend');
            const isHidden = forecastLegend.classList.contains('hidden');
            if (isHidden) {
                forecastLegend.classList.remove('hidden');
                predictionsLegend.classList.remove('hidden');
                if (pastSalesLegend) pastSalesLegend.classList.remove('hidden');
                if (predictedSalesLegend) predictedSalesLegend.classList.remove('hidden');
                toggleDataLabelsBtn.innerHTML = '<span>👁️</span> Hide Values List';
            } else {
                forecastLegend.classList.add('hidden');
                predictionsLegend.classList.add('hidden');
                if (pastSalesLegend) pastSalesLegend.classList.add('hidden');
                if (predictedSalesLegend) predictedSalesLegend.classList.add('hidden');
                toggleDataLabelsBtn.innerHTML = '<span>✏️</span> Show Values List';
            }
        });
    }

    // Initialize the application with an empty state
    showEmptyState();
    fetchHistoricalData(); // Fetch historical data on page load

    // Add event listener for threshold setting button
    document.getElementById("threshold-btn").addEventListener("click", () => {
        // Get current threshold from localStorage or empty string if not set
        const currentThreshold = localStorage.getItem('forecastThreshold') || '';
        // Prompt user for new threshold value
        const threshold = prompt("Enter your desired sales threshold (e.g., 1000):", currentThreshold);
        
        // If user provided a value and it's not empty
        if (threshold !== null && threshold.trim() !== "") {
            // Validate that the input is a number
            if (!isNaN(threshold)) {
                // Send threshold to server
                fetch("/set_threshold", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ threshold: threshold.trim() })
                })
                .then(response => response.json())
                .then(data => {
                    // Store threshold in localStorage for persistence
                    localStorage.setItem('forecastThreshold', threshold.trim());
                    showToast(data.message, 'success');
                })
                .catch(error => {
                    console.error(error);
                    showToast("Failed to set threshold", 'error');
                });
            } else {
                showToast("Please enter a valid number", 'error');
            }
        }
    });

    // Add event listener for file upload
    uploadBtn.addEventListener("change", function() {
        // Return if no file is selected
        if (!this.files.length) {
            generateBtn.disabled = true;
            return;
        }

        // Create FormData object for file upload
        const formData = new FormData();
        formData.append("file", this.files[0]);
        
        // Show loading state while uploading
        showLoading("Uploading and processing data...");
        
        // Send file to server
        fetch("/upload_csv", { 
            method: "POST", 
            body: formData 
        })
        .then(response => response.json())
        .then(data => {
            // Handle error response
            if (data.error) {
                showToast(data.error, 'error');
                generateBtn.disabled = true;
                return;
            }
            
            // Store past sales data for comparison
            window.pastSalesData = data.past_sales || [];
            
            // Show success message and enable generate button
            showToast(data.message, 'success');
            generateBtn.disabled = false;
            
            // Update product list if provided by server
            if (data.product_list) {
                productList = ["all", ...data.product_list];
                updateProductDropdown();
            }

            // Update comparison charts
            updateComparisonCharts();

            document.getElementById('forecastChart-legend').classList.remove('hidden');
            document.getElementById('predictionsChart-legend').classList.remove('hidden');
            toggleDataLabelsBtn.innerHTML = '<span>👁️</span> Hide Values List';
        })
        .catch(error => {
            console.error(error);
            showToast("Failed to upload file", 'error');
            generateBtn.disabled = true;
        })
        .finally(() => {
            hideLoading();
        });
    });

    // Add event listener for product selection changes
    productSelect.addEventListener("change", function() {
        selectedProduct = this.value; // Update selected product
        updateProductBadges(); // Update UI to reflect selection
        updateHistoricalChart(); // Update historical chart with new product filter
        updateComparisonCharts(); // Add this call to update comparison charts on product change
    });

    // Add event listener for forecast generation
    generateBtn.addEventListener("click", () => {
        // Prevent click if button is disabled
        if (generateBtn.disabled) {
            showToast("Please upload a CSV file first", 'warning');
            return;
        }

        // Validate that data is available
        if (!uploadBtn.files.length && productList.length <= 1) {
            showToast("Please upload a CSV file first", 'warning');
            return;
        }
        
        // Show loading state
        showLoading("Generating forecast...");
        
        // Send request to generate forecast
        fetch("/generate_forecast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product: selectedProduct })
        })
        .then(response => response.json())
        .then(data => {
            // Handle error response
            if (data.error) {
                showToast(data.error, 'error');
                return;
            }

            // Update application state with new data
            predictions = data.predictions || [];
            decisions = data.decisions || [];
            
            // Update product list if provided
            if (data.product_list) {
                productList = ["all", ...data.product_list];
                updateProductDropdown();
            }
            
            // Update all UI components
            updateCharts();
            updateDecisions();
            updateTotalSales();
            updateProductBadges();
            
            // Enable export functionality
            document.getElementById('export-btn').disabled = false;
            // Show the toggle datalabels button
            if (toggleDataLabelsBtn) toggleDataLabelsBtn.classList.remove('hidden');
            
            showToast("Forecast generated successfully!", 'success');

            document.getElementById('forecastChart-legend').classList.remove('hidden');
            document.getElementById('predictionsChart-legend').classList.remove('hidden');
            toggleDataLabelsBtn.innerHTML = '<span>👁️</span> Hide Values List';

            // Disable and hide threshold and upload buttons after forecast is generated
            document.getElementById('threshold-btn').disabled = true;
            // Hide upload button wrapper
            const uploadWrapper = uploadBtn.closest('.file-upload-wrapper');
            if (uploadWrapper) {
                uploadBtn.disabled = true;
                uploadWrapper.classList.add('disabled');
                uploadWrapper.style.display = 'none';
            }
        })
        .catch(error => {
            console.error(error);
            showToast("Failed to generate forecast", 'error');
        })
        .finally(() => {
            hideLoading();
        });
    });

    // Add event listener for report export
    document.getElementById('export-btn').addEventListener("click", () => {
        // Validate that forecast data exists
        if (predictions.length === 0) {
            showToast("Generate a forecast first", 'warning');
            return;
        }
        
        exportForecastReport();
    });

    // Add event listener for reset functionality
    document.getElementById("reset-btn").addEventListener("click", () => {
        // Confirm with user before resetting
        if (confirm("Are you sure you want to reset all data? This cannot be undone.")) {
            showLoading("Resetting data...");
            
            // Send reset request to server
            fetch("/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            })
            .then(response => response.json())
            .then(data => {
                // Reset all state variables
                predictions = [];
                decisions = [];
                currentPage = 0;
                productList = ["all"];
                selectedProduct = "all";
                
                // Reset UI elements
                uploadBtn.value = "";
                generateBtn.disabled = true;
                document.getElementById('export-btn').disabled = true;
                updateProductDropdown();
                
                // Clear charts
                if (forecastChart) forecastChart.destroy();
                if (predictionsChart) predictionsChart.destroy();
                if (historicalChart) historicalChart.destroy();
                forecastChart = null;
                predictionsChart = null;
                historicalChart = null;
                
                // Reset UI state
                showEmptyState();
                updateTotalSales();
                updateProductBadges();
                
                // Reset pagination
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                updatePageIndicator();
                
                // Hide the toggle datalabels button
                if (toggleDataLabelsBtn) toggleDataLabelsBtn.classList.add('hidden');
                showToast(data.message, 'success');

                document.getElementById('forecastChart-legend').classList.add('hidden');
                document.getElementById('predictionsChart-legend').classList.add('hidden');
                toggleDataLabelsBtn.innerHTML = '<span>✏️</span> Show Values List';

                // Re-enable and show threshold and upload buttons after reset
                document.getElementById('threshold-btn').disabled = false;
                const uploadWrapper = uploadBtn.closest('.file-upload-wrapper');
                if (uploadWrapper) {
                    uploadBtn.disabled = false;
                    uploadWrapper.classList.remove('disabled');
                    uploadWrapper.style.display = '';
                }
            })
            .catch(error => {
                console.error(error);
                showToast("Failed to reset data", 'error');
            })
            .finally(() => {
                hideLoading();
            });
        }
    });

    // Add event listeners for pagination
    prevBtn.addEventListener("click", () => {
        if (currentPage > 0) {
            currentPage--;
            updateDecisions();
        }
    });

    nextBtn.addEventListener("click", () => {
        if ((currentPage + 1) * itemsPerPage < decisions.length) {
            currentPage++;
            updateDecisions();
        }
    });

    // Helper Functions

    // Updates the product selection dropdown with current product list
    function updateProductDropdown() {
        productSelect.innerHTML = ''; // Clear existing options
        productSelect.disabled = productList.length <= 1; // Disable if only "all" option exists
        
        // Create and add options for each product
        productList.forEach(product => {
            const option = document.createElement("option");
            option.value = product;
            option.textContent = product === "all" ? "All Products" : product;
            productSelect.appendChild(option);
        });
        
        productSelect.value = selectedProduct; // Set current selection
    }
    
    // Updates product badges in the UI to show current selection
    function updateProductBadges() {
        const badges = document.querySelectorAll(".product-badge"); // Get all product badge elements
        const displayName = selectedProduct === "all" ? "All Products" : selectedProduct; // Get display name
        
        // Update each badge with current product name
        badges.forEach(badge => {
            badge.textContent = displayName;
        });
    }
    
    // Updates the total sales display in the UI
    function updateTotalSales() {
        const salesSummary = document.getElementById("sales-summary");
        const totalSalesValue = document.getElementById("total-sales-value");
        
        if (predictions && predictions.length > 0) {
            const totalSales = predictions.reduce((sum, value) => sum + value, 0);
            totalSalesValue.textContent = `₱${totalSales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            salesSummary.style.display = "flex";
        } else {
            salesSummary.style.display = "none";
        }
    }

    // Updates both charts with current data
    function updateCharts() {
        updateForecastChart();
        updatePredictionsChart();
        updateHistoricalChart();
        updateComparisonCharts();
    }

    // Creates/updates the forecast line chart
    function updateForecastChart() {
        const ctx = document.getElementById("forecastChart").getContext("2d");

        if (forecastChart) forecastChart.destroy();

        if (predictions.length === 0) return;

        const threshold = parseFloat(localStorage.getItem('forecastThreshold')) || 0;

        forecastChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: predictions.map((_, i) => `Day ${i + 1}`),
                datasets: [
                    {
                        label: selectedProduct === "all" ? "All Products" : selectedProduct,
                        data: predictions,
                        borderColor: "#6C5CE7",
                        backgroundColor: "rgba(108, 92, 231, 0.1)",
                        tension: 0.3,
                        fill: true,
                        borderWidth: 2,
                        pointBackgroundColor: "#6C5CE7",
                        pointRadius: 3,
                        pointHoverRadius: 5
                    },
                    {
                        label: "Threshold",
                        data: Array(predictions.length).fill(threshold),
                        borderColor: "#FF6B6B",
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        datalabels: { // Hide datalabels for threshold line
                            display: false
                        }
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        titleFont: { size: 16 },
                        bodyFont: { size: 14 },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ₱${context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                            }
                        }
                    },
                    datalabels: {
                        display: function(context) {
                            return false; // Always hide datalabels on the chart
                        },
                        align: 'top',
                        anchor: 'end',
                        rotation: -90,
                        offset: 8,
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        color: '#2D3436',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: function(value, context) {
                            return '₱' + value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            }
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

        updateForecastChartLegend();
    }

    function updateForecastChartLegend() {
        const legendDiv = document.getElementById('forecastChart-legend');
        if (!legendDiv) return;
        if (!predictions || predictions.length === 0) {
            legendDiv.innerHTML = '';
            return;
        }
        legendDiv.innerHTML = predictions.map((value, idx) =>
            `<span class="legend-item">Day ${idx + 1}: ₱${value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>`
        ).join('');
    }

    // Creates/updates the predictions bar chart
    function updatePredictionsChart() {
        const ctx = document.getElementById("predictionsChart").getContext("2d");

        if (predictionsChart) predictionsChart.destroy();

        if (predictions.length === 0) return;

        const threshold = parseFloat(localStorage.getItem('forecastThreshold')) || 0;

        predictionsChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: predictions.map((_, i) => `Day ${i + 1}`),
                datasets: [
                    {
                        label: selectedProduct === "all" ? "All Products" : selectedProduct,
                        data: predictions,
                        backgroundColor: "rgba(108, 92, 231, 0.7)",
                        borderRadius: 6,
                        borderWidth: 0
                    },
                    {
                        label: "Threshold",
                        data: Array(predictions.length).fill(threshold),
                        type: "line",
                        borderColor: "#FF6B6B",
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        datalabels: { // Hide datalabels for threshold line
                            display: false
                        }
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        titleFont: { size: 16 },
                        bodyFont: { size: 14 },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ₱${context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                            }
                        }
                    },
                    datalabels: {
                        display: function(context) {
                            return false; // Always hide datalabels on the chart
                        },
                        anchor: 'end',
                        align: 'top',
                        rotation: -90,
                        offset: 6,
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        color: '#2D3436',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: function(value, context) {
                            return '₱' + value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            }
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

        updatePredictionsChartLegend();
    }

    function updatePredictionsChartLegend() {
        const legendDiv = document.getElementById('predictionsChart-legend');
        if (!legendDiv) return;
        if (!predictions || predictions.length === 0) {
            legendDiv.innerHTML = '';
            return;
        }
        legendDiv.innerHTML = predictions.map((value, idx) =>
            `<span class="legend-item">Day ${idx + 1}: ₱${value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>`
        ).join('');
    }

    // Add historicalData to the global state
    let historicalData = [];
    let historicalProducts = new Set();
    let historicalForecastTypes = new Set();

    // Fetch historical data from server
    function fetchHistoricalData() {
        fetch("/get_historical_forecasts")
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error("Error fetching historical data:", data.error);
                    return;
                }
                historicalData = data.historical_data;
                
                // Extract unique products and forecast types
                historicalProducts.clear();
                historicalForecastTypes.clear();
                historicalData.forEach(item => {
                    historicalProducts.add(item.product);
                    if (item.forecast_type) {
                        historicalForecastTypes.add(item.forecast_type);
                    }
                });
                
                // Update product dropdown
                updateHistoricalProductDropdown();
                updateHistoricalChart();
            })
            .catch(error => {
                console.error("Error fetching historical data:", error);
            });
    }

    // Update the historical product dropdown
    function updateHistoricalProductDropdown() {
        const productSelect = document.getElementById('historical-product');
        productSelect.innerHTML = '<option value="all">All Products</option>';
        
        historicalProducts.forEach(product => {
            const option = document.createElement('option');
            option.value = product;
            option.textContent = product;
            productSelect.appendChild(option);
        });
    }

    // Filter historical data based on selected filters
    function filterHistoricalData() {
        const dateRange = document.getElementById('date-range').value;
        const selectedProduct = document.getElementById('historical-product').value;
        const selectedType = document.getElementById('forecast-type').value;
        
        const now = new Date();
        const filteredData = historicalData.filter(item => {
            // Filter by date range
            if (dateRange !== 'all') {
                const itemDate = new Date(item.date);
                const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
                if (daysDiff > parseInt(dateRange)) {
                    return false;
                }
            }
            
            // Filter by product
            if (selectedProduct === 'all') {
                // When "all" is selected, only show entries where product is "all"
                if (item.product !== 'all') {
                    return false;
                }
            } else if (item.product !== selectedProduct) {
                return false;
            }
            
            // Filter by forecast type
            if (selectedType !== 'all' && item.forecast_type !== selectedType) {
                return false;
            }
            
            return true;
        });
        
        return filteredData;
    }

    // Show empty state for historical chart
    function showHistoricalEmptyState() {
        const chartContainer = document.getElementById("historicalChart").parentNode;
        const existingEmptyState = chartContainer.querySelector('.empty-state');
        const existingChart = document.getElementById("historicalChart");
        const existingSummary = chartContainer.querySelector('.chart-summary');

        // Remove existing empty state if it exists
        if (existingEmptyState) {
            existingEmptyState.remove();
        }

        // Remove existing summary if it exists
        if (existingSummary) {
            existingSummary.remove();
        }

        // Hide the chart
        if (existingChart) {
            existingChart.style.display = 'none';
        }

        // Create new empty state
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-icon">📊</div>
            <p class="empty-state-text">No historical data available for the selected filters</p>
        `;
        chartContainer.appendChild(emptyState);
    }

    // Creates/updates the historical line chart
    function updateHistoricalChart() {
        const ctx = document.getElementById("historicalChart");
        const chartContainer = ctx.parentNode;
        
        // Remove any existing empty state
        const existingEmptyState = chartContainer.querySelector('.empty-state');
        if (existingEmptyState) {
            existingEmptyState.remove();
        }

        // Show the chart canvas
        ctx.style.display = 'block';

        // Get filtered data
        const filteredData = filterHistoricalData();

        // Return if no data available
        if (!filteredData || filteredData.length === 0) {
            if (historicalChart) {
                historicalChart.destroy();
                historicalChart = null;
            }
            showHistoricalEmptyState();
            return;
        }

        // Prepare data for chart
        const datasets = [];
        const colors = [
            '#6C5CE7', // Purple
            '#00CEFF', // Cyan
            '#00B894', // Green
            '#FDCB6E', // Yellow
            '#E17055', // Orange
            '#0984E3', // Blue
            '#E84393', // Pink
            '#00D2D3', // Turquoise
            '#FFA502', // Light Orange
            '#FF4757', // Red
            '#5352ED', // Royal Blue
            '#2ED573', // Lime Green
            '#FF5252', // Coral
            '#BE2EDD', // Magenta
            '#70A1FF', // Light Blue
            '#FF6B81', // Salmon
            '#A8E6CF', // Mint
            '#FFB8B8', // Light Pink
            '#4834D4', // Indigo
            '#F97F51', // Mandarin
            '#7158E2', // Royal Purple
            '#3742FA', // Bright Blue
            '#2F3542', // Dark Gray
            '#8C7AE6', // Lavender
            '#FF793F'  // Deep Orange
        ];

        // Sort data by date (newest first)
        filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Create a dataset for each forecast
        filteredData.forEach((item, index) => {
            const color = colors[index % colors.length];
            const date = new Date(item.date);
            const formattedDate = date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Calculate average prediction
            const avgPrediction = item.predictions.reduce((a, b) => a + b, 0) / item.predictions.length;
            
            datasets.push({
                label: `${item.product} (${formattedDate})`,
                data: item.predictions,
                borderColor: color,
                backgroundColor: color + '20',
                tension: 0.3,
                fill: false,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                metadata: {
                    average: avgPrediction,
                    product: item.product,
                    date: formattedDate,
                    type: item.forecast_type
                }
            });
        });

        // If chart exists, update its data
        if (historicalChart) {
            historicalChart.data.datasets = datasets;
            historicalChart.data.labels = Array.from({length: Math.max(...filteredData.map(d => d.predictions.length))}, (_, i) => `Day ${i + 1}`);
            historicalChart.update();
        } else {
            // Create new line chart if it doesn't exist
            historicalChart = new Chart(ctx, {
                type: "line",
                data: {
                    labels: Array.from({length: Math.max(...filteredData.map(d => d.predictions.length))}, (_, i) => `Day ${i + 1}`),
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: {
                        padding: {
                            top: 30, // Increased top padding for datalabels
                            right: 20,
                            bottom: 120,  // Increased bottom padding to accommodate legend
                            left: 20
                        }
                    },
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            align: 'center',
                            maxHeight: 100,
                            labels: {
                                boxWidth: 12,
                                padding: 10,
                                font: {
                                    size: 12,
                                    weight: '500'
                                },
                                usePointStyle: true,
                                pointStyle: 'circle',
                                generateLabels: function(chart) {
                                    const datasets = chart.data.datasets;
                                    return datasets.map((dataset, i) => ({
                                        text: dataset.label,
                                        fillStyle: dataset.borderColor,
                                        strokeStyle: dataset.borderColor,
                                        lineWidth: 2,
                                        hidden: !chart.isDatasetVisible(i),
                                        index: i
                                    }));
                                }
                            },
                            title: {
                                display: true,
                                text: 'Historical Forecasts',
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                },
                                padding: {
                                    bottom: 10
                                }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            titleColor: '#2D3436',
                            bodyColor: '#2D3436',
                            titleFont: { size: 16, weight: 'bold' },
                            bodyFont: { size: 14 },
                            footerFont: { size: 13 },
                            borderColor: 'rgba(0, 0, 0, 0.1)',
                            borderWidth: 1,
                            padding: 15,
                            displayColors: true,
                            boxPadding: 6,
                            callbacks: {
                                title: function(tooltipItems) {
                                    const dataset = tooltipItems[0].dataset;
                                    return `${dataset.metadata.product} (${dataset.metadata.date})`;
                                },
                                label: function(context) {
                                    const dataset = context.dataset;
                                    const value = context.parsed.y;
                                    return `Day ${context.label}: ${value.toFixed(2)}`;
                                },
                                afterBody: function(tooltipItems) {
                                    const dataset = tooltipItems[0].dataset;
                                    return [
                                        '',
                                        `Average: ${dataset.metadata.average.toFixed(2)}`,
                                        `Type: ${dataset.metadata.type || 'N/A'}`
                                    ];
                                }
                            }
                        },
                        datalabels: {
                            display: function(context) {
                                return false; // Always hide datalabels on the chart
                            },
                            align: 'top',
                            anchor: 'end',
                            rotation: -90,
                            offset: 8,
                            backgroundColor: 'transparent',
                            borderColor: 'transparent',
                            color: '#2D3436',
                            font: {
                                weight: 'bold',
                                size: 13
                            },
                            formatter: function(value, context) {
                                return '₱' + value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
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
                                padding: 10,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                padding: 10,
                                font: {
                                    size: 12
                                }
                            }
                        }
                    },
                    elements: {
                        line: {
                            tension: 0.3,
                            borderWidth: 2
                        },
                        point: {
                            radius: 3,
                            hoverRadius: 5,
                            borderWidth: 2
                        }
                    }
                }
            });
        }

        // Add chart summary
        updateHistoricalChartSummary(filteredData);
    }

    // Update the historical chart summary
    function updateHistoricalChartSummary(data) {
        const summaryContainer = document.createElement('div');
        summaryContainer.className = 'chart-summary';
        
        const allPredictions = data.flatMap(item => item.predictions);
        const totalPredictions = allPredictions.length;
        const averagePrediction = allPredictions.reduce((a, b) => a + b, 0) / totalPredictions;
        const maxPrediction = Math.max(...allPredictions);
        const minPrediction = Math.min(...allPredictions);
        
        summaryContainer.innerHTML = `
            <div class="summary-item">
                <span class="summary-label">Total Forecasts:</span>
                <span class="summary-value">${data.length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Average Prediction:</span>
                <span class="summary-value">₱${averagePrediction.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Highest Prediction:</span>
                <span class="summary-value">₱${maxPrediction.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Lowest Prediction:</span>
                <span class="summary-value">₱${minPrediction.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
        `;
        
        const existingSummary = document.querySelector('.chart-summary');
        if (existingSummary) {
            existingSummary.remove();
        }
        
        const chartContainer = document.getElementById('historicalChart').parentNode;
        chartContainer.appendChild(summaryContainer);
    }

    // Add event listeners for filters
    document.getElementById('date-range').addEventListener('change', updateHistoricalChart);
    document.getElementById('historical-product').addEventListener('change', updateHistoricalChart);
    document.getElementById('forecast-type').addEventListener('change', updateHistoricalChart);

    // Helper function to generate random colors
    function getRandomColor(index) {
        const colors = [
            '#6C5CE7', '#00CEFF', '#00B894', '#FDCB6E', '#E17055',
            '#0984E3', '#6C5CE7', '#00B894', '#FDCB6E', '#E17055'
        ];
        return colors[index % colors.length];
    }

    // Updates the decisions display with pagination
    function updateDecisions() {
        // Hardcoded product unit prices from the menu
        const productUnitPrices = {
            "Blueberry Cheesecake": 160,
            "Strawberry Cheesecake": 160,
            "Butter Croissant": 110,
            "Kouign Amman Cinnamon": 120,
            "Chocolate Croissant": 120,
            "Choco Moist": 100,
            "Cookies": 65,
            "BLK.8 Burger": 280,
            "French Fries": 130,
            "Nachos": 170,
            "Ham & Cheese Panini": 100,
            "Tuna Sandwich": 100,
            "Clubhouse": 180,
            "Cheesy Bacon Fries": 180,
            "Potato Wedges": 180,
            "Barkada Combo": 300,
            "Chicken Parmesan": 280,
            "Buffalo Wings": 280,
            "Lechon Kawali": 170,
            "Grilled Liempo": 170,
            "Bangsilog": 180,
            "Bulaksilog": 170,
            "Baconsilog": 170,
            "Spamsilog": 170,
            "Tapsilog": 170,
            "Longsilog": 170,
            "Tocilog": 150,
            "Hamsilog": 140,
            "Creamy Chicken Alfredo": 170,
            "Carbonara": 170,
            "Classic Spaghetti": 160,
            "Ramyeon (Mild or Spicy)": 120,
            "Egg": 30,
            "Kimchi": 50,
            "Cheese": 30,
            "V60 Pour-Over": 150,
            "Piccolo": 90,
            "Cortado": 120,
            "Americano": 120,
            "Latte": 130,
            "Cappuccino": 130,
            "Flat White": 130,
            "BLK. 8 Latte": 180,
            "Vanilla Ice Cream Latte": 180,
            "Iced Latte": 140,
            "Caramel Macchiato (Iced)": 150,
            "French Vanilla": 140,
            "Hazelnut": 140,
            "Matcha Coffee": 150,
            "Mocha (Iced)": 150,
            "Spanish Latte": 140,
            "Strawberry Matcha (Iced)": 160,
            "Chocolate Matcha (Iced)": 160,
            "Orange Coffee": 150,
            "Iced Americano": 130,
            "Lychee": 80,
            "Green Apple": 80,
            "Passion Fruit": 80,
            "Blueberry (Fruit Soda)": 80,
            "Strawberry (Fruit Soda)": 80,
            "Caramel Macchiato": 130,
            "Cream Brulee": 130,
            "Hazelnut Mocha": 130,
            "Matcha": 130,
            "Mocha": 130,
            "Peppermint Mocha": 130,
            "Campfire Latte": 150,
            "Matcha Frappe": 180,
            "Mocha Frappe": 180,
            "Salted Caramel Frappe": 180,
            "Iced | Hot Choco": 130,
            "Strawberry Milk": 130,
            "Blueberry Milk": 130,
            "Strawberry Yogurt": 130,
            "Blueberry Yogurt": 130,
            "Matcha Latte": 140,
            "Chocolate Matcha": 150,
            "Strawberry Matcha": 150,
            "Cranberry Juice Blend": 120,
            "Cherry Berry Juice Blend": 120,
            "Affogato": 120,
            "Matchagato": 120
          }
          ;

        // Show empty state if no decisions
        if (decisions.length === 0) {
            showEmptyState();
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }
        
        // Calculate pagination range
        const start = currentPage * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedDecisions = decisions.slice(start, end);

        // Helper to get unit price for a product
        function getUnitPrice(product) {
            return productUnitPrices[product] || null;
        }

        // Update decisions display with enhanced format
        decisionSection.innerHTML = paginatedDecisions.map((d, index) => {
            const currentDay = start + index + 1;
            const dailySales = predictions[currentDay - 1] || 0;
            let stockNeeded = 'N/A';

            if (selectedProduct === "all") {
                // For 'all', try to get per-product breakdown for this day
                // Assume predictions is an array of total sales per day for all products
                // If you have per-product predictions, you can sum (sales for product / price)
                // Here, we will just divide total sales by average price for a rough estimate
                // --- ADVANCED: If you have per-product breakdown, use it here ---
                // Otherwise, use the sum of (total sales / each product price)
                // We'll estimate by distributing sales equally among all products with a price
                const productNames = Object.keys(productUnitPrices);
                if (productNames.length > 0) {
                    // Distribute dailySales equally among all products
                    let totalUnits = 0;
                    productNames.forEach(product => {
                        const price = productUnitPrices[product];
                        if (price && price > 0) {
                            totalUnits += dailySales / price;
                        }
                    });
                    stockNeeded = Math.ceil(totalUnits).toLocaleString() + ' units';
                }
            } else {
                const unitPrice = getUnitPrice(selectedProduct);
                if (unitPrice && unitPrice > 0) {
                    stockNeeded = Math.ceil(dailySales / unitPrice).toLocaleString() + ' units';
                }
            }

            // Determine action type based on severity and trend
            let actionType = '';
            if (d.severity === 'high' && d.trend === 'positive') {
                actionType = 'Urgent Restock';
            } else if (d.severity === 'high' && d.trend === 'negative') {
                actionType = 'Immediate Discount';
            } else if (d.trend === 'positive') {
                actionType = 'Monitor Stock';
            } else if (d.trend === 'negative') {
                actionType = 'Consider Promotion';
            } else {
                actionType = 'Maintain Current';
            }

            return `
                <div class="decision-item ${d.trend}">
                    <div class="decision-header">
                        <span class="decision-icon">${d.icon || '💡'}</span>
                        <span class="decision-action">${actionType}</span>
                    </div>
                    <div class="decision-details">
                        <div class="decision-summary">
                            <div class="summary-row">
                                <span class="summary-label">Product:</span>
                                <span class="summary-value">${selectedProduct === "all" ? "All Products" : selectedProduct}</span>
                            </div>
                            <div class="summary-row">
                                <span class="summary-label">Daily Sales:</span>
                                <span class="summary-value">₱${dailySales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                            <div class="summary-row">
                                <span class="summary-label">Stock Needed:</span>
                                <span class="summary-value">${stockNeeded}</span>
                            </div>
                        </div>
                        <div class="decision-text">${d.text}</div>
                    </div>
                </div>
            `;
        }).join("");
        
        // Update pagination controls
        prevBtn.disabled = currentPage === 0;
        nextBtn.disabled = end >= decisions.length;
        updatePageIndicator();
    }
    
    // Updates the page indicator text
    function updatePageIndicator() {
        const totalPages = Math.ceil(decisions.length / itemsPerPage);
        pageIndicator.textContent = `Page ${currentPage + 1} of ${totalPages}`;
    }

    // Shows empty state message when no data is available
    function showEmptyState() {
        decisionSection.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p class="empty-state-text">${predictions.length === 0 
                    ? "Upload your data and generate a forecast to see recommendations" 
                    : "No recommendations available for this data"}</p>
            </div>
        `;
    }
    
    // Shows loading state with message
    function showLoading(message) {
        // Create loading overlay if it doesn't exist
        let loadingOverlay = document.getElementById('loading-overlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loading-overlay';
            loadingOverlay.className = 'loading-overlay';
            document.body.appendChild(loadingOverlay);
        }

        // Create loading content
        const loadingContent = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p class="loading-message">${message}</p>
            </div>
        `;
        loadingOverlay.innerHTML = loadingContent;
        loadingOverlay.style.display = 'flex';
    }
    
    // Hides loading state
    function hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
    
    // Shows toast notification with message and type
    function showToast(message, type = 'info') {
        alert(`${type.toUpperCase()}: ${message}`);
    }
    
    // Converts chart to base64 image for export
    function chartToImage(chart) {
        return new Promise((resolve) => {
            resolve(chart.toBase64Image('image/png', 1.0));
        });
    }
    
    // Exports forecast report as HTML
    function exportForecastReport() {
        showLoading("Generating export...");
        
        // Prepare report data
        const reportData = {
            title: `Sales Forecast Report - ${selectedProduct === "all" ? "All Products" : selectedProduct}`,
            date: new Date().toLocaleDateString(),
            predictions: predictions.map((value, index) => ({
                day: index + 1,
                value: value.toFixed(2)
            })),
            decisions: decisions,
            summary: {
                totalSales: predictions.reduce((sum, val) => sum + val, 0).toFixed(2),
                averageSales: (predictions.reduce((sum, val) => sum + val, 0) / predictions.length).toFixed(2),
                highestSales: Math.max(...predictions).toFixed(2),
                lowestSales: Math.min(...predictions).toFixed(2),
                selectedProduct: selectedProduct === "all" ? "All Products" : selectedProduct
            },
            historicalSummary: {
                dateRange: document.getElementById('date-range').value,
                product: document.getElementById('historical-product').value,
                forecastType: document.getElementById('forecast-type').value
            }
        };
        
        // Convert charts to images and generate report
        Promise.all([
            chartToImage(forecastChart),
            chartToImage(predictionsChart),
            chartToImage(historicalChart)
        ]).then(([forecastChartImg, predictionsChartImg, historicalChartImg]) => {
            // Generate HTML content
            const content = generateReportContent(reportData, forecastChartImg, predictionsChartImg, historicalChartImg);
            
            // Create and trigger download
            const blob = new Blob([content], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `forecast-report-${new Date().toISOString().slice(0, 10)}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            hideLoading();
            showToast("Report exported successfully!", 'success');
        }).catch(error => {
            console.error('Error exporting report:', error);
            hideLoading();
            showToast("Failed to export report", 'error');
        });
    }
    
    // Generates HTML content for the report
    function generateReportContent(data, forecastChartImg, predictionsChartImg, historicalChartImg) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${data.title}</title>
                <style>
                    /* Report styling */
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                        padding-bottom: 20px;
                        border-bottom: 1px solid #eee;
                    }
                    .date {
                        color: #666;
                        font-style: italic;
                    }
                    .charts {
                        display: flex;
                        flex-direction: column;
                        gap: 30px;
                        margin-bottom: 30px;
                    }
                    .chart-container {
                        text-align: center;
                    }
                    .chart-container img {
                        max-width: 100%;
                        height: auto;
                        border: 1px solid #eee;
                        border-radius: 8px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .summary {
                        background-color: #f5f5f5;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 30px;
                    }
                    .summary h2 {
                        margin-top: 0;
                    }
                    .summary-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                        gap: 15px;
                    }
                    .summary-item {
                        background: white;
                        padding: 15px;
                        border-radius: 8px;
                        box-shadow: 0 1px 5px rgba(0,0,0,0.05);
                    }
                    .summary-item h3 {
                        margin-top: 0;
                        font-size: 16px;
                        color: #666;
                    }
                    .summary-item .value {
                        font-size: 24px;
                        font-weight: bold;
                        color: #6C5CE7;
                    }
                    .decisions h2 {
                        margin-bottom: 20px;
                    }
                    .decision-item {
                        display: flex;
                        align-items: flex-start;
                        gap: 15px;
                        padding: 15px;
                        background: rgba(108, 92, 231, 0.05);
                        border-radius: 8px;
                        border-left: 4px solid #6C5CE7;
                        margin-bottom: 15px;
                    }
                    .decision-icon {
                        font-size: 24px;
                    }
                    .decision-text {
                        flex: 1;
                    }
                    .data-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 30px;
                    }
                    .data-table th, .data-table td {
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid #eee;
                    }
                    .data-table th {
                        background-color: #f5f5f5;
                        font-weight: bold;
                    }
                    .data-table tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .filter-summary {
                        background-color: #f5f5f5;
                        padding: 15px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                    }
                    .filter-summary h3 {
                        margin-top: 0;
                        color: #666;
                    }
                    .filter-item {
                        margin: 10px 0;
                    }
                    .filter-label {
                        font-weight: bold;
                        margin-right: 10px;
                    }
                    @media print {
                        body {
                            padding: 0;
                        }
                        .no-print {
                            display: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${data.title}</h1>
                    <p class="date">Generated on ${data.date}</p>
                </div>
                
                <div class="summary">
                    <h2>Summary</h2>
                    <div class="summary-grid">
                        <div class="summary-item">
                            <h3>Product</h3>
                            <div class="value">${data.summary.selectedProduct}</div>
                        </div>
                        <div class="summary-item">
                            <h3>Total Forecasted Sales</h3>
                            <div class="value">₱${data.summary.totalSales}</div>
                        </div>
                        <div class="summary-item">
                            <h3>Average Daily Sales</h3>
                            <div class="value">₱${data.summary.averageSales}</div>
                        </div>
                        <div class="summary-item">
                            <h3>Highest Daily Sales</h3>
                            <div class="value">₱${data.summary.highestSales}</div>
                        </div>
                        <div class="summary-item">
                            <h3>Lowest Daily Sales</h3>
                            <div class="value">₱${data.summary.lowestSales}</div>
                        </div>
                    </div>
                </div>
                
                <div class="charts">
                    <div class="chart-container">
                        <h2>Sales Forecast</h2>
                        <img src="${forecastChartImg}" alt="Sales Forecast Chart">
                    </div>
                    <div class="chart-container">
                        <h2>Predictions Analysis</h2>
                        <img src="${predictionsChartImg}" alt="Predictions Analysis Chart">
                    </div>
                    <div class="chart-container">
                        <h2>Historical Sales</h2>
                        <div class="filter-summary">
                            <h3>Filter Settings</h3>
                            <div class="filter-item">
                                <span class="filter-label">Date Range:</span>
                                <span>${data.historicalSummary.dateRange === 'all' ? 'All Time' : 
                                       `Last ${data.historicalSummary.dateRange} days`}</span>
                            </div>
                            <div class="filter-item">
                                <span class="filter-label">Product:</span>
                                <span>${data.historicalSummary.product === 'all' ? 'All Products' : 
                                       data.historicalSummary.product}</span>
                            </div>
                            <div class="filter-item">
                                <span class="filter-label">Forecast Type:</span>
                                <span>${data.historicalSummary.forecastType === 'all' ? 'All Types' : 
                                       data.historicalSummary.forecastType}</span>
                            </div>
                        </div>
                        <img src="${historicalChartImg}" alt="Historical Sales Chart">
                    </div>
                </div>
                
                <div class="data-section">
                    <h2>Detailed Forecast Data</h2>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Day</th>
                                <th>Forecasted Sales</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.predictions.map(p => `
                                <tr>
                                    <td>Day ${p.day}</td>
                                    <td>₱${p.value}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <div class="decisions">
                    <h2>Recommended Actions</h2>
                    ${data.decisions.map(d => `
                        <div class="decision-item">
                            <div class="decision-icon">${d.icon}</div>
                            <div class="decision-text">${d.text}</div>
                        </div>
                    `).join('')}
                </div>
                
                <p class="no-print">
                    <small>© ${new Date().getFullYear()} Forecastrix. This report was generated automatically and should be reviewed by a business analyst.</small>
                </p>
                
                <div class="no-print" style="text-align:center; margin-top: 30px;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #6C5CE7; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Print Report
                    </button>
                </div>
            </body>
            </html>
        `;
    }

    // Function to handle file upload
    function handleFileUpload(file) {
        if (file) {
            // Show product selector when file is uploaded
            productSelector.classList.remove('hidden');
            // ... existing code ...
        } else {
            // Hide product selector when file is removed
            productSelector.classList.add('hidden');
            // ... existing code ...
        }
    }

    // Update file input event listener
    uploadBtn.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFileUpload(file);
    });

    // Update drag and drop handlers
    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        handleFileUpload(file);
    });

    // Updates the comparison charts (past vs predicted sales)
    function updateComparisonCharts() {
        // Initialize charts if they don't exist
        if (!pastSalesChart || !predictedSalesChart) {
            const pastSalesCtx = document.getElementById('pastSalesChart').getContext('2d');
            const predictedSalesCtx = document.getElementById('predictedSalesChart').getContext('2d');

            const commonChartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true, 
                        position: 'top',
                    },
                    tooltip: {
                        titleFont: { size: 16 },
                        bodyFont: { size: 14 },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ₱${context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                            }
                        }
                    },
                    datalabels: {
                        display: function(context) {
                            return false; // Always hide datalabels on the chart
                        },
                        align: 'top',
                        anchor: 'end',
                        rotation: -90,
                        offset: 8,
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        color: '#2D3436',
                        font: {
                            weight: 'bold',
                            size: 14
                        },
                        formatter: function(value, context) {
                            return '₱' + value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0});
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                            }
                        }
                    }
                }
            };

            pastSalesChart = new Chart(pastSalesCtx, {
                type: 'line',
                options: commonChartOptions, // Use common options
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Past Sales History',
                        data: [],
                        borderColor: '#4CAF50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }]
                }
            });

            predictedSalesChart = new Chart(predictedSalesCtx, {
                type: 'line',
                options: commonChartOptions, // Use common options
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Predicted Sales',
                        data: [],
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33, 150, 243, 0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 3,
                        pointHoverRadius: 5
                    }]
                }
            });
        }

        // --- Update Past Sales Chart using window.pastSalesData ---
        if (window.pastSalesData && window.pastSalesData.length > 0) {
            let salesToDisplay = [];
            // Deep copy and parse dates, then sort
            const rawSales = JSON.parse(JSON.stringify(window.pastSalesData)).map(item => ({
                ...item,
                Date: new Date(item.Date) // Assuming YYYY-MM-DD from backend
            })).sort((a, b) => a.Date - b.Date);

            if (selectedProduct === "all") {
                const aggregatedSales = {};
                rawSales.forEach(item => {
                    const dateStr = item.Date.toISOString().split('T')[0];
                    if (!aggregatedSales[dateStr]) {
                        aggregatedSales[dateStr] = { date: new Date(item.Date), sales: 0 };
                    }
                    aggregatedSales[dateStr].sales += parseFloat(item.Sales) || 0;
                });
                salesToDisplay = Object.values(aggregatedSales).sort((a,b) => a.date - b.date);
            } else {
                salesToDisplay = rawSales.filter(item => item["Product Name"] === selectedProduct);
                // Already sorted by Date
            }

            const last90Sales = salesToDisplay.slice(-90);

            if (last90Sales.length > 0) {
                const labels = last90Sales.map(item => {
                    const dateObj = item.date || item.Date; // 'date' from aggregation, 'Date' from direct filter
                    return dateObj instanceof Date && !isNaN(dateObj) 
                           ? dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                           : 'Invalid Date';
                });
                const dataPoints = last90Sales.map(item => parseFloat(item.sales || item.Sales) || 0);

                pastSalesChart.data.labels = labels;
                pastSalesChart.data.datasets[0].data = dataPoints;
                pastSalesChart.data.datasets[0].label = selectedProduct === "all" ? "All Products - Past Sales History" : `${selectedProduct} - Past Sales History`;
            } else {
                pastSalesChart.data.labels = [];
                pastSalesChart.data.datasets[0].data = [];
                pastSalesChart.data.datasets[0].label = selectedProduct === "all" ? "All Products - No Past Sales Data" : `${selectedProduct} - No Past Sales Data`;
            }
        } else {
            pastSalesChart.data.labels = [];
            pastSalesChart.data.datasets[0].data = [];
            pastSalesChart.data.datasets[0].label = "Past Sales - Upload CSV";
        }
        pastSalesChart.update();

        // --- Update Predicted Sales Chart using global 'predictions' variable ---
        if (predictions && predictions.length > 0) {
            const labels = predictions.map((_, idx) => {
                const forecastStartDate = new Date(); 
                forecastStartDate.setDate(forecastStartDate.getDate() + idx);
                 return forecastStartDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            });
            predictedSalesChart.data.labels = labels;
            predictedSalesChart.data.datasets[0].data = predictions;
            predictedSalesChart.data.datasets[0].label = selectedProduct === "all" ? "All Products - Predicted Sales" : `${selectedProduct} - Predicted Sales`;

        } else {
            predictedSalesChart.data.labels = [];
            predictedSalesChart.data.datasets[0].data = [];
            predictedSalesChart.data.datasets[0].label = "Predicted Sales - Generate Forecast";
        }
        predictedSalesChart.update();
        updatePastSalesChartLegend();
        updatePredictedSalesChartLegend();
    }

    function updatePastSalesChartLegend() {
        const legendDiv = document.getElementById('pastSalesChart-legend');
        if (!legendDiv) return;
        if (!pastSalesChart || !pastSalesChart.data || !pastSalesChart.data.datasets[0].data.length) {
            legendDiv.innerHTML = '';
            return;
        }
        legendDiv.innerHTML = pastSalesChart.data.datasets[0].data.map((value, idx) =>
            `<span class="legend-item">Day ${idx + 1}: ₱${value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>`
        ).join('');
    }

    function updatePredictedSalesChartLegend() {
        const legendDiv = document.getElementById('predictedSalesChart-legend');
        if (!legendDiv) return;
        if (!predictedSalesChart || !predictedSalesChart.data || !predictedSalesChart.data.datasets[0].data.length) {
            legendDiv.innerHTML = '';
            return;
        }
        legendDiv.innerHTML = predictedSalesChart.data.datasets[0].data.map((value, idx) =>
            `<span class="legend-item">Day ${idx + 1}: ₱${value.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</span>`
        ).join('');
    }
});