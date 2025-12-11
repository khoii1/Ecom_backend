// Dashboard functionality

document.addEventListener("DOMContentLoaded", function () {
  loadDashboardData();
});

async function loadDashboardData() {
  try {
    // Load statistics
    await loadStatistics();

    // Load stores table (thay thế cho recent activity)
    await loadStoresTable(); // <--- SỬA Ở ĐÂY: Gọi hàm mới
  } catch (error) {
    console.error("Error loading dashboard:", error);
    showAlert("Lỗi khi tải dữ liệu dashboard", "error");
  }
}

async function loadStatistics() {
  try {
    // Load users count
    const usersResponse = await apiCall("/users");
    if (usersResponse && usersResponse.ok) {
      const users = await usersResponse.json();
      document.getElementById("totalUsers").textContent = users.length;
    } else {
      document.getElementById("totalUsers").textContent = "Lỗi";
    }

    // Load products count
    const productsResponse = await apiCall("/products");
    if (productsResponse && productsResponse.ok) {
      const products = await productsResponse.json();
      document.getElementById("totalProducts").textContent = products.length;
    } else {
      document.getElementById("totalProducts").textContent = "Lỗi";
    }

    // Load categories count
    const categoriesResponse = await apiCall("/categories");
    if (categoriesResponse && categoriesResponse.ok) {
      const categories = await categoriesResponse.json();
      document.getElementById("totalCategories").textContent =
        categories.length;
    } else {
      document.getElementById("totalCategories").textContent = "Lỗi";
    }

    // Load stores count
    const storesResponse = await apiCall("/stores/admin/list");
    if (storesResponse && storesResponse.ok) {
      const stores = await storesResponse.json();
      document.getElementById("totalStores").textContent = stores.length;
    } else {
      document.getElementById("totalStores").textContent = "Lỗi";
    }

    // Load banners count
    const bannersResponse = await apiCall("/banners/stats");
    if (bannersResponse && bannersResponse.ok) {
      const bannersStats = await bannersResponse.json();
      document.getElementById("totalBanners").textContent = bannersStats.total || 0;
    } else {
      document.getElementById("totalBanners").textContent = "Lỗi";
    }

    // Load analytics data (revenue & orders)
    const analyticsResponse = await apiCall("/analytics/overview");
    if (analyticsResponse && analyticsResponse.ok) {
      const analytics = await analyticsResponse.json();
      document.getElementById("totalRevenue").textContent = formatCurrency(analytics.revenue.total);
      document.getElementById("totalOrders").textContent = analytics.orders.total;
    } else {
      document.getElementById("totalRevenue").textContent = "Lỗi";
      document.getElementById("totalOrders").textContent = "Lỗi";
    }
  } catch (error) {
    console.error("Error loading statistics:", error);
    document.getElementById("totalUsers").textContent = "Lỗi";
    document.getElementById("totalProducts").textContent = "Lỗi";
    document.getElementById("totalCategories").textContent = "Lỗi";
    document.getElementById("totalStores").textContent = "Lỗi";
    document.getElementById("totalBanners").textContent = "Lỗi";
    document.getElementById("totalRevenue").textContent = "Lỗi";
    document.getElementById("totalOrders").textContent = "Lỗi";
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

// XÓA: Hàm loadRecentActivity() không còn dùng nữa

// THÊM MỚI: Hàm để tải và hiển thị bảng cửa hàng
async function loadStoresTable() {
  const loadingDiv = document.getElementById("storesLoading");
  const table = document.getElementById("storesTable");
  const tbody = document.getElementById("storesTableBody");

  // Hiển thị loading, ẩn bảng
  loadingDiv.style.display = "block";
  table.style.display = "none";
  tbody.innerHTML = ""; // Xóa nội dung cũ

  try {
    // Gọi API mới bạn đã tạo (/stores/admin/list)
    const response = await apiCall("/stores/admin/list");

    if (response && response.ok) {
      const stores = await response.json();

      if (stores.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="5" style="text-align: center;">Không có cửa hàng nào.</td></tr>';
      } else {
        tbody.innerHTML = stores
          .map(
            (store) => `
                <tr>
                    <td>${store.name || "N/A"}</td>
                    <td>${store.owner_name || "N/A"}</td>
                    <td>${store.owner_email || "N/A"}</td>
                    <td>
                        <span class="badge ${getStoreStatusClass(
                          store.status
                        )}">
                            ${getStoreStatusText(store.status)}
                        </span>
                    </td>
                    <td>${formatDate(store.created_at)}</td>
                    </tr>
            `
          )
          .join("");
      }
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      console.error("Error fetching stores:", errorData);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Lỗi khi tải danh sách cửa hàng: ${errorData.message}</td></tr>`;
      showAlert("Lỗi khi tải danh sách cửa hàng", "error");
    }
  } catch (error) {
    console.error("Error in loadStoresTable:", error);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Đã xảy ra lỗi: ${error.message}</td></tr>`;
    showAlert("Đã xảy ra lỗi khi tải cửa hàng", "error");
  } finally {
    // Ẩn loading và hiện table (ngay cả khi có lỗi)
    loadingDiv.style.display = "none";
    table.style.display = "table";
  }
}

// THÊM MỚI: Helper functions cho trạng thái cửa hàng
function getStoreStatusClass(status) {
  switch (status) {
    case "active":
      return "btn-success btn-sm"; // Màu xanh cho hoạt động
    case "inactive":
      return "btn-secondary btn-sm"; // Màu xám cho không hoạt động
    default:
      return "btn-warning btn-sm"; // Màu vàng cho trạng thái khác (nếu có)
  }
}

function getStoreStatusText(status) {
  switch (status) {
    case "active":
      return "Hoạt động";
    case "inactive":
      return "Không hoạt động";
    default:
      return status || "Không xác định"; // Hiển thị trạng thái gốc nếu không khớp
  }
}
