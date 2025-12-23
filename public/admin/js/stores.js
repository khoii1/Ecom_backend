// Stores Management Script
// API_BASE_URL is already declared in auth.js

let currentPage = 1;
let limit = 20;
let totalStores = 0;
let currentFilters = {};
let allStores = [];

// Load stores when page loads
document.addEventListener("DOMContentLoaded", function () {
  loadStores();
  setupEditForm();
});

// Load all stores
async function loadStores() {
  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE_URL}/stores/admin/list`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Không thể tải danh sách cửa hàng");
    }

    allStores = await response.json();
    console.log("Stores data:", allStores); // Debug log
    totalStores = allStores.length;

    loadStats();
    displayStores(currentPage);
  } catch (error) {
    console.error("Error loading stores:", error);
    showAlert("Có lỗi khi tải danh sách cửa hàng: " + error.message, "danger");
  }
}

// Display stores with pagination
function displayStores(page = 1) {
  currentPage = page;
  const offset = (page - 1) * limit;

  // Apply filters
  let filteredStores = [...allStores];

  if (currentFilters.status) {
    filteredStores = filteredStores.filter(
      (s) => s.status === currentFilters.status
    );
  }

  if (currentFilters.search) {
    const searchLower = currentFilters.search.toLowerCase();
    filteredStores = filteredStores.filter(
      (s) =>
        s.name?.toLowerCase().includes(searchLower) ||
        s.owner_name?.toLowerCase().includes(searchLower) ||
        s.owner_email?.toLowerCase().includes(searchLower)
    );
  }

  const paginatedStores = filteredStores.slice(offset, offset + limit);
  const tbody = document.getElementById("storesTableBody");

  if (!tbody) {
    console.error("Table body not found");
    return;
  }

  if (paginatedStores.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
          <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
          Không có cửa hàng nào
        </td>
      </tr>
    `;
    document.getElementById("pagination").innerHTML = "";
    return;
  }

  tbody.innerHTML = paginatedStores
    .map(
      (store) => `
    <tr>
      <td>
        <div style="font-weight: 600; color: #0f172a;">${
          store.name || "N/A"
        }</div>
      </td>
      <td>
        <div style="font-weight: 500;">${store.owner_name || "N/A"}</div>
        <div style="font-size: 0.85rem; color: #64748b;">${
          store.owner_email || ""
        }</div>
      </td>
      <td>
        <div style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${store.address || "Chưa cập nhật"}
        </div>
      </td>
      <td>${store.phone || store.owner_phone || "N/A"}</td>
      <td>${getStatusBadge(store.status)}</td>
      <td>${formatDate(store.createdAt)}</td>
      <td>
        <button class="btn btn-info btn-sm" onclick="viewStoreDetail('${
          store.id
        }')" style="margin-right: 0.5rem;" title="Xem chi tiết">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-warning btn-sm" onclick="editStore('${
          store.id
        }')" style="margin-right: 0.5rem;" title="Chỉnh sửa">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-${
          store.status === "active" ? "secondary" : "success"
        } btn-sm" 
          onclick="toggleStoreStatus('${store.id}', '${store.status}')" 
          title="${store.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}">
          <i class="fas fa-${store.status === "active" ? "ban" : "check"}"></i>
        </button>
      </td>
    </tr>
  `
    )
    .join("");

  displayPagination(filteredStores.length, page);
}

// Get status badge
function getStatusBadge(status) {
  const badges = {
    active: '<span class="badge badge-success">Hoạt động</span>',
    inactive: '<span class="badge badge-secondary">Ngừng hoạt động</span>',
  };
  return badges[status] || '<span class="badge badge-secondary">N/A</span>';
}

// Load statistics
function loadStats() {
  const total = allStores.length;
  const active = allStores.filter((s) => s.status === "active").length;
  const inactive = allStores.filter((s) => s.status === "inactive").length;

  // Calculate new stores this month
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const newStores = allStores.filter((s) => {
    const createdDate = new Date(s.createdAt);
    return createdDate >= thisMonth;
  }).length;

  const totalStoresEl = document.getElementById("totalStores");
  const activeStoresEl = document.getElementById("activeStores");
  const inactiveStoresEl = document.getElementById("inactiveStores");
  const newStoresEl = document.getElementById("newStores");

  if (totalStoresEl) totalStoresEl.textContent = total;
  if (activeStoresEl) activeStoresEl.textContent = active;
  if (inactiveStoresEl) inactiveStoresEl.textContent = inactive;
  if (newStoresEl) newStoresEl.textContent = newStores;
}

// View store detail
async function viewStoreDetail(storeId) {
  try {
    const store = allStores.find((s) => s.id === storeId);

    if (!store) {
      throw new Error("Không tìm thấy cửa hàng");
    }

    // Get products for this store
    const token = localStorage.getItem("access_token");
    let productCount = 0;
    let products = [];
    try {
      const productsResponse = await fetch(
        `${API_BASE_URL}/products?store_id=${storeId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        // API trả về trực tiếp mảng products, không có wrapper object
        if (Array.isArray(productsData)) {
          products = productsData;
          productCount = products.length;
        } else if (productsData.products) {
          // Backup: nếu có wrapper object
          products = productsData.products || [];
          productCount = productsData.total || products.length;
        }
      }
    } catch (error) {
      console.error("Error loading products:", error);
    }

    const modalContent = document.getElementById("storeDetailContent");
    const storeDetailModal = document.getElementById("storeDetailModal");

    if (!modalContent || !storeDetailModal) {
      throw new Error("Không tìm thấy modal");
    }

    modalContent.innerHTML = `
      <div style="display: grid; gap: 1.5rem;">
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Tên cửa hàng</h4>
            <div style="font-weight: 600; font-size: 1.25rem;">${
              store.name || "N/A"
            }</div>
          </div>
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Trạng thái</h4>
            <div>${getStatusBadge(store.status)}</div>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Chủ cửa hàng</h4>
          <div style="font-weight: 600;">${store.owner_name || "N/A"}</div>
          <div style="color: #64748b;">${store.owner_email || ""}</div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Số điện thoại</h4>
            <div style="font-weight: 600;">${
              store.phone || store.owner_phone || "Chưa cập nhật"
            }</div>
          </div>
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Số sản phẩm</h4>
            <div style="font-weight: 600;">${productCount}</div>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Địa chỉ</h4>
          <div style="padding: 1rem; background: #f8fafc; border-radius: 8px;">
            ${store.address || "Chưa cập nhật"}
          </div>
        </div>

        ${
          store.description
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Mô tả</h4>
            <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; line-height: 1.6;">
              ${store.description}
            </div>
          </div>
        `
            : ""
        }

        ${
          products.length > 0
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Sản phẩm đã đăng (${productCount})</h4>
            <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead style="position: sticky; top: 0; background: #f8fafc; z-index: 1;">
                  <tr>
                    <th style="padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; font-weight: 600;">Hình ảnh</th>
                    <th style="padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; font-weight: 600;">Tên sản phẩm</th>
                    <th style="padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; font-weight: 600;">Giá</th>
                    <th style="padding: 0.75rem; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; font-weight: 600;">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  ${products
                    .map(
                      (product) => `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 0.75rem;">
                        <img src="${
                          product.image_url ||
                          product.thumbnail ||
                          "/images/placeholder.png"
                        }" 
                             alt="${product.title || "N/A"}"
                             onerror="this.src='/images/placeholder.png'"
                             style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #e2e8f0;">
                      </td>
                      <td style="padding: 0.75rem; font-weight: 500;">
                        ${product.title || "N/A"}
                      </td>
                      <td style="padding: 0.75rem;">
                        ${formatPrice(product.price)}
                      </td>
                      <td style="padding: 0.75rem;">
                        <span class="badge ${getProductStatusBadge(
                          product.status
                        )}">
                          ${getProductStatusText(product.status)}
                        </span>
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          </div>
        `
            : `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Sản phẩm đã đăng</h4>
            <div style="padding: 2rem; text-align: center; background: #f8fafc; border-radius: 8px; color: #94a3b8;">
              <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
              Chưa có sản phẩm nào
            </div>
          </div>
        `
        }

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Ngày tạo</h4>
            <div style="font-weight: 600;">${formatDate(store.createdAt)}</div>
          </div>
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Cập nhật lần cuối</h4>
            <div style="font-weight: 600;">${formatDate(store.updatedAt)}</div>
          </div>
        </div>
      </div>

      <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
        <button class="btn btn-secondary" onclick="closeStoreDetailModal()">
          <i class="fas fa-times"></i> Đóng
        </button>
        <button class="btn btn-primary" onclick="closeStoreDetailModal(); editStore('${
          store.id
        }')">
          <i class="fas fa-edit"></i> Chỉnh sửa
        </button>
      </div>
    `;

    storeDetailModal.classList.add("show");
  } catch (error) {
    console.error("Error loading store detail:", error);
    showAlert("Có lỗi khi tải chi tiết cửa hàng: " + error.message, "danger");
  }
}

// Close store detail modal
function closeStoreDetailModal() {
  const modal = document.getElementById("storeDetailModal");
  if (modal) {
    modal.classList.remove("show");
  }
}

// Edit store
function editStore(storeId) {
  const store = allStores.find((s) => s.id === storeId);

  if (!store) {
    showAlert("Không tìm thấy cửa hàng", "danger");
    return;
  }

  const editStoreId = document.getElementById("editStoreId");
  const editStoreName = document.getElementById("editStoreName");
  const editStoreStatus = document.getElementById("editStoreStatus");
  const editStoreAddress = document.getElementById("editStoreAddress");
  const editStorePhone = document.getElementById("editStorePhone");
  const editStoreDescription = document.getElementById("editStoreDescription");
  const editStoreModal = document.getElementById("editStoreModal");

  if (!editStoreId || !editStoreName || !editStoreStatus || !editStoreModal) {
    console.error("Required form elements not found");
    showAlert("Không thể mở form chỉnh sửa", "danger");
    return;
  }

  editStoreId.value = store.id;
  editStoreName.value = store.name || "";
  editStoreStatus.value = store.status || "active";
  if (editStoreAddress) editStoreAddress.value = store.address || "";
  if (editStorePhone) editStorePhone.value = store.phone || "";
  if (editStoreDescription)
    editStoreDescription.value = store.description || "";

  editStoreModal.classList.add("show");
}

// Close edit store modal
function closeEditStoreModal() {
  const editStoreModal = document.getElementById("editStoreModal");
  const editStoreForm = document.getElementById("editStoreForm");

  if (editStoreModal) {
    editStoreModal.classList.remove("show");
  }
  if (editStoreForm) {
    editStoreForm.reset();
  }
}

// Setup edit form
function setupEditForm() {
  const editForm = document.getElementById("editStoreForm");
  if (!editForm) {
    console.warn("Edit form not found");
    return;
  }

  editForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const storeId = document.getElementById("editStoreId").value;
    const name = document.getElementById("editStoreName").value.trim();
    const status = document.getElementById("editStoreStatus").value;
    const address = document.getElementById("editStoreAddress").value.trim();
    const phone = document.getElementById("editStorePhone").value.trim();
    const description = document
      .getElementById("editStoreDescription")
      .value.trim();

    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${API_BASE_URL}/stores/${storeId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          status,
          address,
          phone,
          description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Không thể cập nhật cửa hàng");
      }

      showAlert("Cập nhật cửa hàng thành công", "success");
      closeEditStoreModal();
      loadStores();
    } catch (error) {
      console.error("Error updating store:", error);
      showAlert("Có lỗi khi cập nhật cửa hàng: " + error.message, "danger");
    }
  });
}

// Toggle store status
async function toggleStoreStatus(storeId, currentStatus) {
  const newStatus = currentStatus === "active" ? "inactive" : "active";
  const confirmMessage =
    newStatus === "inactive"
      ? "Bạn có chắc chắn muốn vô hiệu hóa cửa hàng này?"
      : "Bạn có chắc chắn muốn kích hoạt lại cửa hàng này?";

  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    const token = localStorage.getItem("access_token");
    const store = allStores.find((s) => s.id === storeId);

    const response = await fetch(`${API_BASE_URL}/stores/${storeId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: store.name,
        status: newStatus,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Không thể cập nhật trạng thái");
    }

    showAlert(
      `Đã ${
        newStatus === "inactive" ? "vô hiệu hóa" : "kích hoạt"
      } cửa hàng thành công`,
      "success"
    );
    loadStores();
  } catch (error) {
    console.error("Error toggling store status:", error);
    showAlert(
      "Có lỗi khi cập nhật trạng thái cửa hàng: " + error.message,
      "danger"
    );
  }
}

// Filter stores
function filterStores() {
  currentFilters = {};

  const searchInput = document.getElementById("searchStores");
  const statusInput = document.getElementById("filterStatus");

  const searchText = searchInput ? searchInput.value.trim() : "";
  const status = statusInput ? statusInput.value : "";

  if (searchText) {
    currentFilters.search = searchText;
  }

  if (status) {
    currentFilters.status = status;
  }

  displayStores(1);
}

// Reset filters
function resetFilters() {
  const searchInput = document.getElementById("searchStores");
  const statusInput = document.getElementById("filterStatus");

  if (searchInput) searchInput.value = "";
  if (statusInput) statusInput.value = "";

  currentFilters = {};
  displayStores(1);
}

// Display pagination
function displayPagination(total, currentPage) {
  const totalPages = Math.ceil(total / limit);
  const pagination = document.getElementById("pagination");

  if (!pagination) {
    console.error("Pagination element not found");
    return;
  }

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = `
    <button class="btn btn-sm btn-secondary" ${
      currentPage === 1 ? "disabled" : ""
    } onclick="displayStores(${currentPage - 1})">
      <i class="fas fa-chevron-left"></i> Trước
    </button>
  `;

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    html += `<button class="btn btn-sm btn-secondary" onclick="displayStores(1)">1</button>`;
    if (startPage > 2) {
      html += `<span style="padding: 0 0.5rem;">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="btn btn-sm ${
        i === currentPage ? "btn-primary" : "btn-secondary"
      }" onclick="displayStores(${i})">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span style="padding: 0 0.5rem;">...</span>`;
    }
    html += `<button class="btn btn-sm btn-secondary" onclick="displayStores(${totalPages})">${totalPages}</button>`;
  }

  html += `
    <button class="btn btn-sm btn-secondary" ${
      currentPage === totalPages ? "disabled" : ""
    } onclick="displayStores(${currentPage + 1})">
      Sau <i class="fas fa-chevron-right"></i>
    </button>
  `;

  pagination.innerHTML = html;
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

// Format price
function formatPrice(price) {
  if (!price) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

// Get product status class
function getProductStatusClass(status) {
  switch (status) {
    case "available":
      return "btn-success";
    case "out_of_stock":
      return "btn-warning";
    case "discontinued":
      return "btn-danger";
    default:
      return "btn-secondary";
  }
}

// Get product status badge class
function getProductStatusBadge(status) {
  switch (status) {
    case "active":
      return "badge-success";
    case "inactive":
      return "badge-secondary";
    default:
      return "badge-secondary";
  }
}

// Get product status text
function getProductStatusText(status) {
  switch (status) {
    case "active":
      return "Hoạt động";
    case "inactive":
      return "Ngừng bán";
    default:
      return "N/A";
  }
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
  const storeDetailModal = document.getElementById("storeDetailModal");
  const editStoreModal = document.getElementById("editStoreModal");

  if (event.target === storeDetailModal) {
    closeStoreDetailModal();
  }
  if (event.target === editStoreModal) {
    closeEditStoreModal();
  }
};
