// Returns Management Script
// API_BASE_URL is already defined in auth.js

let currentPage = 1;
let limit = 20;
let totalReturns = 0;
let currentFilters = {};
let allReturns = [];

// Load returns when page loads
document.addEventListener("DOMContentLoaded", function () {
  // Check authentication
  const token = localStorage.getItem("access_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // Load data
  loadAllReturns();

  // Setup logout button
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_name");
      window.location.href = "login.html";
    });
  }

  // Display admin name
  const adminName = localStorage.getItem("user_name");
  const adminNameEl = document.getElementById("adminName");
  if (adminNameEl && adminName) {
    adminNameEl.innerHTML = `<i class="fas fa-user"></i> ${adminName}`;
  }
});

// Load all returns from all stores
async function loadAllReturns() {
  try {
    const token = localStorage.getItem("access_token");

    // First, get all stores
    const storesResponse = await fetch(`${API_BASE_URL}/stores/admin/list`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!storesResponse.ok) {
      throw new Error("Không thể tải danh sách cửa hàng");
    }

    const stores = await storesResponse.json();

    // Then get returns from each store
    allReturns = [];
    for (const store of stores) {
      try {
        const returnsResponse = await fetch(
          `${API_BASE_URL}/returns/store/${store.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (returnsResponse.ok) {
          const data = await returnsResponse.json();
          // API returns array directly, not wrapped in {returns: []}
          if (Array.isArray(data)) {
            allReturns = allReturns.concat(data);
          }
        }
      } catch (error) {
        console.error(`Error loading returns for store ${store.id}:`, error);
      }
    }

    // Sort by created date (newest first)
    allReturns.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    totalReturns = allReturns.length;
    loadStats();
    displayReturns(currentPage);
  } catch (error) {
    console.error("Error loading returns:", error);
    showAlert("Có lỗi khi tải danh sách trả hàng: " + error.message, "danger");
  }
}

// Display returns with pagination
function displayReturns(page = 1) {
  currentPage = page;
  const offset = (page - 1) * limit;

  // Apply filters
  let filteredReturns = [...allReturns];

  if (currentFilters.status) {
    filteredReturns = filteredReturns.filter(
      (r) => r.status === currentFilters.status
    );
  }

  if (currentFilters.return_type) {
    filteredReturns = filteredReturns.filter(
      (r) => r.return_type === currentFilters.return_type
    );
  }

  if (currentFilters.search) {
    const searchLower = currentFilters.search.toLowerCase();
    filteredReturns = filteredReturns.filter(
      (r) =>
        r.code?.toLowerCase().includes(searchLower) ||
        r.order_code?.toLowerCase().includes(searchLower) ||
        r.buyer_name?.toLowerCase().includes(searchLower) ||
        r.buyer_email?.toLowerCase().includes(searchLower)
    );
  }

  const paginatedReturns = filteredReturns.slice(offset, offset + limit);
  const tbody = document.getElementById("returnsTableBody");

  if (paginatedReturns.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
          <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
          Không có yêu cầu trả hàng nào
        </td>
      </tr>
    `;
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  tbody.innerHTML = paginatedReturns
    .map((returnItem) => {
      // Get first product image from items
      const placeholderImage =
        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"%3E%3Crect fill="%23f1f5f9" width="60" height="60"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="14" font-family="Arial"%3ENo Image%3C/text%3E%3C/svg%3E';
      const firstProductImage =
        returnItem.items?.[0]?.product_id?.image_url ||
        returnItem.images?.[0] ||
        placeholderImage;
      const firstProductName =
        returnItem.items?.[0]?.product_id?.title || "N/A";

      // Get order code - API returns populated order_id object
      const orderCode =
        returnItem.order_id?.code || returnItem.order_code || "N/A";

      // Get buyer info - API returns populated user_id object
      const buyerName =
        returnItem.user_id?.full_name || returnItem.buyer_name || "N/A";
      const buyerEmail =
        returnItem.user_id?.email || returnItem.buyer_email || "";

      return `
    <tr>
      <td>
        <img src="${firstProductImage}" 
             alt="${firstProductName}"
             onerror="this.onerror=null; this.src='${placeholderImage}'"
             style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0;">
      </td>
      <td>
        <div style="font-weight: 500;">${orderCode}</div>
        ${
          returnItem.total_refund_amount
            ? `<div style="font-size: 0.85rem; color: #64748b;">
          ${formatPrice(returnItem.total_refund_amount)}
        </div>`
            : ""
        }
      </td>
      <td>
        <div style="font-weight: 500;">${buyerName}</div>
        <div style="font-size: 0.85rem; color: #64748b;">${buyerEmail}</div>
      </td>
      <td>${getReturnTypeBadge(returnItem.return_type)}</td>
      <td>
        <div style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${
          returnItem.reason || "N/A"
        }">
          ${returnItem.reason || "N/A"}
        </div>
      </td>
      <td>${getStatusBadge(returnItem.status)}</td>
      <td>${formatDate(returnItem.created_at)}</td>
      <td>
        <button class="btn btn-info btn-sm" onclick="viewReturnDetail('${
          returnItem.id || returnItem._id
        }')" title="Xem chi tiết">
          <i class="fas fa-eye"></i>
        </button>
      </td>
    </tr>
  `;
    })
    .join("");

  displayPagination(filteredReturns.length, page);
}

// Get return type badge
function getReturnTypeBadge(type) {
  const badges = {
    refund: '<span class="badge badge-warning">Hoàn tiền</span>',
    exchange: '<span class="badge badge-info">Đổi hàng</span>',
    both: '<span class="badge badge-primary">Cả hai</span>',
  };
  return badges[type] || '<span class="badge badge-secondary">N/A</span>';
}

// Get status badge
function getStatusBadge(status) {
  const badges = {
    pending: '<span class="badge badge-warning">Chờ xử lý</span>',
    approved: '<span class="badge badge-success">Đã chấp nhận</span>',
    rejected: '<span class="badge badge-danger">Đã từ chối</span>',
    processing: '<span class="badge badge-info">Đang xử lý</span>',
    completed: '<span class="badge badge-success">Hoàn thành</span>',
    cancelled: '<span class="badge badge-secondary">Đã hủy</span>',
  };
  return badges[status] || '<span class="badge badge-secondary">N/A</span>';
}

// Load statistics
function loadStats() {
  const total = allReturns.length;
  const pending = allReturns.filter((r) => r.status === "pending").length;
  const approved = allReturns.filter((r) => r.status === "approved").length;
  const completed = allReturns.filter((r) => r.status === "completed").length;

  document.getElementById("totalReturns").textContent = total;
  document.getElementById("pendingReturns").textContent = pending;
  document.getElementById("approvedReturns").textContent = approved;
  document.getElementById("completedReturns").textContent = completed;
}

// View return detail
async function viewReturnDetail(returnId) {
  try {
    const returnItem = allReturns.find((r) => r.id === returnId);

    if (!returnItem) {
      throw new Error("Không tìm thấy yêu cầu trả hàng");
    }

    const modalContent = document.getElementById("returnDetailContent");
    modalContent.innerHTML = `
      <div style="display: grid; gap: 1.5rem;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Mã yêu cầu</h4>
            <div style="font-weight: 600; font-size: 1.25rem; color: #2563eb;">${
              returnItem.code || "N/A"
            }</div>
          </div>
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Trạng thái</h4>
            <div>${getStatusBadge(returnItem.status)}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Mã đơn hàng</h4>
            <div style="font-weight: 600;">${
              returnItem.order_id?.code || returnItem.order_code || "N/A"
            }</div>
          </div>
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Loại yêu cầu</h4>
            <div>${getReturnTypeBadge(returnItem.return_type)}</div>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Khách hàng</h4>
          <div style="font-weight: 600;">${
            returnItem.user_id?.full_name || returnItem.buyer_name || "N/A"
          }</div>
          <div style="color: #64748b;">${
            returnItem.user_id?.email || returnItem.buyer_email || ""
          }</div>
        </div>

        <div>
          <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Lý do trả hàng</h4>
          <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; line-height: 1.6;">
            ${returnItem.reason || "N/A"}
          </div>
        </div>

        ${
          returnItem.description
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Mô tả chi tiết</h4>
            <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; line-height: 1.6;">
              ${returnItem.description}
            </div>
          </div>
        `
            : ""
        }

        ${
          returnItem.items && returnItem.items.length > 0
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Sản phẩm trả hàng</h4>
            <div style="display: grid; gap: 0.75rem;">
              ${returnItem.items
                .map(
                  (item) => `
                <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; display: flex; gap: 1rem; align-items: center;">
                  ${
                    item.product_id?.image_url
                      ? `<img src="${item.product_id.image_url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0;" />`
                      : ""
                  }
                  <div style="flex: 1;">
                    <div style="font-weight: 600;">${
                      item.product_id?.title || item.product_title || "N/A"
                    }</div>
                    <div style="color: #64748b; font-size: 0.85rem;">Số lượng: ${
                      item.qty || 1
                    }</div>
                  </div>
                  <div style="font-weight: 600; color: #2563eb; text-align: right;">
                    ${formatPrice(
                      (item.product_id?.price || item.price || 0) *
                        (item.qty || 1)
                    )}
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        ${
          returnItem.images && returnItem.images.length > 0
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Hình ảnh</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem;">
              ${returnItem.images
                .map(
                  (url) =>
                    `<img src="${url}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px;" />`
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; padding: 1rem; background: #fef3c7; border-radius: 8px;">
          <div>
            <div style="color: #92400e; font-size: 0.875rem;">Số tiền hoàn lại</div>
            <div style="font-weight: 600; font-size: 1.25rem; color: #78350f;">
              ${formatPrice(returnItem.total_refund_amount || 0)}
            </div>
          </div>
          <div>
            <div style="color: #92400e; font-size: 0.875rem;">Ngày tạo</div>
            <div style="font-weight: 600; color: #78350f;">
              ${formatDate(returnItem.created_at)}
            </div>
          </div>
        </div>

        ${
          returnItem.admin_note
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Ghi chú của admin</h4>
            <div style="padding: 1rem; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px; line-height: 1.6;">
              ${returnItem.admin_note}
            </div>
          </div>
        `
            : ""
        }

        ${
          returnItem.approved_at
            ? `
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div>
              <div style="color: #64748b; font-size: 0.875rem;">Ngày chấp nhận</div>
              <div style="font-weight: 600;">${formatDate(
                returnItem.approved_at
              )}</div>
            </div>
            ${
              returnItem.completed_at
                ? `
              <div>
                <div style="color: #64748b; font-size: 0.875rem;">Ngày hoàn thành</div>
                <div style="font-weight: 600;">${formatDate(
                  returnItem.completed_at
                )}</div>
              </div>
            `
                : ""
            }
          </div>
        `
            : ""
        }
      </div>

      <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
        <button class="btn btn-secondary" onclick="closeReturnDetailModal()">
          <i class="fas fa-times"></i> Đóng
        </button>
      </div>
    `;

    document.getElementById("returnDetailModal").classList.add("show");
  } catch (error) {
    console.error("Error loading return detail:", error);
    showAlert("Có lỗi khi tải chi tiết yêu cầu: " + error.message, "danger");
  }
}

// Close return detail modal
function closeReturnDetailModal() {
  document.getElementById("returnDetailModal").classList.remove("show");
}

// Filter returns
function filterReturns() {
  currentFilters = {};

  const searchInput = document.getElementById("searchReturns");
  const statusSelect = document.getElementById("filterStatus");
  const typeSelect = document.getElementById("filterType");

  // Check if elements exist
  if (!searchInput || !statusSelect || !typeSelect) {
    console.error("Filter elements not found");
    return;
  }

  const searchText = searchInput.value.trim();
  const status = statusSelect.value;
  const returnType = typeSelect.value;

  if (searchText) {
    currentFilters.search = searchText;
  }

  if (status) {
    currentFilters.status = status;
  }

  if (returnType) {
    currentFilters.return_type = returnType;
  }

  displayReturns(1);
}

// Reset filters
function resetFilters() {
  const searchInput = document.getElementById("searchReturns");
  const statusSelect = document.getElementById("filterStatus");
  const typeSelect = document.getElementById("filterType");

  if (searchInput) searchInput.value = "";
  if (statusSelect) statusSelect.value = "";
  if (typeSelect) typeSelect.value = "";

  currentFilters = {};
  displayReturns(1);
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
    } onclick="displayReturns(${currentPage - 1})">
      <i class="fas fa-chevron-left"></i> Trước
    </button>
  `;

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    html += `<button class="btn btn-sm btn-secondary" onclick="displayReturns(1)">1</button>`;
    if (startPage > 2) {
      html += `<span style="padding: 0 0.5rem;">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="btn btn-sm ${
        i === currentPage ? "btn-primary" : "btn-secondary"
      }" onclick="displayReturns(${i})">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span style="padding: 0 0.5rem;">...</span>`;
    }
    html += `<button class="btn btn-sm btn-secondary" onclick="displayReturns(${totalPages})">${totalPages}</button>`;
  }

  html += `
    <button class="btn btn-sm btn-secondary" ${
      currentPage === totalPages ? "disabled" : ""
    } onclick="displayReturns(${currentPage + 1})">
      Sau <i class="fas fa-chevron-right"></i>
    </button>
  `;

  pagination.innerHTML = html;
}

// Format price
function formatPrice(price) {
  return new Intl.NumberFormat("vi-VN").format(price);
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
  const modal = document.getElementById("returnDetailModal");
  if (event.target === modal) {
    closeReturnDetailModal();
  }
};
