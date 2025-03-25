document.addEventListener("DOMContentLoaded", () => {
    console.log("Dashboard Loaded");

    // Sidebar active state change
    document.querySelectorAll(".sidebar nav ul li").forEach(item => {
        item.addEventListener("click", () => {
            document.querySelectorAll(".sidebar nav ul li").forEach(li => li.classList.remove("active"));
            item.classList.add("active");
        });
    });

    // Add click effect to cards
    document.querySelectorAll(".stat-card, .pinned-card").forEach(card => {
        card.addEventListener("mousedown", () => {
            card.style.transform = "translateY(2px)";
        });

        card.addEventListener("mouseup", () => {
            card.style.transform = "translateY(0)";
        });

        card.addEventListener("mouseleave", () => {
            card.style.transform = "translateY(0)";
        });
    });

    // Set Threshold
    const thresholdBtn = document.getElementById("threshold-btn");
    if (thresholdBtn) {
        thresholdBtn.addEventListener("click", () => {
            let threshold = prompt("Enter Desired Threshold:");
            if (threshold !== null && !isNaN(threshold) && threshold.trim() !== "") {
                fetch("/set_threshold", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ threshold: threshold.trim() })
                })
                .then(response => response.json())
                .then(data => alert(data.message))
                .catch(error => console.error(error));
            } else {
                alert("Invalid threshold value. Please enter a number.");
            }
        });
    }

    // Upload CSV File
    const uploadInput = document.getElementById("upload-btn");
    if (uploadInput) {
        uploadInput.addEventListener("change", function() {
            let formData = new FormData();
            formData.append("file", this.files[0]);

            fetch("/upload_csv", { method: "POST", body: formData })
                .then(response => response.json())
                .then(data => alert(data.message))
                .catch(error => console.error(error));
        });
    }

    // Generate Forecast
    const generateBtn = document.getElementById("generate-btn");
    if (generateBtn) {
        generateBtn.addEventListener("click", () => {
            fetch("/generate_forecast", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }

                // Display predictions
                let forecastResults = document.getElementById("forecast-results");
                forecastResults.innerHTML = `<h3>Predictions: ${data.predictions.join(", ")}</h3>`;

                // Display recommended decisions
                let decisionSection = document.getElementById("decision-section");
                decisionSection.innerHTML = data.decisions.map(d => `<p>${d.icon} ${d.text}</p>`).join("");

                alert("Forecast generated successfully!");
            })
            .catch(error => console.error(error));
        });
    }
});
