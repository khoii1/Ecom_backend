// Reviews Management Script
// API_BASE_URL is declared in auth.js

let currentPage = 1;
let limit = 20;
let totalReviews = 0;
let currentFilters = {};

// Load reviews when page loads
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

  loadReviews();
  loadStats();
});

// Load reviews with filters
async function loadReviews(page = 1) {
  currentPage = page;
  const offset = (page - 1) * limit;

  try {
    const token = localStorage.getItem("access_token");
    const queryParams = new URLSearchParams({
      limit: limit,
      offset: offset,
      ...currentFilters,
    });

    console.log(
      "Loading reviews from:",
      `${API_BASE_URL}/reviews?${queryParams}`
    );

    const response = await fetch(`${API_BASE_URL}/reviews?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log("Response status:", response.status);

    if (response.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "login.html";
      return;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error("Không thể tải danh sách đánh giá");
    }

    const data = await response.json();
    console.log("Reviews data:", data);

    totalReviews = data.total || 0;

    displayReviews(data.reviews || []);
    displayPagination(data.total || 0, page);
  } catch (error) {
    console.error("Error loading reviews:", error);
    showAlert("Có lỗi khi tải danh sách đánh giá: " + error.message, "danger");

    // Show empty state
    const tbody = document.getElementById("reviewsTableBody");
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem; display: block; color: #ef4444;"></i>
          <div>Có lỗi khi tải dữ liệu</div>
          <div style="font-size: 0.875rem; margin-top: 0.5rem;">${error.message}</div>
        </td>
      </tr>
    `;
  }
}

// Display reviews in table
function displayReviews(reviews) {
  const tbody = document.getElementById("reviewsTableBody");

  if (reviews.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">
          <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
          Không có đánh giá nào
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = reviews
    .map(
      (review) => `
    <tr>
      <td>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${
            review.product_image_url
              ? `<img src="${review.product_image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" />`
              : '<div style="width: 50px; height: 50px; background: #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-image" style="color: #94a3b8;"></i></div>'
          }
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${review.product_title || "N/A"}
            </div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-weight: 500;">${review.user_name || "N/A"}</div>
        <div style="font-size: 0.85rem; color: #64748b;">${
          review.user_email || ""
        }</div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 0.25rem;">
          ${generateStars(review.rating)}
          <span style="font-weight: 600; margin-left: 0.25rem;">${
            review.rating
          }</span>
        </div>
      </td>
      <td>
        <div style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${review.comment || "<i>Không có bình luận</i>"}
        </div>
      </td>
      <td>
        <span style="font-weight: 500;">${review.store_name || "N/A"}</span>
      </td>
      <td>${formatDate(review.created_at)}</td>
      <td>
        <button class="btn btn-info btn-sm" onclick="viewReviewDetail('${
          review.id
        }')" title="Xem chi tiết">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="deleteReview('${
          review.id
        }')" title="Xóa đánh giá">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

// Generate star icons
function generateStars(rating) {
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      stars += '<i class="fas fa-star" style="color: #fbbf24;"></i>';
    } else {
      stars += '<i class="far fa-star" style="color: #d1d5db;"></i>';
    }
  }
  return stars;
}

// Load statistics
async function loadStats() {
  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE_URL}/reviews?limit=1000`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to load stats, status:", response.status);
      return;
    }

    const data = await response.json();
    const reviews = data.reviews || [];

    // Calculate stats
    const total = reviews.length;
    const avgRating =
      total > 0
        ? (
            reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / total
          ).toFixed(1)
        : "0.0";
    const fiveStar = reviews.filter((r) => r.rating === 5).length;
    const oneStar = reviews.filter((r) => r.rating === 1).length;

    document.getElementById("totalReviews").textContent = total;
    document.getElementById("avgRating").textContent = avgRating;
    document.getElementById("fiveStarCount").textContent = fiveStar;
    document.getElementById("oneStarCount").textContent = oneStar;
  } catch (error) {
    console.error("Error loading stats:", error);
    // Set default values on error
    document.getElementById("totalReviews").textContent = "0";
    document.getElementById("avgRating").textContent = "0.0";
    document.getElementById("fiveStarCount").textContent = "0";
    document.getElementById("oneStarCount").textContent = "0";
  }
}

// View review detail
async function viewReviewDetail(reviewId) {
  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE_URL}/reviews?limit=1000`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Không thể tải chi tiết đánh giá");
    }

    const data = await response.json();
    const review = data.reviews.find((r) => r.id === reviewId);

    if (!review) {
      throw new Error("Không tìm thấy đánh giá");
    }

    const modalContent = document.getElementById("reviewDetailContent");
    modalContent.innerHTML = `
      <div style="display: grid; gap: 1.5rem;">
        <div>
          <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Sản phẩm</h4>
          <div style="display: flex; align-items: center; gap: 1rem;">
            ${
              review.product_image_url
                ? `<img src="${review.product_image_url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;" />`
                : ""
            }
            <div>
              <div style="font-weight: 600; font-size: 1.1rem;">${
                review.product_title || "N/A"
              }</div>
              <div style="color: #64748b; margin-top: 0.25rem;">Cửa hàng: ${
                review.store_name || "N/A"
              }</div>
            </div>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Người đánh giá</h4>
          <div style="font-weight: 600;">${review.user_name || "N/A"}</div>
          <div style="color: #64748b;">${review.user_email || ""}</div>
        </div>

        <div>
          <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Đánh giá</h4>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${generateStars(review.rating)}
            <span style="font-weight: 600; font-size: 1.5rem; margin-left: 0.5rem;">${
              review.rating
            }/5</span>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Nội dung</h4>
          <div style="padding: 1rem; background: #f8fafc; border-radius: 8px; line-height: 1.6;">
            ${review.comment || "<i>Không có bình luận</i>"}
          </div>
        </div>

        ${
          review.image_urls && review.image_urls.length > 0
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Hình ảnh</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 1rem;">
              ${review.image_urls
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

        ${
          review.seller_response
            ? `
          <div>
            <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Phản hồi của người bán</h4>
            <div style="padding: 1rem; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 8px; line-height: 1.6;">
              ${review.seller_response}
            </div>
            <div style="color: #64748b; font-size: 0.85rem; margin-top: 0.5rem;">
              ${formatDate(review.seller_response_at)}
            </div>
          </div>
        `
            : ""
        }

        <div>
          <h4 style="margin-bottom: 0.5rem; color: #64748b; font-size: 0.875rem; text-transform: uppercase;">Thông tin khác</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
            <div>
              <div style="color: #64748b;">Mã đơn hàng</div>
              <div style="font-weight: 600;">${review.order_id || "N/A"}</div>
            </div>
            <div>
              <div style="color: #64748b;">Ngày tạo</div>
              <div style="font-weight: 600;">${formatDate(
                review.created_at
              )}</div>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
        <button class="btn btn-secondary" onclick="closeReviewDetailModal()">
          <i class="fas fa-times"></i> Đóng
        </button>
        <button class="btn btn-danger" onclick="deleteReviewFromModal('${reviewId}')">
          <i class="fas fa-trash"></i> Xóa đánh giá
        </button>
      </div>
    `;

    document.getElementById("reviewDetailModal").classList.add("show");
  } catch (error) {
    console.error("Error loading review detail:", error);
    showAlert("Có lỗi khi tải chi tiết đánh giá: " + error.message, "danger");
  }
}

// Close review detail modal
function closeReviewDetailModal() {
  document.getElementById("reviewDetailModal").classList.remove("show");
}

// Delete review from modal
async function deleteReviewFromModal(reviewId) {
  closeReviewDetailModal();
  await deleteReview(reviewId);
}

// Delete review
async function deleteReview(reviewId) {
  if (!confirm("Bạn có chắc chắn muốn xóa đánh giá này?")) {
    return;
  }

  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Không thể xóa đánh giá");
    }

    showAlert("Xóa đánh giá thành công", "success");
    loadReviews(currentPage);
    loadStats();
  } catch (error) {
    console.error("Error deleting review:", error);
    showAlert("Có lỗi khi xóa đánh giá: " + error.message, "danger");
  }
}

// Filter reviews
function filterReviews() {
  currentFilters = {};

  const searchText = document.getElementById("searchReviews").value.trim();
  const rating = document.getElementById("filterRating").value;

  if (rating) {
    currentFilters.rating = rating;
  }

  // Note: Search by text requires backend support
  loadReviews(1);
}

// Reset filters
function resetFilters() {
  document.getElementById("searchReviews").value = "";
  document.getElementById("filterRating").value = "";
  currentFilters = {};
  loadReviews(1);
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
    } onclick="loadReviews(${currentPage - 1})">
      <i class="fas fa-chevron-left"></i> Trước
    </button>
  `;

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    html += `<button class="btn btn-sm btn-secondary" onclick="loadReviews(1)">1</button>`;
    if (startPage > 2) {
      html += `<span style="padding: 0 0.5rem;">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="btn btn-sm ${
        i === currentPage ? "btn-primary" : "btn-secondary"
      }" onclick="loadReviews(${i})">
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span style="padding: 0 0.5rem;">...</span>`;
    }
    html += `<button class="btn btn-sm btn-secondary" onclick="loadReviews(${totalPages})">${totalPages}</button>`;
  }

  html += `
    <button class="btn btn-sm btn-secondary" ${
      currentPage === totalPages ? "disabled" : ""
    } onclick="loadReviews(${currentPage + 1})">
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
  const modal = document.getElementById("reviewDetailModal");
  if (event.target === modal) {
    closeReviewDetailModal();
  }
};
