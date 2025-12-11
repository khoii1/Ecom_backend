// Orders management functionality

let currentOrderId = null;

document.addEventListener("DOMContentLoaded", function () {
  loadOrders();
  
  // Filter by status
  document.getElementById("statusFilter").addEventListener("change", function () {
    loadOrders();
  });
  
  // Search orders
  const searchInput = document.getElementById("searchOrders");
  const debouncedSearch = debounce(() => {
    loadOrders();
  }, 300);
  searchInput.addEventListener("input", debouncedSearch);
});

async function loadOrders() {
  const loadingDiv = document.getElementById("ordersLoading");
  const table = document.getElementById("ordersTable");
  const tbody = document.getElementById("ordersTableBody");
  const statusFilter = document.getElementById("statusFilter").value;
  const searchQuery = document.getElementById("searchOrders").value;

  // Show loading, hide table
  loadingDiv.style.display = "block";
  table.style.display = "none";
  tbody.innerHTML = "";

  try {
    let url = "/orders?limit=100";
    if (statusFilter) {
      url += `&status=${statusFilter}`;
    }

    const response = await apiCall(url);

    if (response && response.ok) {
      let orders = await response.json();

      // Client-side search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        orders = orders.filter(
          (order) =>
            order.code?.toLowerCase().includes(query) ||
            order.buyer_name?.toLowerCase().includes(query) ||
            order.buyer_email?.toLowerCase().includes(query) ||
            order.store_name?.toLowerCase().includes(query)
        );
      }

      if (orders.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="7" style="text-align: center;">Không có đơn hàng nào.</td></tr>';
      } else {
        tbody.innerHTML = orders
          .map(
            (order) => `
                <tr>
                    <td><strong>${order.code || "-"}</strong></td>
                    <td>
                        <div>${order.buyer_name || "-"}</div>
                        <small style="color: #666;">${order.buyer_email || ""}</small>
                    </td>
                    <td>${order.store_name || "-"}</td>
                    <td><strong>${formatCurrency(order.total || 0)}</strong></td>
                    <td>
                        <span class="badge ${getStatusClass(order.status)}">
                            ${getStatusText(order.status)}
                        </span>
                    </td>
                    <td>${formatDate(order.created_at)}</td>
                    <td>
                        <button 
                            onclick="openStatusModal(${order.id}, '${order.code}', '${order.buyer_name || ""}', '${order.status}')" 
                            class="btn btn-sm btn-primary"
                            style="padding: 5px 10px; font-size: 12px;"
                        >
                            <i class="fas fa-edit"></i> Cập nhật
                        </button>
                    </td>
                </tr>
            `
          )
          .join("");
      }
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      console.error("Error fetching orders:", errorData);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Lỗi khi tải danh sách đơn hàng: ${errorData.message}</td></tr>`;
      showAlert("Lỗi khi tải danh sách đơn hàng", "error");
    }
  } catch (error) {
    console.error("Error in loadOrders:", error);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Đã xảy ra lỗi: ${error.message}</td></tr>`;
    showAlert("Đã xảy ra lỗi khi tải đơn hàng", "error");
  } finally {
    loadingDiv.style.display = "none";
    table.style.display = "table";
  }
}

function getStatusClass(status) {
  const statusClasses = {
    pending: "btn-warning btn-sm",
    paid: "btn-info btn-sm",
    payment_failed: "btn-danger btn-sm",
    processing: "btn-primary btn-sm",
    shipped: "btn-primary btn-sm",
    delivered: "btn-success btn-sm",
    cancelled: "btn-secondary btn-sm",
  };
  return statusClasses[status] || "btn-secondary btn-sm";
}

function getStatusText(status) {
  const statusTexts = {
    pending: "Chờ xử lý",
    paid: "Đã thanh toán",
    payment_failed: "Thanh toán thất bại",
    processing: "Đang xử lý",
    shipped: "Đã giao hàng",
    delivered: "Đã nhận hàng",
    cancelled: "Đã hủy",
  };
  return statusTexts[status] || status;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);
}

function openStatusModal(orderId, orderCode, buyerName, currentStatus) {
  currentOrderId = orderId;
  document.getElementById("modalOrderCode").textContent = orderCode;
  document.getElementById("modalBuyerName").textContent = buyerName;
  document.getElementById("modalCurrentStatus").textContent = getStatusText(currentStatus);
  document.getElementById("newStatus").value = currentStatus;
  
  const modal = document.getElementById("statusModal");
  modal.style.display = "flex";
}

function closeStatusModal() {
  const modal = document.getElementById("statusModal");
  modal.style.display = "none";
  currentOrderId = null;
}

async function updateOrderStatus() {
  if (!currentOrderId) {
    showAlert("Không tìm thấy ID đơn hàng", "error");
    return;
  }

  const newStatus = document.getElementById("newStatus").value;
  if (!newStatus) {
    showAlert("Vui lòng chọn trạng thái mới", "error");
    return;
  }

  try {
    const response = await apiCall(`/orders/${currentOrderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (response && response.ok) {
      showAlert("Cập nhật trạng thái đơn hàng thành công", "success");
      closeStatusModal();
      loadOrders(); // Reload orders list
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      showAlert(
        `Lỗi khi cập nhật: ${errorData.message || "Lỗi không xác định"}`,
        "error"
      );
    }
  } catch (error) {
    console.error("Error updating order status:", error);
    showAlert(`Đã xảy ra lỗi: ${error.message}`, "error");
  }
}

// Close modal when clicking outside
document.addEventListener("click", function (e) {
  const modal = document.getElementById("statusModal");
  if (e.target === modal) {
    closeStatusModal();
  }
});

