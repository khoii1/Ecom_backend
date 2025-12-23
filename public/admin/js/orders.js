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
          '<tr><td colspan="9" style="text-align: center;">Không có đơn hàng nào.</td></tr>';
      } else {
        tbody.innerHTML = orders
          .map(
            (order) => {
              const canCancel = ['pending', 'paid', 'processing'].includes(order.status);
              const canAssignShipper = ['paid', 'processing'].includes(order.status) && !order.shipper_id;
              const orderIdStr = order.id || order._id?.toString() || '';
              const safeCode = (order.code || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
              const safeBuyerName = (order.buyer_name || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
              return `
                <tr>
                    <td><strong>${order.code || "-"}</strong></td>
                    <td>
                        <div>${order.buyer_name || "-"}</div>
                        <small style="color: var(--text-secondary);">${order.buyer_email || ""}</small>
                    </td>
                    <td>${order.store_name || "-"}</td>
                    <td><strong>${formatCurrency(order.total || 0)}</strong></td>
                    <td>${formatCurrency(order.shipping_fee || 0)}</td>
                    <td>
                        <span class="badge ${getStatusClass(order.status)}">
                            ${getStatusText(order.status)}
                        </span>
                    </td>
                    <td>
                        ${order.shipper_name ? `
                            <div>${order.shipper_name}</div>
                            <small style="color: var(--text-secondary);">${order.shipper_email || ""}</small>
                        ` : '<span style="color: var(--text-secondary);">Chưa gán</span>'}
                    </td>
                    <td>${formatDate(order.created_at)}</td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button 
                                onclick="openOrderDetailModal('${orderIdStr}')" 
                                class="btn btn-sm btn-info"
                                title="Xem chi tiết"
                            >
                                <i class="fas fa-eye"></i> Chi tiết
                            </button>
                            <button 
                                onclick="openStatusModal('${orderIdStr}', '${safeCode}', '${safeBuyerName}', '${order.status}')" 
                                class="btn btn-sm btn-primary"
                                title="Cập nhật trạng thái"
                            >
                                <i class="fas fa-edit"></i> Cập nhật
                            </button>
                            ${canAssignShipper ? `
                            <button 
                                onclick="openAssignShipperModal('${orderIdStr}', '${safeCode}', '${safeBuyerName}')" 
                                class="btn btn-sm btn-success"
                                title="Gán shipper"
                            >
                                <i class="fas fa-truck"></i> Gán shipper
                            </button>
                            ` : ''}
                            ${canCancel ? `
                            <button 
                                onclick="openCancelOrderModal('${orderIdStr}', '${safeCode}', '${safeBuyerName}')" 
                                class="btn btn-sm btn-danger"
                                title="Hủy đơn hàng"
                            >
                                <i class="fas fa-times-circle"></i> Hủy đơn
                            </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
            }
          )
          .join("");
      }
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Lỗi khi tải danh sách đơn hàng: ${errorData.message}</td></tr>`;
      showAlert("Lỗi khi tải danh sách đơn hàng", "error");
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Đã xảy ra lỗi: ${error.message}</td></tr>`;
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

// Cancel Order Functions
let currentCancelOrderId = null;

function openCancelOrderModal(orderId, orderCode, buyerName) {
  currentCancelOrderId = orderId;
  document.getElementById("cancelOrderCode").textContent = orderCode;
  document.getElementById("cancelBuyerName").textContent = buyerName;
  document.getElementById("cancelReason").value = "";
  
  const modal = document.getElementById("cancelOrderModal");
  modal.style.display = "flex";
  modal.classList.add("show");
}

function closeCancelOrderModal() {
  const modal = document.getElementById("cancelOrderModal");
  modal.style.display = "none";
  modal.classList.remove("show");
  currentCancelOrderId = null;
  document.getElementById("cancelReason").value = "";
}

async function confirmCancelOrder() {
  if (!currentCancelOrderId) {
    showAlert("Không tìm thấy ID đơn hàng", "error");
    return;
  }

  const reason = document.getElementById("cancelReason").value.trim();
  if (!reason) {
    showAlert("Vui lòng nhập lý do hủy đơn", "error");
    return;
  }

  try {
    const response = await apiCall(`/orders/${currentCancelOrderId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    });

    if (response && response.ok) {
      showAlert("Hủy đơn hàng thành công", "success");
      closeCancelOrderModal();
      loadOrders();
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      showAlert(
        `Lỗi khi hủy đơn: ${errorData.message || "Lỗi không xác định"}`,
        "error"
      );
    }
  } catch (error) {
    showAlert(`Đã xảy ra lỗi: ${error.message}`, "error");
  }
}

// Order Detail Modal
let currentDetailOrderId = null;

async function openOrderDetailModal(orderId) {
  currentDetailOrderId = orderId;
  const modal = document.getElementById("orderDetailModal");
  const detailContent = document.getElementById("orderDetailContent");
  
  detailContent.innerHTML = '<div class="text-center"><div class="spinner"></div><p>Đang tải...</p></div>';
  modal.style.display = "flex";
  
  try {
    const response = await apiCall(`/orders/${orderId}`);
    if (response && response.ok) {
      const order = await response.json();
      displayOrderDetail(order);
    } else {
      const errorData = response ? await response.json() : { message: "Network error" };
      detailContent.innerHTML = `<div class="alert alert-danger">Lỗi: ${errorData.message}</div>`;
    }
  } catch (error) {
    detailContent.innerHTML = `<div class="alert alert-danger">Lỗi: ${error.message}</div>`;
  }
}

function displayOrderDetail(order) {
  const detailContent = document.getElementById("orderDetailContent");
  const itemsHtml = order.items?.map(item => {
    const unitPrice = item.unit_price || item.price || 0;
    const quantity = item.qty || item.quantity || 0;
    const subtotal = unitPrice * quantity;
    // Get first image from image_urls array or use image_url
    let productImage = '/images/no-image.png';
    if (item.product_image_urls && Array.isArray(item.product_image_urls) && item.product_image_urls.length > 0) {
      productImage = item.product_image_urls[0];
    } else if (item.product_image_url) {
      productImage = item.product_image_url;
    }
    const safeTitle = (item.product_title || '-').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `
    <tr>
      <td>
        <img src="${productImage}" 
             alt="${safeTitle}" 
             onerror="this.src='/images/no-image.png'"
             style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;">
      </td>
      <td style="max-width: 300px;">
        <div style="font-weight: 500; margin-bottom: 4px;">${item.product_title || '-'}</div>
        ${item.variant_name ? `<small style="color: var(--text-secondary);">${item.variant_name}</small>` : ''}
      </td>
      <td style="text-align: right;">
        <div>${formatCurrency(unitPrice)}</div>
        ${item.original_price && item.original_price > unitPrice ? 
          `<small style="color: var(--text-secondary); text-decoration: line-through; font-size: 11px;">${formatCurrency(item.original_price)}</small>` : ''}
      </td>
      <td style="text-align: center;">${quantity}</td>
      <td style="text-align: right;"><strong>${formatCurrency(subtotal)}</strong></td>
    </tr>
    `;
  }).join('') || '<tr><td colspan="5" class="text-center">Không có sản phẩm</td></tr>';
  
  detailContent.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
      <div>
        <h4 style="margin-bottom: 10px;">Thông tin đơn hàng</h4>
        <p><strong>Mã đơn:</strong> ${order.code || '-'}</p>
        <p><strong>Trạng thái:</strong> <span class="badge ${getStatusClass(order.status)}">${getStatusText(order.status)}</span></p>
        <p><strong>Ngày đặt:</strong> ${formatDate(order.created_at)}</p>
        <p><strong>Phương thức thanh toán:</strong> ${order.payment_method === 'cash' ? 'Tiền mặt' : order.payment_method === 'vnpay' ? 'VNPay' : order.payment_method === 'wallet' ? 'Ví' : order.payment_method || '-'}</p>
      </div>
      <div>
        <h4 style="margin-bottom: 10px;">Thông tin khách hàng</h4>
        <p><strong>Tên:</strong> ${order.buyer_name || '-'}</p>
        <p><strong>Email:</strong> ${order.buyer_email || '-'}</p>
        ${order.shipper_name ? `
        <h4 style="margin-top: 15px; margin-bottom: 10px;">Thông tin shipper</h4>
        <p><strong>Tên:</strong> ${order.shipper_name}</p>
        <p><strong>Email:</strong> ${order.shipper_email || '-'}</p>
        ` : ''}
      </div>
    </div>
    ${order.shipping_address ? `
    <div style="margin-bottom: 20px;">
      <h4 style="margin-bottom: 10px;">Địa chỉ giao hàng</h4>
      <p style="margin: 0; line-height: 1.6;">
        <strong>${order.shipping_address.full_name || ''}</strong>
        ${order.shipping_address.phone ? ` | ${order.shipping_address.phone}` : ''}
        ${order.shipping_address.address || order.shipping_address.ward || order.shipping_address.district || order.shipping_address.province ? 
          ` | ${[order.shipping_address.address, order.shipping_address.ward, order.shipping_address.district, order.shipping_address.province].filter(Boolean).join(', ')}` : ''}
      </p>
    </div>
    ` : ''}
    <div style="margin-bottom: 20px;">
      <h4 style="margin-bottom: 10px;">Sản phẩm</h4>
      <table class="data-table" style="width: 100%;">
        <thead>
          <tr>
            <th>Hình ảnh</th>
            <th>Tên sản phẩm</th>
            <th>Giá</th>
            <th>Số lượng</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </div>
    <div style="border-top: 2px solid #eee; padding-top: 15px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
        <span>Tổng tiền sản phẩm:</span>
        <strong>${formatCurrency(order.subtotal || 0)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
        <span>Phí vận chuyển:</span>
        <strong>${formatCurrency(order.shipping_fee || 0)}</strong>
      </div>
      ${order.discount_amount ? `
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: var(--success-color);">
        <span>Giảm giá:</span>
        <strong>-${formatCurrency(order.discount_amount)}</strong>
      </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold; margin-top: 10px; padding-top: 10px; border-top: 2px solid #ddd;">
        <span>Tổng cộng:</span>
        <span style="color: var(--primary-color);">${formatCurrency(order.total || 0)}</span>
      </div>
    </div>
  `;
}

function closeOrderDetailModal() {
  const modal = document.getElementById("orderDetailModal");
  modal.style.display = "none";
  currentDetailOrderId = null;
}

// Assign Shipper Modal
let currentAssignOrderId = null;
let shippersList = [];

async function openAssignShipperModal(orderId, orderCode, buyerName) {
  currentAssignOrderId = orderId;
  document.getElementById("assignOrderCode").textContent = orderCode;
  document.getElementById("assignBuyerName").textContent = buyerName;
  document.getElementById("shipperSelect").innerHTML = '<option value="">Đang tải...</option>';
  
  const modal = document.getElementById("assignShipperModal");
  modal.style.display = "flex";
  
  // Load shippers
  try {
    const response = await apiCall("/users?role=SHIPPER&limit=100");
    if (response && response.ok) {
      const data = await response.json();
      shippersList = data.users || data;
      const select = document.getElementById("shipperSelect");
      select.innerHTML = '<option value="">-- Chọn shipper --</option>';
      shippersList.forEach(shipper => {
        const option = document.createElement("option");
        option.value = shipper.id || shipper._id;
        option.textContent = `${shipper.full_name || shipper.email} (${shipper.email || ''})`;
        select.appendChild(option);
      });
    } else {
      document.getElementById("shipperSelect").innerHTML = '<option value="">Lỗi khi tải danh sách shipper</option>';
    }
  } catch (error) {
    document.getElementById("shipperSelect").innerHTML = '<option value="">Lỗi khi tải danh sách shipper</option>';
  }
}

function closeAssignShipperModal() {
  const modal = document.getElementById("assignShipperModal");
  modal.style.display = "none";
  currentAssignOrderId = null;
  document.getElementById("shipperSelect").value = "";
}

async function confirmAssignShipper() {
  if (!currentAssignOrderId) {
    showAlert("Không tìm thấy ID đơn hàng", "error");
    return;
  }

  const shipperId = document.getElementById("shipperSelect").value;
  if (!shipperId) {
    showAlert("Vui lòng chọn shipper", "error");
    return;
  }

  try {
    const response = await apiCall(`/orders/${currentAssignOrderId}/assign-shipper`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ shipper_id: shipperId }),
    });

    if (response && response.ok) {
      showAlert("Gán shipper thành công", "success");
      closeAssignShipperModal();
      loadOrders();
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      showAlert(
        `Lỗi khi gán shipper: ${errorData.message || "Lỗi không xác định"}`,
        "error"
      );
    }
  } catch (error) {
    showAlert(`Đã xảy ra lỗi: ${error.message}`, "error");
  }
}

// Close modals when clicking outside
document.addEventListener("click", function (e) {
  const statusModal = document.getElementById("statusModal");
  if (e.target === statusModal) {
    closeStatusModal();
  }
  
  const cancelModal = document.getElementById("cancelOrderModal");
  if (e.target === cancelModal) {
    closeCancelOrderModal();
  }
  
  const detailModal = document.getElementById("orderDetailModal");
  if (e.target === detailModal) {
    closeOrderDetailModal();
  }
  
  const assignModal = document.getElementById("assignShipperModal");
  if (e.target === assignModal) {
    closeAssignShipperModal();
  }
});

