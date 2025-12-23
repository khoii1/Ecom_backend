// Dashboard functionality
let revenueChart = null;
let currentTimeFilter = "all";

document.addEventListener("DOMContentLoaded", function () {
  // Check auth
  const token = localStorage.getItem("access_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  // Time filter change handler
  const timeFilter = document.getElementById("timeFilter");
  if (timeFilter) {
    timeFilter.addEventListener("change", function () {
      currentTimeFilter = this.value;
      refreshDashboard();
    });
  }

  loadDashboardData();
});

function refreshDashboard() {
  loadDashboardData();
}

async function loadDashboardData() {
  try {
    await Promise.all([
      loadStatistics(),
      loadRevenueChart(),
      loadRecentOrders(),
      loadStoresTable(),
    ]);
  } catch (error) {
    showAlert("Lỗi khi tải dữ liệu dashboard", "danger");
  }
}

// Get date range based on filter
function getDateRange() {
  const now = new Date();
  let startDate = new Date();

  switch (currentTimeFilter) {
    case "today":
      startDate.setHours(0, 0, 0, 0);
      break;
    case "7days":
      startDate.setDate(now.getDate() - 7);
      break;
    case "30days":
      startDate.setDate(now.getDate() - 30);
      break;
    case "thisMonth":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "lastMonth":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      now.setDate(0); // Last day of last month
      break;
    case "all":
      startDate = new Date("2000-01-01"); // Very old date to include all
      break;
  }

  return {
    startDate: startDate.toISOString(),
    endDate: now.toISOString(),
  };
}

// Get previous period date range for comparison
function getPreviousDateRange() {
  const current = getDateRange();
  const currentStart = new Date(current.startDate);
  const currentEnd = new Date(current.endDate);
  const duration = currentEnd - currentStart;

  const prevEnd = new Date(currentStart.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - duration);

  return {
    startDate: prevStart.toISOString(),
    endDate: prevEnd.toISOString(),
  };
}

async function loadStatistics() {
  try {
    const token = localStorage.getItem("access_token");
    const dateRange = getDateRange();
    const prevDateRange = getPreviousDateRange();

    // Load current period stats
    const [users, products, categories, stores, banners, ordersResponse] =
      await Promise.all([
        fetch(`${API_BASE_URL}/users`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/products`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/stores/admin/list`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/banners/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/orders?limit=1000`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
      ]);

    const orders = ordersResponse.orders || ordersResponse || [];

    // Filter by date range
    const currentOrders = orders.filter((o) => {
      const orderDate = new Date(o.created_at || o.createdAt);
      return (
        orderDate >= new Date(dateRange.startDate) &&
        orderDate <= new Date(dateRange.endDate)
      );
    });

    const prevOrders = orders.filter((o) => {
      const orderDate = new Date(o.created_at || o.createdAt);
      return (
        orderDate >= new Date(prevDateRange.startDate) &&
        orderDate <= new Date(prevDateRange.endDate)
      );
    });

    // Calculate revenue
    const currentRevenue = currentOrders.reduce(
      (sum, o) => sum + (o.total || o.total_price || 0),
      0
    );
    const prevRevenue = prevOrders.reduce(
      (sum, o) => sum + (o.total || o.total_price || 0),
      0
    );

    // Update UI
    updateStatCard("totalUsers", users.total || users.users?.length || 0, null);
    updateStatCard("totalProducts", products.length, null);
    updateStatCard("totalCategories", categories.length, null);
    updateStatCard("totalStores", stores.length, null);
    updateStatCard("totalBanners", banners.total || 0, null);
    updateStatCard(
      "totalRevenue",
      formatPrice(currentRevenue),
      calculateChange(currentRevenue, prevRevenue)
    );
    updateStatCard(
      "totalOrders",
      currentOrders.length,
      calculateChange(currentOrders.length, prevOrders.length)
    );
  } catch (error) {
    // Silent fail
  }
}

function updateStatCard(elementId, value, changePercent) {
  document.getElementById(elementId).textContent = value;

  if (changePercent !== null) {
    const changeElement = document.getElementById(
      elementId.replace("total", "") + "Change"
    );
    if (changeElement) {
      const isPositive = changePercent > 0;
      const isNegative = changePercent < 0;
      const icon = isPositive ? "↑" : isNegative ? "↓" : "→";

      changeElement.textContent = `${icon} ${Math.abs(changePercent).toFixed(
        1
      )}% so với kỳ trước`;
      changeElement.className =
        "stat-change " +
        (isPositive ? "positive" : isNegative ? "negative" : "neutral");
    }
  }
}

function calculateChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

async function loadRevenueChart() {
  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE_URL}/orders?limit=1000`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const ordersResponse = await response.json();
    const orders = ordersResponse.orders || ordersResponse || [];

    const dateRange = getDateRange();

    // Filter orders by date range
    const filteredOrders = orders.filter((o) => {
      const orderDate = new Date(o.created_at || o.createdAt);
      return (
        orderDate >= new Date(dateRange.startDate) &&
        orderDate <= new Date(dateRange.endDate)
      );
    });

    // Group by date
    const revenueByDate = {};
    filteredOrders.forEach((order) => {
      const orderDate = new Date(order.created_at || order.createdAt);
      if (isNaN(orderDate.getTime())) {
        return;
      }
      const date = orderDate.toISOString().split("T")[0];
      revenueByDate[date] =
        (revenueByDate[date] || 0) + (order.total || order.total_price || 0);
    });

    // Sort dates and prepare chart data
    const sortedDates = Object.keys(revenueByDate).sort();

    if (sortedDates.length === 0) {
      // No data, show message but keep canvas
      const ctx = document.getElementById("revenueChart");
      if (ctx) {
        if (revenueChart) {
          revenueChart.destroy();
          revenueChart = null;
        }
        // Create empty chart
        revenueChart = new Chart(ctx, {
          type: "line",
          data: {
            labels: [],
            datasets: [
              {
                label: "Doanh thu (VNĐ)",
                data: [],
                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.1)",
                tension: 0.4,
                fill: true,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: true, position: "top" },
              title: {
                display: true,
                text: "Không có dữ liệu doanh thu trong khoảng thời gian này",
              },
            },
            scales: {
              y: { beginAtZero: true },
            },
          },
        });
      }
      return;
    }

    const labels = sortedDates.map((d) => {
      const date = new Date(d);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });
    const data = sortedDates.map((d) => revenueByDate[d]);

    // Create or update chart
    const ctx = document.getElementById("revenueChart");
    if (!ctx) {
      return;
    }

    if (revenueChart) {
      revenueChart.destroy();
    }

    revenueChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Doanh thu (VNĐ)",
            data: data,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.1)",
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: "top",
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return "Doanh thu: " + formatPrice(context.parsed.y);
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return formatPrice(value);
              },
            },
          },
        },
      },
    });
  } catch (error) {
    const ctx = document.getElementById("revenueChart");
    if (ctx) {
      const parentDiv = ctx.parentElement;
      parentDiv.innerHTML =
        '<p style="text-align: center; padding: 3rem; color: #ef4444;">Lỗi khi tải biểu đồ: ' +
        error.message +
        "</p>";
    }
  }
}

async function loadRecentOrders() {
  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE_URL}/orders?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const ordersResponse = await response.json();
    const orders = ordersResponse.orders || ordersResponse || [];

    // Sort by created_at desc and take first 10
    const recentOrders = orders
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    const tbody = document.getElementById("recentOrdersBody");

    if (recentOrders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">
            Không có đơn hàng nào
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = recentOrders
      .map(
        (order) => `
      <tr>
        <td><span style="font-weight: 600; color: #2563eb;">${
          order.code || "N/A"
        }</span></td>
        <td>
          <div style="font-weight: 500;">${
            order.buyer_name || order.buyer_id?.full_name || "N/A"
          }</div>
          <div style="font-size: 0.85rem; color: #64748b;">${
            order.buyer_email || order.buyer_id?.email || ""
          }</div>
        </td>
        <td style="font-weight: 600;">${formatPrice(
          order.total || order.total_price || 0
        )}</td>
        <td>${getOrderStatusBadge(order.status)}</td>
        <td>${formatDate(order.created_at || order.createdAt)}</td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    // Silent fail
  }
}

function getOrderStatusBadge(status) {
  const badges = {
    pending: '<span class="badge badge-warning">Chờ xử lý</span>',
    processing: '<span class="badge badge-info">Đang xử lý</span>',
    shipping: '<span class="badge badge-primary">Đang giao</span>',
    delivered: '<span class="badge badge-success">Đã giao</span>',
    completed: '<span class="badge badge-success">Hoàn thành</span>',
    cancelled: '<span class="badge badge-danger">Đã hủy</span>',
  };
  return (
    badges[status] || `<span class="badge badge-secondary">${status}</span>`
  );
}
async function loadStoresTable() {
  const loadingDiv = document.getElementById("storesLoading");
  const table = document.getElementById("storesTable");
  const tbody = document.getElementById("storesTableBody");

  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${API_BASE_URL}/stores/admin/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Không thể tải danh sách cửa hàng");
    }

    const stores = await response.json();

    loadingDiv.style.display = "none";
    table.style.display = "table";

    if (stores.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">
            Chưa có cửa hàng nào
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = stores
      .map(
        (store) => `
      <tr>
        <td style="font-weight: 500;">${store.name || "N/A"}</td>
        <td>${store.owner_name || store.owner_id?.full_name || "N/A"}</td>
        <td style="color: #64748b;">${
          store.owner_email || store.owner_id?.email || ""
        }</td>
        <td>${getStoreStatusBadge(store.status)}</td>
        <td>${formatDate(store.created_at)}</td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    loadingDiv.innerHTML = `
      <p style="color: var(--danger-color);">
        <i class="fas fa-exclamation-triangle"></i> Lỗi khi tải dữ liệu cửa hàng
      </p>
    `;
  }
}

function getStoreStatusBadge(status) {
  const badges = {
    active: '<span class="badge badge-success">Hoạt động</span>',
    inactive: '<span class="badge badge-warning">Không hoạt động</span>',
    suspended: '<span class="badge badge-danger">Đã khóa</span>',
  };
  return (
    badges[status] || `<span class="badge badge-secondary">${status}</span>`
  );
}

function formatPrice(price) {
  return new Intl.NumberFormat("vi-VN").format(price);
}

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
