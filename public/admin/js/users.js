// Users management functionality

let users = []; // Biến lưu trữ danh sách người dùng được tải từ API
let isEditMode = false; // Biến cờ để xác định đang Thêm mới hay Sửa

document.addEventListener("DOMContentLoaded", function () {
  loadUsers(); // Tải danh sách người dùng khi trang được load
  setupUserForm(); // Thiết lập trình xử lý sự kiện cho form
});

/**
 * Tải danh sách người dùng từ API và hiển thị lên bảng.
 */
async function loadUsers() {
  try {
    showLoading(true); // Hiển thị spinner loading

    // Gọi API GET /users (Backend đã có sẵn API này cho Admin)
    const response = await apiCall("/users");

    if (response && response.ok) {
      users = await response.json(); // Lưu danh sách user vào biến global
      displayUsers(); // Gọi hàm để hiển thị dữ liệu lên bảng
    } else {
      // Xử lý lỗi nếu API trả về lỗi
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      console.error("Error fetching users:", errorData);
      showAlert(
        `Lỗi khi tải danh sách người dùng: ${errorData.message}`,
        "error"
      );
      // Hiển thị thông báo lỗi trên bảng
      document.getElementById("usersTableBody").innerHTML = `
        <tr><td colspan="6" style="text-align: center; color: red;">Lỗi khi tải dữ liệu: ${errorData.message}</td></tr>`;
    }
  } catch (error) {
    // Xử lý lỗi kết nối mạng
    console.error("Error loading users:", error);
    showAlert("Lỗi kết nối khi tải người dùng", "error");
    document.getElementById("usersTableBody").innerHTML = `
        <tr><td colspan="6" style="text-align: center; color: red;">Lỗi kết nối mạng: ${error.message}</td></tr>`;
  } finally {
    showLoading(false); // Ẩn spinner loading sau khi hoàn tất
  }
}

/**
 * Hiển thị danh sách người dùng lên bảng HTML.
 */
function displayUsers() {
  const tbody = document.getElementById("usersTableBody");

  // Xử lý trường hợp không có người dùng nào
  if (users.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    <i class="fas fa-users" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                    Không có người dùng nào
                </td>
            </tr>
        `;
    return;
  }

  // Tạo HTML cho mỗi hàng trong bảng
  tbody.innerHTML = users
    .map(
      (user) => `
        <tr>
            <td>${user.full_name || "N/A"}</td>
            <td>${user.email || "N/A"}</td>
            <td>
                <span class="btn btn-sm ${getRoleClass(user.role)}">
                    ${getRoleText(user.role)}
                </span>
            </td>
            <td>
                <span class="btn btn-sm ${getStatusClass(user.status)}">
                    ${getStatusText(user.status)}
                </span>
            </td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <button class="btn btn-warning btn-sm" onclick="openEditUserModal('${
                  user.id
                }')" style="margin-right: 0.5rem;" title="Sửa người dùng">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteUser('${
                  user.id
                }', '${user.email}')" title="Xóa người dùng">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join(""); // Nối các hàng lại thành một chuỗi HTML
}

// --- Các hàm helper để hiển thị Vai trò và Trạng thái ---
function getRoleClass(role) {
  switch (role) {
    case "ADMIN":
      return "btn-danger";
    case "SELLER":
      return "btn-warning";
    case "USER":
      return "btn-primary";
    default:
      return "btn-secondary";
  }
}

function getRoleText(role) {
  switch (role) {
    case "ADMIN":
      return "Quản trị";
    case "SELLER":
      return "Người bán";
    case "USER":
      return "Người dùng";
    default:
      return role || "N/A";
  }
}

function getStatusClass(status) {
  switch (status) {
    case "active":
      return "btn-success";
    case "pending":
      return "btn-warning";
    case "inactive":
      return "btn-secondary";
    default:
      return "btn-secondary";
  }
}

function getStatusText(status) {
  switch (status) {
    case "active":
      return "Hoạt động";
    case "pending":
      return "Chờ xác minh";
    case "inactive":
      return "Không hoạt động";
    default:
      return status || "N/A";
  }
}
// --- Kết thúc hàm helper ---

/**
 * Hiển thị hoặc ẩn spinner loading và bảng.
 * @param {boolean} show True để hiển thị loading, False để ẩn.
 */
function showLoading(show) {
  const loading = document.getElementById("usersLoading");
  const table = document.getElementById("usersTable");

  if (show) {
    loading.style.display = "block";
    table.style.display = "none";
  } else {
    loading.style.display = "none";
    table.style.display = "table";
  }
}

// --- Các hàm quản lý Modal ---

/**
 * Mở modal ở chế độ "Thêm mới".
 */
function openAddUserModal() {
  isEditMode = false; // Đặt chế độ là Thêm mới
  document.getElementById("userModalTitle").textContent = "Thêm người dùng"; // Đặt tiêu đề modal
  document.getElementById("userForm").reset(); // Xóa sạch các trường form
  document.getElementById("userId").value = ""; // Đảm bảo ID user trống
  document.getElementById("passwordGroup").style.display = "block"; // Hiển thị ô mật khẩu
  document.getElementById("password").required = true; // Bắt buộc nhập mật khẩu khi thêm mới
  document.getElementById("userModal").classList.add("show"); // Hiển thị modal
}

/**
 * Mở modal ở chế độ "Sửa" với thông tin của user được chọn.
 * @param {string} userIdString ID của người dùng cần sửa (dưới dạng chuỗi từ HTML).
 */
async function openEditUserModal(userIdString) {
  // SỬA: Chuyển đổi userId dạng chuỗi từ nút bấm thành dạng số
  const userIdNumber = parseInt(userIdString, 10);
  if (isNaN(userIdNumber)) {
    showAlert("ID người dùng không hợp lệ.", "error");
    return;
  }

  // Tìm user trong mảng users (so sánh số với số)
  const user = users.find((u) => u.id === userIdNumber);
  if (!user) {
    showAlert(
      "Không tìm thấy thông tin người dùng trong danh sách đã tải.",
      "error"
    );
    console.error(
      `User not found locally for ID string: "${userIdString}" (parsed as number: ${userIdNumber})`
    );
    console.log("Current users array:", users); // Log mảng users để kiểm tra cấu trúc ID
    return;
  }

  isEditMode = true; // Đặt chế độ là Sửa
  document.getElementById("userModalTitle").textContent =
    "Sửa thông tin người dùng"; // Đặt tiêu đề
  document.getElementById("userForm").reset(); // Reset form trước khi điền

  // Điền thông tin vào form
  document.getElementById("userId").value = user.id; // Lưu ID gốc (dạng số) vào input hidden
  document.getElementById("fullName").value = user.full_name || "";
  document.getElementById("email").value = user.email || "";
  document.getElementById("role").value = user.role || "USER";
  document.getElementById("status").value = user.status || "inactive";

  // Ẩn trường mật khẩu và không bắt buộc khi sửa
  document.getElementById("passwordGroup").style.display = "none";
  document.getElementById("password").required = false;
  document.getElementById("password").value = ""; // Xóa giá trị cũ nếu có

  document.getElementById("userModal").classList.add("show"); // Hiển thị modal

  // (Phần nâng cao để lấy dữ liệu mới nhất nếu cần - giữ nguyên như cũ)
  // try { ... } catch { ... }
}

/**
 * Đóng modal và reset form.
 */
function closeUserModal() {
  document.getElementById("userModal").classList.remove("show"); // Ẩn modal
  document.getElementById("userForm").reset(); // Reset form
  isEditMode = false; // Reset chế độ
  document.getElementById("userId").value = ""; // Xóa ID user
}

// --- Thiết lập xử lý sự kiện submit cho form ---
function setupUserForm() {
  document
    .getElementById("userForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault(); // Ngăn chặn hành vi submit mặc định của form

      // Lấy nút submit để disable/enable
      const submitButton = this.querySelector('button[type="submit"]');
      submitButton.disabled = true; // Disable nút khi đang xử lý
      submitButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

      // Lấy dữ liệu từ form
      const formData = new FormData(this);
      const userData = {
        full_name: formData.get("fullName"), // Đảm bảo key là 'full_name'
        email: formData.get("email"),
        role: formData.get("role"),
        status: formData.get("status"),
      };

      // Chỉ thêm mật khẩu vào payload nếu là mode Thêm mới
      if (!isEditMode) {
        userData.password = formData.get("password");
        // Kiểm tra mật khẩu có đủ dài không
        if (!userData.password || userData.password.length < 6) {
          showAlert("Mật khẩu phải có ít nhất 6 ký tự.", "error");
          submitButton.disabled = false;
          submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
          return; // Dừng lại
        }
      }

      try {
        let response;
        const userId = document.getElementById("userId").value; // Lấy ID (dạng chuỗi) từ input hidden

        if (isEditMode && userId) {
          // --- Chế độ Sửa ---
          // Gọi API PUT /users/:userId
          response = await apiCall(`/users/${userId}`, {
            method: "PUT",
            body: JSON.stringify(userData), // Chỉ gửi các trường cần cập nhật
          });
        } else {
          // --- Chế độ Thêm mới ---
          // Gọi API POST /users
          response = await apiCall("/users", {
            method: "POST",
            body: JSON.stringify(userData), // Gửi đầy đủ thông tin (bao gồm password)
          });
        }

        // Xử lý kết quả trả về từ API
        if (response && response.ok) {
          showAlert(
            isEditMode
              ? "Cập nhật người dùng thành công!"
              : "Thêm người dùng thành công!",
            "success"
          );
          closeUserModal(); // Đóng modal sau khi thành công
          loadUsers(); // Tải lại danh sách user để cập nhật bảng
        } else {
          // Hiển thị lỗi từ API
          const errorData = response
            ? await response.json()
            : { message: "Lỗi không xác định" };
          console.error("API Error:", errorData);
          showAlert(errorData.message || "Có lỗi xảy ra từ máy chủ", "error");
        }
      } catch (error) {
        // Hiển thị lỗi kết nối mạng
        console.error("Error saving user:", error);
        showAlert(
          `Lỗi khi lưu thông tin người dùng: ${error.message}`,
          "error"
        );
      } finally {
        // Luôn enable lại nút submit sau khi xử lý xong
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
      }
    });
}

/**
 * Xóa người dùng sau khi xác nhận.
 * @param {string} userId ID của người dùng cần xóa.
 * @param {string} userEmail Email của người dùng (để hiển thị trong confirm).
 */
async function deleteUser(userId, userEmail) {
  // Hiển thị hộp thoại xác nhận
  if (
    !confirm(
      `Bạn có chắc chắn muốn xóa người dùng "${userEmail}" không? Hành động này không thể hoàn tác.`
    )
  ) {
    return; // Không làm gì nếu người dùng hủy
  }

  try {
    // Gọi API DELETE /users/:userId
    const response = await apiCall(`/users/${userId}`, {
      method: "DELETE",
    });

    if (response && response.ok) {
      showAlert("Xóa người dùng thành công!", "success");
      loadUsers(); // Tải lại danh sách user để cập nhật bảng
    } else {
      // Hiển thị lỗi từ API
      const errorData = response
        ? await response.json()
        : { message: "Lỗi không xác định" };
      console.error("API Error deleting user:", errorData);
      showAlert(errorData.message || "Có lỗi xảy ra khi xóa", "error");
    }
  } catch (error) {
    // Hiển thị lỗi kết nối mạng
    console.error("Error deleting user:", error);
    showAlert(`Lỗi khi xóa người dùng: ${error.message}`, "error");
  }
}
