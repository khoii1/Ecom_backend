// Wallet Management Script
// API_BASE_URL is declared in auth.js

let currentPage = 1;
let limit = 20;
let totalTransactions = 0;
let currentFilters = {};
let allTransactions = [];

// Load data when page loads
document.addEventListener("DOMContentLoaded", function () {
  // Check auth
  const token = localStorage.getItem("access_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // Logout handler
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem("access_token");
      window.location.href = "login.html";
    });
  }

  loadAllData();
});

// Load all transactions
async function loadAllData() {
  try {
    const token = localStorage.getItem("access_token");

    console.log(
      "Loading transactions from:",
      `${API_BASE_URL}/wallet/admin/all-transactions`
    );

    // Load all transactions in batches since API limits to 100 per request
    allTransactions = [];
    let offset = 0;
    const batchLimit = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `${API_BASE_URL}/wallet/admin/all-transactions?limit=${batchLimit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("Response status:", response.status);

      if (response.status === 401) {
        localStorage.removeItem("access_token");
        window.location.href = "login.html";
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response:", errorText);
        throw new Error("Không thể tải danh sách giao dịch");
      }

      const data = await response.json();
      console.log(
        `Loaded batch: ${data.transactions?.length || 0} transactions`
      );

      if (data.transactions && data.transactions.length > 0) {
        allTransactions = allTransactions.concat(data.transactions);
        offset += batchLimit;
        hasMore = data.transactions.length === batchLimit;
      } else {
        hasMore = false;
      }
    }

    console.log("Total transactions loaded:", allTransactions.length);

    // Sort by created date (newest first)
    allTransactions.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    totalTransactions = allTransactions.length;
    loadStats();
    displayTransactions(currentPage);
  } catch (error) {
    console.error("Error loading data:", error);
    showAlert("Có lỗi khi tải dữ liệu: " + error.message, "danger");

    // Show empty state
    const tbody = document.getElementById("transactionsTableBody");
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; display: block; color: #ef4444;"></i>
          <div>Có lỗi khi tải dữ liệu</div>
          <div style="font-size: 0.875rem; margin-top: 0.5rem;">${error.message}</div>
        </td>
      </tr>
    `;
  }
}

// Display transactions with pagination
function displayTransactions(page = 1) {
  currentPage = page;
  const offset = (page - 1) * limit;

  // Apply filters
  let filteredTransactions = [...allTransactions];

  if (currentFilters.type) {
    filteredTransactions = filteredTransactions.filter(
      (t) => t.type === currentFilters.type
    );
  }

  if (currentFilters.status) {
    filteredTransactions = filteredTransactions.filter(
      (t) => t.status === currentFilters.status
    );
  }

  if (currentFilters.search) {
    const searchLower = currentFilters.search.toLowerCase();
    filteredTransactions = filteredTransactions.filter(
      (t) =>
        t.transaction_code?.toLowerCase().includes(searchLower) ||
        t.user_name?.toLowerCase().includes(searchLower) ||
        t.user_email?.toLowerCase().includes(searchLower)
    );
  }

  const paginatedTransactions = filteredTransactions.slice(
    offset,
    offset + limit
  );
  const tbody = document.getElementById("transactionsTableBody");

  if (paginatedTransactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
          <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
          Không có giao dịch nào
        </td>
      </tr>
    `;
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  tbody.innerHTML = paginatedTransactions
    .map(
      (transaction) => `
    <tr>
      <td>
        <span style="font-weight: 600; color: #2563eb;">${
          transaction.transaction_code || "N/A"
        }</span>
      </td>
      <td>
        <div style="font-weight: 500;">${transaction.user_name || "N/A"}</div>
        <div style="font-size: 0.85rem; color: #64748b;">${
          transaction.user_email || ""
        }</div>
      </td>
      <td>${getTypeBadge(transaction.type)}</td>
      <td>
        <div style="font-weight: 600; ${getAmountColor(transaction.type)}">
          ${getAmountSign(transaction.type)}${formatPrice(transaction.amount)}
        </div>
      </td>
      <td>${getStatusBadge(transaction.status)}</td>
      <td>
        <div style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${transaction.description || "N/A"}
        </div>
      </td>
      <td>${formatDate(transaction.created_at)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-icon btn-info" onclick="viewTransactionDetail('${
            transaction.id
          }')" title="Xem chi tiết">
            <i class="fas fa-eye"></i>
          </button>
        </div>
      </td>
    </tr>
  `
    )
    .join("");

  displayPagination(filteredTransactions.length, page);
}

// Get type badge
function getTypeBadge(type) {
  const badges = {
    topup: '<span class="badge badge-success">Nạp tiền</span>',
    payment: '<span class="badge badge-primary">Thanh toán</span>',
    refund: '<span class="badge badge-warning">Hoàn tiền</span>',
    withdrawal: '<span class="badge badge-info">Rút tiền</span>',
  };
  return badges[type] || '<span class="badge badge-secondary">N/A</span>';
}

// Get status badge
function getStatusBadge(status) {
  const badges = {
    pending: '<span class="badge badge-warning">Chờ xử lý</span>',
    completed: '<span class="badge badge-success">Hoàn thành</span>',
    failed: '<span class="badge badge-danger">Thất bại</span>',
    cancelled: '<span class="badge badge-secondary">Đã hủy</span>',
  };
  return badges[status] || '<span class="badge badge-secondary">N/A</span>';
}

// Get amount color
function getAmountColor(type) {
  if (type === "topup" || type === "refund") {
    return "color: #10b981;";
  } else if (type === "payment" || type === "withdrawal") {
    return "color: #ef4444;";
  }
  return "";
}

// Get amount sign
function getAmountSign(type) {
  if (type === "topup" || type === "refund") {
    return "+ ";
  } else if (type === "payment" || type === "withdrawal") {
    return "- ";
  }
  return "";
}

// Load statistics
function loadStats() {
  const total = allTransactions.length;
  const totalTopup = allTransactions
    .filter((t) => t.type === "topup" && t.status === "completed")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalPayment = allTransactions
    .filter((t) => t.type === "payment" && t.status === "completed")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalRefund = allTransactions
    .filter((t) => t.type === "refund" && t.status === "completed")
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  document.getElementById("totalTransactions").textContent = total;
  document.getElementById("totalTopup").textContent =
    formatPriceShort(totalTopup);
  document.getElementById("totalPayment").textContent =
    formatPriceShort(totalPayment);
  document.getElementById("totalRefund").textContent =
    formatPriceShort(totalRefund);
}

// View transaction detail
async function viewTransactionDetail(transactionId) {
  try {
    const transaction = allTransactions.find((t) => t.id === transactionId);

    if (!transaction) {
      throw new Error("Không tìm thấy giao dịch");
    }

    const modalContent = document.getElementById("transactionDetailContent");
    modalContent.innerHTML = `
      <div style="display: grid; gap: 1.5rem;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Mã giao dịch</h4>
            <div style="font-weight: 600; font-size: 1.25rem; color: #2563eb;">${
              transaction.transaction_code || "N/A"
            }</div>
          </div>
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Trạng thái</h4>
            <div>${getStatusBadge(transaction.status)}</div>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Người dùng</h4>
          <div style="font-weight: 600;">${transaction.user_name || "N/A"}</div>
          <div style="color: #64748b;">${transaction.user_email || ""}</div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Loại giao dịch</h4>
            <div>${getTypeBadge(transaction.type)}</div>
          </div>
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Số tiền</h4>
            <div style="font-weight: 600; font-size: 1.5rem; ${getAmountColor(
              transaction.type
            )}">
              ${getAmountSign(transaction.type)}${formatPrice(
      transaction.amount
    )}
            </div>
          </div>
        </div>

        ${
          transaction.description
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Mô tả</h4>
            <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; line-height: 1.6;">
              ${transaction.description}
            </div>
          </div>
        `
            : ""
        }

        ${
          transaction.order_id
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Đơn hàng liên quan</h4>
            <div style="font-weight: 600;">${transaction.order_id}</div>
          </div>
        `
            : ""
        }

        ${
          transaction.payment_method
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Phương thức thanh toán</h4>
            <div style="font-weight: 600;">${transaction.payment_method}</div>
          </div>
        `
            : ""
        }

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Ngày tạo</h4>
            <div style="font-weight: 600;">${formatDate(
              transaction.created_at
            )}</div>
          </div>
          ${
            transaction.completed_at
              ? `
            <div>
              <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Ngày hoàn thành</h4>
              <div style="font-weight: 600;">${formatDate(
                transaction.completed_at
              )}</div>
            </div>
          `
              : ""
          }
        </div>

        ${
          transaction.error_message
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Lỗi</h4>
            <div style="padding: 1rem; background: #fee2e2; color: #991b1b; border-radius: 8px; line-height: 1.6;">
              ${transaction.error_message}
            </div>
          </div>
        `
            : ""
        }
      </div>

      <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
        <button class="btn btn-secondary" onclick="closeTransactionDetailModal()">
          <i class="fas fa-times"></i> Đóng
        </button>
      </div>
    `;

    document.getElementById("transactionDetailModal").style.display = "block";
  } catch (error) {
    console.error("Error loading transaction detail:", error);
    showAlert("Có lỗi khi tải chi tiết giao dịch: " + error.message, "danger");
  }
}

// Close transaction detail modal
function closeTransactionDetailModal() {
  document.getElementById("transactionDetailModal").style.display = "none";
}

// Filter transactions
function filterTransactions() {
  currentFilters = {};

  const searchText = document.getElementById("searchWallet").value.trim();
  const type = document.getElementById("filterType").value;
  const status = document.getElementById("filterStatus").value;

  if (searchText) {
    currentFilters.search = searchText;
  }

  if (type) {
    currentFilters.type = type;
  }

  if (status) {
    currentFilters.status = status;
  }

  displayTransactions(1);
}

// Reset filters
function resetFilters() {
  document.getElementById("searchWallet").value = "";
  document.getElementById("filterType").value = "";
  document.getElementById("filterStatus").value = "";
  currentFilters = {};
  displayTransactions(1);
}

// Display pagination
function displayPagination(total, currentPage) {
  const totalPages = Math.ceil(total / limit);
  const pagination = document.getElementById("pagination");

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = `
    <button class="btn btn-sm btn-secondary" ${
      currentPage === 1 ? "disabled" : ""
    } onclick="displayTransactions(${currentPage - 1})">
      <i class="fas fa-chevron-left"></i> Trước
    </button>
  `;

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    html += `<button class="btn btn-sm btn-secondary" onclick="displayTransactions(1)">1</button>`;
    if (startPage > 2) {
      html += `<span style="padding: 0 0.5rem;">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="btn btn-sm ${
        i === currentPage ? "btn-primary" : "btn-secondary"
      }" onclick="displayTransactions(${i})">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span style="padding: 0 0.5rem;">...</span>`;
    }
    html += `<button class="btn btn-sm btn-secondary" onclick="displayTransactions(${totalPages})">${totalPages}</button>`;
  }

  html += `
    <button class="btn btn-sm btn-secondary" ${
      currentPage === totalPages ? "disabled" : ""
    } onclick="displayTransactions(${currentPage + 1})">
      Sau <i class="fas fa-chevron-right"></i>
    </button>
  `;

  pagination.innerHTML = html;
}

// Format price
function formatPrice(price) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

// Format price short (for stats)
function formatPriceShort(price) {
  if (price >= 1000000000) {
    return (price / 1000000000).toFixed(1) + " tỷ";
  } else if (price >= 1000000) {
    return (price / 1000000).toFixed(1) + " tr";
  } else if (price >= 1000) {
    return (price / 1000).toFixed(0) + " k";
  }
  return formatPrice(price);
}

// Format date
function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Show alert
function showAlert(message, type = "info") {
  const alertContainer = document.getElementById("alert-container");
  const alertId = "alert-" + Date.now();

  const alertColors = {
    success: "var(--success-color)",
    danger: "var(--danger-color)",
    warning: "var(--warning-color)",
    info: "var(--info-color)",
  };

  const alertIcons = {
    success: "fa-check-circle",
    danger: "fa-exclamation-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle",
  };

  const alert = document.createElement("div");
  alert.id = alertId;
  alert.style.cssText = `
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
    border-radius: 8px;
    background: ${alertColors[type] || alertColors.info};
    color: white;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    animation: slideInDown 0.3s ease-out;
  `;

  alert.innerHTML = `
    <i class="fas ${alertIcons[type] || alertIcons.info}"></i>
    <span style="flex: 1;">${message}</span>
    <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1;">
      &times;
    </button>
  `;

  alertContainer.appendChild(alert);

  setTimeout(() => {
    const alertElement = document.getElementById(alertId);
    if (alertElement) {
      alertElement.style.animation = "slideOutUp 0.3s ease-out";
      setTimeout(() => alertElement.remove(), 300);
    }
  }, 5000);
}

// Close modal when clicking outside
window.onclick = function (event) {
  const modal = document.getElementById("transactionDetailModal");
  if (event.target === modal) {
    closeTransactionDetailModal();
  }
};
