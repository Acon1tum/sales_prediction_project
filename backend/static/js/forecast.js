document.addEventListener("DOMContentLoaded", () => {
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

    // Initialize the application with an empty state
    showEmptyState();

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
            
            // Show success message and enable generate button
            showToast(data.message, 'success');
            generateBtn.disabled = false;
            
            // Update product list if provided by server
            if (data.product_list) {
                productList = ["all", ...data.product_list];
                updateProductDropdown();
            }
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
        
        // Generate forecast with retry mechanism
        generateForecastWithRetry()
            .then(data => {
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
                
                showToast("Forecast generated successfully!", 'success');
            })
            .catch(error => {
                console.error('Error:', error);
                showToast("Failed to generate forecast. Please try again.", 'error');
            })
            .finally(() => {
                hideLoading();
            });
    });

    // Add retry mechanism for forecast generation
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second

    async function generateForecastWithRetry(attempt = 1) {
        try {
            const response = await fetch('/generate_forecast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    product: selectedProduct,
                    forecast_type: selectedForecastType
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Check for error in response
            if (data.error) {
                throw new Error(data.error);
            }
            
            return data;
        } catch (error) {
            if (attempt < MAX_RETRIES) {
                console.log(`Retry attempt ${attempt}...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
                return generateForecastWithRetry(attempt + 1);
            }
            throw error;
        }
    }

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
                forecastChart = null;
                predictionsChart = null;
                
                // Reset UI state
                showEmptyState();
                updateTotalSales();
                updateProductBadges();
                
                // Reset pagination
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                updatePageIndicator();
                
                showToast(data.message, 'success');
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
        
        // Calculate and display total sales if predictions exist
        if (predictions && predictions.length > 0) {
            const totalSales = predictions.reduce((sum, value) => sum + value, 0);
            totalSalesValue.textContent = totalSales.toFixed(2);
            salesSummary.style.display = "flex";
        } else {
            salesSummary.style.display = "none";
        }
    }

    // Updates both charts with current data
    function updateCharts() {
        updateForecastChart();
        updatePredictionsChart();
    }

    // Creates/updates the forecast line chart
    function updateForecastChart() {
        const ctx = document.getElementById("forecastChart").getContext("2d");

        // Clean up existing chart
        if (forecastChart) forecastChart.destroy();

        // Return if no data available
        if (predictions.length === 0) return;

        // Get the threshold value from localStorage or default to 0
        const threshold = parseFloat(localStorage.getItem('forecastThreshold')) || 0;

        // Create new line chart
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
                        data: Array(predictions.length).fill(threshold), // Create a horizontal line
                        borderColor: "#FF6B6B",
                        borderWidth: 2,
                        borderDash: [5, 5], // Dashed line
                        pointRadius: 0, // No points
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
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
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

    // Creates/updates the predictions bar chart
    function updatePredictionsChart() {
        const ctx = document.getElementById("predictionsChart").getContext("2d");

        // Clean up existing chart
        if (predictionsChart) predictionsChart.destroy();

        // Return if no data available
        if (predictions.length === 0) return;

        // Get the threshold value from localStorage or default to 0
        const threshold = parseFloat(localStorage.getItem('forecastThreshold')) || 0;

        // Create new bar chart
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
                        data: Array(predictions.length).fill(threshold), // Create a horizontal line
                        type: "line", // Add a line to the bar chart
                        borderColor: "#FF6B6B",
                        borderWidth: 2,
                        borderDash: [5, 5], // Dashed line
                        pointRadius: 0, // No points
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
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

    // Updates the decisions display with pagination
    function updateDecisions() {
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
        
        // Update decisions display
        decisionSection.innerHTML = paginatedDecisions.map(d => `
            <div class="decision-item">
                <span class="decision-icon">${d.icon || '💡'}</span>
                <div class="decision-text">${d.text}</div>
            </div>
        `).join("");
        
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
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // Add toast to container
        toastContainer.appendChild(toast);

        // Remove toast after 3 seconds
        setTimeout(() => {
            toast.remove();
            // Remove container if empty
            if (toastContainer.children.length === 0) {
                toastContainer.remove();
            }
        }, 3000);
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
            }
        };
        
        // Convert charts to images and generate report
        Promise.all([
            chartToImage(forecastChart),
            chartToImage(predictionsChart)
        ]).then(([forecastChartImg, predictionsChartImg]) => {
            // Generate HTML content
            const content = generateReportContent(reportData, forecastChartImg, predictionsChartImg);
            
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
    function generateReportContent(data, forecastChartImg, predictionsChartImg) {
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
                            <div class="value">${data.summary.totalSales}</div>
                        </div>
                        <div class="summary-item">
                            <h3>Average Daily Sales</h3>
                            <div class="value">${data.summary.averageSales}</div>
                        </div>
                        <div class="summary-item">
                            <h3>Highest Daily Sales</h3>
                            <div class="value">${data.summary.highestSales}</div>
                        </div>
                        <div class="summary-item">
                            <h3>Lowest Daily Sales</h3>
                            <div class="value">${data.summary.lowestSales}</div>
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
                                    <td>${p.value}</td>
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
});