document.addEventListener("DOMContentLoaded", () => {
    let predictions = [];
    let decisions = [];
    let currentPage = 0;
    const itemsPerPage = 3;
    let productList = ["all"];
    let selectedProduct = "all";
    let forecastChart = null;
    let predictionsChart = null;

    // UI Elements
    const uploadBtn = document.getElementById("upload-btn");
    const generateBtn = document.getElementById("generate-btn");
    const productSelect = document.getElementById("product-select");
    const decisionSection = document.getElementById("decision-section");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const pageIndicator = document.getElementById("page-indicator");
    const exportBtn = document.getElementById("export-btn");

    // Add export button if it doesn't exist
    if (!exportBtn) {
        const actionsDiv = document.querySelector('.actions');
        const exportButton = document.createElement('button');
        exportButton.innerHTML = '<span>📤</span> Export Report';
        exportButton.className = 'action-btn';
        exportButton.id = 'export-btn';
        exportButton.disabled = true; // Initially disabled until forecast is generated
        actionsDiv.appendChild(exportButton);
    }

    // Initialize with empty state
    showEmptyState();

    // Set Threshold
    document.getElementById("threshold-btn").addEventListener("click", () => {
        const currentThreshold = localStorage.getItem('forecastThreshold') || '';
        const threshold = prompt("Enter your desired sales threshold (e.g., 1000):", currentThreshold);
        
        if (threshold !== null && threshold.trim() !== "") {
            if (!isNaN(threshold)) {
                fetch("/set_threshold", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ threshold: threshold.trim() })
                })
                .then(response => response.json())
                .then(data => {
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

    // Upload CSV File
    uploadBtn.addEventListener("change", function() {
        if (!this.files.length) return;

        const formData = new FormData();
        formData.append("file", this.files[0]);
        
        showLoading("Uploading and processing data...");
        
        fetch("/upload_csv", { 
            method: "POST", 
            body: formData 
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error, 'error');
                return;
            }
            
            showToast(data.message, 'success');
            generateBtn.disabled = false;
            
            // If the response includes product list, update the dropdown
            if (data.product_list) {
                productList = ["all", ...data.product_list];
                updateProductDropdown();
            }
        })
        .catch(error => {
            console.error(error);
            showToast("Failed to upload file", 'error');
        })
        .finally(() => {
            hideLoading();
        });
    });

    // Product Select Change
    productSelect.addEventListener("change", function() {
        selectedProduct = this.value;
        updateProductBadges();
    });

    // Generate Forecast
    generateBtn.addEventListener("click", () => {
        if (!uploadBtn.files.length && productList.length <= 1) {
            showToast("Please upload a CSV file first", 'warning');
            return;
        }
        
        showLoading("Generating forecast...");
        
        fetch("/generate_forecast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product: selectedProduct })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                showToast(data.error, 'error');
                return;
            }

            predictions = data.predictions || [];
            decisions = data.decisions || [];
            
            if (data.product_list) {
                productList = ["all", ...data.product_list];
                updateProductDropdown();
            }
            
            updateCharts();
            updateDecisions();
            updateTotalSales();
            updateProductBadges();
            
            // Enable the export button after successful forecast generation
            document.getElementById('export-btn').disabled = false;
            
            showToast("Forecast generated successfully!", 'success');
        })
        .catch(error => {
            console.error(error);
            showToast("Failed to generate forecast", 'error');
        })
        .finally(() => {
            hideLoading();
        });
    });

    // Export Report
    document.getElementById('export-btn').addEventListener('click', () => {
        if (predictions.length === 0) {
            showToast("Generate a forecast first", 'warning');
            return;
        }
        
        exportForecastReport();
    });

    // Reset Functionality
    document.getElementById("reset-btn").addEventListener("click", () => {
        if (confirm("Are you sure you want to reset all data? This cannot be undone.")) {
            showLoading("Resetting data...");
            
            fetch("/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            })
            .then(response => response.json())
            .then(data => {
                // Reset all local state
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
                
                // Reset decisions display
                showEmptyState();
                updateTotalSales();
                updateProductBadges();
                
                // Disable pagination
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

    // Pagination
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
    function updateProductDropdown() {
        productSelect.innerHTML = '';
        productSelect.disabled = productList.length <= 1;
        
        productList.forEach(product => {
            const option = document.createElement("option");
            option.value = product;
            option.textContent = product === "all" ? "All Products" : product;
            productSelect.appendChild(option);
        });
        
        productSelect.value = selectedProduct;
    }
    
    function updateProductBadges() {
        const badges = document.querySelectorAll(".product-badge");
        const displayName = selectedProduct === "all" ? "All Products" : selectedProduct;
        
        badges.forEach(badge => {
            badge.textContent = displayName;
        });
    }
    
    function updateTotalSales() {
        const salesSummary = document.getElementById("sales-summary");
        const totalSalesValue = document.getElementById("total-sales-value");
        
        if (predictions && predictions.length > 0) {
            const totalSales = predictions.reduce((sum, value) => sum + value, 0);
            totalSalesValue.textContent = totalSales.toFixed(2);
            salesSummary.style.display = "flex";
        } else {
            salesSummary.style.display = "none";
        }
    }

    function updateCharts() {
        updateForecastChart();
        updatePredictionsChart();
    }

    function updateForecastChart() {
        const ctx = document.getElementById("forecastChart").getContext("2d");
        
        if (forecastChart) forecastChart.destroy();
        
        if (predictions.length === 0) return;
        
        forecastChart = new Chart(ctx, {
            type: "line",
            data: {
                labels: predictions.map((_, i) => `Day ${i + 1}`),
                datasets: [{
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
                }]
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

    function updatePredictionsChart() {
        const ctx = document.getElementById("predictionsChart").getContext("2d");
        
        if (predictionsChart) predictionsChart.destroy();
        
        if (predictions.length === 0) return;
        
        predictionsChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: predictions.map((_, i) => `Day ${i + 1}`),
                datasets: [{
                    label: selectedProduct === "all" ? "All Products" : selectedProduct,
                    data: predictions,
                    backgroundColor: "rgba(108, 92, 231, 0.7)",
                    borderRadius: 6,
                    borderWidth: 0
                }]
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

    function updateDecisions() {
        if (decisions.length === 0) {
            showEmptyState();
            prevBtn.disabled = true;
            nextBtn.disabled = true;
            return;
        }
        
        const start = currentPage * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedDecisions = decisions.slice(start, end);
        
        decisionSection.innerHTML = paginatedDecisions.map(d => `
            <div class="decision-item">
                <span class="decision-icon">${d.icon || '💡'}</span>
                <div class="decision-text">${d.text}</div>
            </div>
        `).join("");
        
        prevBtn.disabled = currentPage === 0;
        nextBtn.disabled = end >= decisions.length;
        updatePageIndicator();
    }
    
    function updatePageIndicator() {
        const totalPages = Math.ceil(decisions.length / itemsPerPage);
        pageIndicator.textContent = `Page ${currentPage + 1} of ${totalPages}`;
    }

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
    
    function showLoading(message) {
        decisionSection.innerHTML = `
            <div class="loading">
                <div>⏳</div>
                <p>${message}</p>
            </div>
        `;
    }
    
    function hideLoading() {
        if (decisions.length > 0) {
            updateDecisions();
        } else {
            showEmptyState();
        }
    }
    
    function showToast(message, type = 'info') {
        // In a real implementation, you'd want a proper toast notification system
        alert(`${type.toUpperCase()}: ${message}`);
    }
    
    function chartToImage(chart) {
        return new Promise((resolve) => {
            resolve(chart.toBase64Image('image/png', 1.0));
        });
    }
    
    function exportForecastReport() {
        showLoading("Generating export...");
        
        // Create a report object with all the data
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
        
        // Convert chart to base64 image
        Promise.all([
            chartToImage(forecastChart),
            chartToImage(predictionsChart)
        ]).then(([forecastChartImg, predictionsChartImg]) => {
            // Create PDF content
            const content = generateReportContent(reportData, forecastChartImg, predictionsChartImg);
            
            // Create download link
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
    
    function generateReportContent(data, forecastChartImg, predictionsChartImg) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${data.title}</title>
                <style>
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
});