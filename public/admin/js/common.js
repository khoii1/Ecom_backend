// Common utility functions for admin panel

// Format date to Vietnamese format
function formatDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Truncate text with ellipsis
function truncateText(text, maxLength = 30) {
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Show alert message
function showAlert(message, type = "info") {
  // Remove existing alerts
  const existingAlerts = document.querySelectorAll(".alert-message");
  existingAlerts.forEach((alert) => alert.remove());

  // Create new alert
  const alert = document.createElement("div");
  alert.className = `alert alert-${type} alert-message`;
  alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        padding: 15px 20px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease;
    `;

  const colors = {
    success: { bg: "#d4edda", border: "#c3e6cb", text: "#155724" },
    error: { bg: "#f8d7da", border: "#f5c6cb", text: "#721c24" },
    warning: { bg: "#fff3cd", border: "#ffeaa7", text: "#856404" },
    info: { bg: "#d1ecf1", border: "#bee5eb", text: "#0c5460" },
  };

  const color = colors[type] || colors.info;
  alert.style.backgroundColor = color.bg;
  alert.style.border = `1px solid ${color.border}`;
  alert.style.color = color.text;

  const icon = {
    success: "fas fa-check-circle",
    error: "fas fa-exclamation-circle",
    warning: "fas fa-exclamation-triangle",
    info: "fas fa-info-circle",
  };

  alert.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center;">
                <i class="${
                  icon[type] || icon.info
                }" style="margin-right: 10px;"></i>
                <span>${message}</span>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; font-size: 18px; cursor: pointer; color: ${
                      color.text
                    }; margin-left: 15px;">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

  document.body.appendChild(alert);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (alert.parentElement) {
      alert.remove();
    }
  }, 5000);
}

// Format number with thousand separators
function formatNumber(number) {
  return new Intl.NumberFormat("vi-VN").format(number);
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Search/filter table
function filterTable(tableId, searchValue) {
  const table = document.getElementById(tableId);
  const rows = table
    .getElementsByTagName("tbody")[0]
    .getElementsByTagName("tr");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.getElementsByTagName("td");
    let found = false;

    for (let j = 0; j < cells.length - 1; j++) {
      // Skip action column
      const cell = cells[j];
      if (cell.textContent.toLowerCase().includes(searchValue.toLowerCase())) {
        found = true;
        break;
      }
    }

    row.style.display = found ? "" : "none";
  }
}

// Add search functionality to a table
function addSearchToTable(searchInputId, tableId) {
  const searchInput = document.getElementById(searchInputId);
  if (searchInput) {
    const debouncedFilter = debounce((value) => {
      filterTable(tableId, value);
    }, 300);

    searchInput.addEventListener("input", (e) => {
      debouncedFilter(e.target.value);
    });
  }
}

// Close modal when clicking outside
document.addEventListener("click", function (e) {
  if (
    e.target.classList.contains("modal") &&
    e.target.classList.contains("show")
  ) {
    e.target.classList.remove("show");
  }
});

// Close modal with Escape key
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    const openModal = document.querySelector(".modal.show");
    if (openModal) {
      openModal.classList.remove("show");
    }
  }
});

// Add CSS animation for alerts
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .alert-message {
        animation: slideIn 0.3s ease;
    }
`;
document.head.appendChild(style);
