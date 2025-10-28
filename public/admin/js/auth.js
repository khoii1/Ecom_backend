// Admin Authentication System

const API_BASE_URL = "http://localhost:8080";

// Kiểm tra xem có đang ở trang login không
const isLoginPage = window.location.pathname.includes("login.html");

// Kiểm tra authentication khi load trang
document.addEventListener("DOMContentLoaded", function () {
  if (isLoginPage) {
    // Nếu đã đăng nhập, chuyển về dashboard
    if (isAuthenticated() && getUser().role === "ADMIN") {
      window.location.href = "index.html";
    }
  } else {
    // Nếu chưa đăng nhập hoặc không phải admin, chuyển về login
    if (!isAuthenticated() || getUser().role !== "ADMIN") {
      window.location.href = "login.html";
    } else {
      // Hiển thị tên admin
      displayAdminInfo();
    }
  }
});

// Kiểm tra có token và role ADMIN không
function isAuthenticated() {
  const token = localStorage.getItem("access_token");
  const user = localStorage.getItem("user");

  if (!token || !user) {
    return false;
  }

  try {
    const userData = JSON.parse(user);
    return userData.role === "ADMIN";
  } catch (error) {
    return false;
  }
}

// Lấy thông tin user
function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch (error) {
    return null;
  }
}

// Hiển thị thông tin admin
function displayAdminInfo() {
  const user = getUser();
  if (user) {
    const adminNameElements = document.querySelectorAll("#adminName");
    adminNameElements.forEach((element) => {
      element.innerHTML = `<i class="fas fa-user"></i> ${user.full_name}`;
    });
  }
}

// Xử lý form login
if (isLoginPage) {
  document
    .getElementById("loginForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      const loginBtn = document.getElementById("loginBtn");

      // Disable button và thay đổi text
      loginBtn.disabled = true;
      loginBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang đăng nhập...';

      try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
          // Kiểm tra xem có phải ADMIN không
          if (data.user.role === "ADMIN") {
            // Lưu token và thông tin user
            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("user", JSON.stringify(data.user));

            showAlert("Đăng nhập thành công!", "success");

            // Chuyển hướng sau 1 giây
            setTimeout(() => {
              window.location.href = "index.html";
            }, 1000);
          } else {
            showAlert("Chỉ có quản trị viên mới được phép truy cập!", "error");
          }
        } else {
          showAlert(data.message || "Đăng nhập thất bại", "error");
        }
      } catch (error) {
        showAlert("Lỗi kết nối đến server", "error");
      } finally {
        // Enable button
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Đăng nhập';
      }
    });
}

// Đăng xuất
function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// Hàm gọi API với authentication
async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem("access_token");

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // Nếu unauthorized, logout
    if (response.status === 401) {
      logout();
      return null;
    }

    return response;
  } catch (error) {
    console.error("API call error:", error);
    throw error;
  }
}

// Hiển thị alert
function showAlert(message, type = "info") {
  const alertContainer = document.getElementById("alert-container");
  if (!alertContainer) return;

  const alertClass =
    type === "success"
      ? "alert-success"
      : type === "error"
      ? "alert-error"
      : type === "warning"
      ? "alert-warning"
      : "alert-info";

  const alertHTML = `
        <div class="alert ${alertClass}" style="margin-bottom: 1rem;">
            ${message}
        </div>
    `;

  alertContainer.innerHTML = alertHTML;

  // Tự động ẩn sau 5 giây
  setTimeout(() => {
    alertContainer.innerHTML = "";
  }, 5000);
}

// Format số tiền
function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

// Format ngày tháng
function formatDate(dateString) {
  return new Date(dateString).toLocaleString("vi-VN");
}

// Truncate text
function truncateText(text, maxLength = 50) {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}
