// Main event listener that ensures all DOM elements are loaded before executing any JavaScript
document.addEventListener("DOMContentLoaded", () => {
    // Log message to confirm the dashboard has been loaded successfully
    console.log("Dashboard Loaded");

    // Sidebar Navigation Management
    // Selects all list items in the sidebar navigation and adds click event listeners
    document.querySelectorAll(".sidebar nav ul li").forEach(item => {
        // When a sidebar item is clicked, remove the 'active' class from all items
        // and add it to the clicked item to highlight the current selection
        item.addEventListener("click", () => {
            document.querySelectorAll(".sidebar nav ul li").forEach(li => li.classList.remove("active"));
            item.classList.add("active");
        });
    });

    // Card Interaction Effects
    // Selects all stat cards and pinned cards to add interactive hover effects
    document.querySelectorAll(".stat-card, .pinned-card").forEach(card => {
        // When user presses down on a card, move it slightly down for a "press" effect
        card.addEventListener("mousedown", () => {
            card.style.transform = "translateY(2px)";
        });

        // When user releases the card, return it to its original position
        card.addEventListener("mouseup", () => {
            card.style.transform = "translateY(0)";
        });

        // If user moves mouse away while pressing, ensure card returns to original position
        card.addEventListener("mouseleave", () => {
            card.style.transform = "translateY(0)";
        });
    });

    // Threshold Setting Functionality
    // Get reference to the threshold button element
    const thresholdBtn = document.getElementById("threshold-btn");
    if (thresholdBtn) {
        // Add click event listener to handle threshold updates
        thresholdBtn.addEventListener("click", () => {
            // Prompt user to enter a new threshold value
            let threshold = prompt("Enter Desired Threshold:");
            // Validate that the input is a valid number and not empty
            if (threshold !== null && !isNaN(threshold) && threshold.trim() !== "") {
                // Send POST request to backend endpoint to update threshold
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

    // CSV File Upload Functionality
    // Get reference to the file upload input element
    const uploadInput = document.getElementById("upload-btn");
    if (uploadInput) {
        // Add change event listener to handle file selection
        uploadInput.addEventListener("change", function() {
            // Create FormData object to handle file upload
            let formData = new FormData();
            // Append the selected file to the FormData object
            formData.append("file", this.files[0]);

            // Send POST request to backend endpoint to upload the CSV file
            fetch("/upload_csv", { method: "POST", body: formData })
                .then(response => response.json())
                .then(data => alert(data.message))
                .catch(error => console.error(error));
        });
    }
});
