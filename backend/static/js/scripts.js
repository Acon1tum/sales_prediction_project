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
});