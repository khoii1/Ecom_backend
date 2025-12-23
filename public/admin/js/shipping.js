// Shipping management functionality

let shippingMethods = [];
let currentShippingId = null;

document.addEventListener("DOMContentLoaded", function () {
  loadShippingMethods();
});

async function loadShippingMethods() {
  const loadingDiv = document.getElementById("shippingLoading");
  const table = document.getElementById("shippingTable");
  const tbody = document.getElementById("shippingTableBody");

  loadingDiv.style.display = "block";
  table.style.display = "none";
  tbody.innerHTML = "";

  try {
    const response = await apiCall("/shipping/methods");

    if (response && response.ok) {
      shippingMethods = await response.json();

      if (shippingMethods.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="9" style="text-align: center;">Không có phương thức vận chuyển nào.</td></tr>';
      } else {
        tbody.innerHTML = shippingMethods
          .map(
            (method) => {
              const methodId = method.id || method._id?.toString() || '';
              const safeName = (method.name || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
              return `
            <tr>
              <td><strong>${method.code || "-"}</strong></td>
              <td>${method.name || "-"}</td>
              <td>${method.description || "-"}</td>
              <td>${formatCurrency(method.base_cost || 0)}</td>
              <td>${method.cost_per_km ? formatCurrency(method.cost_per_km) : "-"}</td>
              <td>${method.cost_per_kg ? formatCurrency(method.cost_per_kg) : "-"}</td>
              <td>${method.estimated_delivery_time ? method.estimated_delivery_time + " ngày" : "-"}</td>
              <td>
                <span class="badge ${method.is_active ? "btn-success" : "btn-secondary"} btn-sm">
                  ${method.is_active ? "Hoạt động" : "Không hoạt động"}
                </span>
              </td>
              <td>
                <button 
                  onclick="openEditShippingModal('${methodId}')" 
                  class="btn btn-sm btn-primary"
                  style="margin-right: 0.5rem;"
                  title="Sửa phương thức vận chuyển"
                >
                  <i class="fas fa-edit"></i> Sửa
                </button>
                <button 
                  onclick="deleteShippingMethod('${methodId}', '${safeName}')" 
                  class="btn btn-sm btn-danger"
                  title="Xóa phương thức vận chuyển"
                >
                  <i class="fas fa-trash"></i> Xóa
                </button>
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
      showAlert(`Lỗi khi tải danh sách: ${errorData.message}`, "error");
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Lỗi khi tải dữ liệu: ${errorData.message}</td></tr>`;
    }
  } catch (error) {
    showAlert(`Đã xảy ra lỗi: ${error.message}`, "error");
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">Đã xảy ra lỗi: ${error.message}</td></tr>`;
  } finally {
    loadingDiv.style.display = "none";
    table.style.display = "table";
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value || 0);
}

function openAddShippingModal() {
  currentShippingId = null;
  document.getElementById("shippingModalTitle").textContent = "Thêm phương thức vận chuyển";
  document.getElementById("shippingForm").reset();
  document.getElementById("shippingId").value = "";
  document.getElementById("shippingIsActive").value = "true";
  
  const modal = document.getElementById("shippingModal");
  modal.style.display = "flex";
  modal.classList.add("show");
}

function openEditShippingModal(id) {
  const method = shippingMethods.find((m) => (m.id || m._id?.toString()) === id);
  if (!method) {
    showAlert("Không tìm thấy phương thức vận chuyển", "error");
    return;
  }

  currentShippingId = id;
  document.getElementById("shippingModalTitle").textContent = "Sửa phương thức vận chuyển";
  document.getElementById("shippingId").value = method.id || method._id?.toString() || id;
  document.getElementById("shippingCode").value = method.code || "";
  document.getElementById("shippingName").value = method.name || "";
  document.getElementById("shippingDescription").value = method.description || "";
  document.getElementById("shippingBaseCost").value = method.base_cost || 0;
  document.getElementById("shippingCostPerKm").value = method.cost_per_km || "";
  document.getElementById("shippingCostPerKg").value = method.cost_per_kg || "";
  document.getElementById("shippingDeliveryTime").value = method.estimated_delivery_time || "";
  document.getElementById("shippingMinWeight").value = method.min_weight || "";
  document.getElementById("shippingMaxWeight").value = method.max_weight || "";
  document.getElementById("shippingMaxDistance").value = method.max_distance || "";
  document.getElementById("shippingIsActive").value = method.is_active ? "true" : "false";

  const modal = document.getElementById("shippingModal");
  modal.style.display = "flex";
  modal.classList.add("show");
}

function closeShippingModal() {
  const modal = document.getElementById("shippingModal");
  modal.style.display = "none";
  modal.classList.remove("show");
  currentShippingId = null;
}

async function saveShippingMethod() {
  const form = document.getElementById("shippingForm");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = {
    code: document.getElementById("shippingCode").value.trim(),
    name: document.getElementById("shippingName").value.trim(),
    description: document.getElementById("shippingDescription").value.trim(),
    base_cost: parseFloat(document.getElementById("shippingBaseCost").value) || 0,
    cost_per_km: document.getElementById("shippingCostPerKm").value
      ? parseFloat(document.getElementById("shippingCostPerKm").value)
      : undefined,
    cost_per_kg: document.getElementById("shippingCostPerKg").value
      ? parseFloat(document.getElementById("shippingCostPerKg").value)
      : undefined,
    estimated_delivery_time: document.getElementById("shippingDeliveryTime").value
      ? parseInt(document.getElementById("shippingDeliveryTime").value)
      : undefined,
    min_weight: document.getElementById("shippingMinWeight").value
      ? parseFloat(document.getElementById("shippingMinWeight").value)
      : undefined,
    max_weight: document.getElementById("shippingMaxWeight").value
      ? parseFloat(document.getElementById("shippingMaxWeight").value)
      : undefined,
    max_distance: document.getElementById("shippingMaxDistance").value
      ? parseFloat(document.getElementById("shippingMaxDistance").value)
      : undefined,
    is_active: document.getElementById("shippingIsActive").value === "true",
  };

  // Remove undefined fields
  Object.keys(data).forEach((key) => {
    if (data[key] === undefined) delete data[key];
  });

  try {
    let response;
    if (currentShippingId) {
      // Update
      response = await apiCall(`/shipping/methods/${currentShippingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    } else {
      // Create
      response = await apiCall("/shipping/methods", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    }

    if (!response) {
      // apiCall đã xử lý lỗi (401, không có token, etc.) và có thể đã logout
      // Không cần hiển thị thông báo lỗi nữa vì đã được xử lý trong apiCall
      return;
    }

    if (response.ok) {
      showAlert(
        currentShippingId
          ? "Cập nhật phương thức vận chuyển thành công"
          : "Thêm phương thức vận chuyển thành công",
        "success"
      );
      closeShippingModal();
      loadShippingMethods();
    } else {
      // Xử lý lỗi từ server (400, 500, etc.)
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: `Lỗi ${response.status}: ${response.statusText}` };
      }
      showAlert(
        `Lỗi: ${errorData.message || "Lỗi không xác định"}`,
        "error"
      );
    }
  } catch (error) {
    showAlert(`Đã xảy ra lỗi: ${error.message}`, "error");
  }
}

async function deleteShippingMethod(id, name) {
  if (!confirm(`Bạn có chắc chắn muốn xóa phương thức vận chuyển "${name}"?`)) {
    return;
  }

  try {
    const response = await apiCall(`/shipping/methods/${id}`, {
      method: "DELETE",
    });

    if (response && response.ok) {
      showAlert("Xóa phương thức vận chuyển thành công", "success");
      loadShippingMethods();
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      showAlert(`Lỗi: ${errorData.message || "Lỗi không xác định"}`, "error");
    }
  } catch (error) {
    showAlert(`Đã xảy ra lỗi: ${error.message}`, "error");
  }
}

// Close modal when clicking outside
document.addEventListener("click", function (e) {
  const modal = document.getElementById("shippingModal");
  if (e.target === modal) {
    closeShippingModal();
  }
});

