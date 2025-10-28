// Products management functionality

let products = [];
let categories = [];
let stores = [];
let isEditMode = false;

// Helper function to format percentage
function formatPercentage(value) {
  if (value === null || value === undefined || value === "") return "-";
  // Remove unnecessary decimal places
  const num = parseFloat(value);
  return num % 1 === 0 ? num + "%" : num.toFixed(2).replace(/\.?0+$/, "") + "%";
}

// Helper function to format price (assuming you have this in common.js, if not, add it)
function formatPrice(price) {
  if (price === null || price === undefined) return "-";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

// Helper function to truncate text (assuming you have this in common.js, if not, add it)
function truncateText(text, maxLength) {
  if (!text) return '<em style="color: #6c757d;">N/A</em>';
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength) + "...";
}

document.addEventListener("DOMContentLoaded", function () {
  loadProducts();
  loadCategories();
  loadStores();
  setupProductForm();
  setupProductImageUpload(); // Ensure image upload setup is called
});

async function loadProducts() {
  try {
    showLoading(true);

    // Assuming API /products returns image_url and calculates final_price
    const response = await apiCall("/products");
    if (response && response.ok) {
      products = await response.json();
      displayProducts();
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      console.error("Error fetching products:", errorData);
      showAlert(
        `Lỗi khi tải danh sách sản phẩm: ${errorData.message}`,
        "error"
      );
      document.getElementById("productsTableBody").innerHTML = `
        <tr><td colspan="10" style="text-align: center; color: red;">Lỗi khi tải dữ liệu: ${errorData.message}</td></tr>`; // Updated colspan
    }
  } catch (error) {
    console.error("Error loading products:", error);
    showAlert("Lỗi kết nối khi tải sản phẩm", "error");
    document.getElementById("productsTableBody").innerHTML = `
        <tr><td colspan="10" style="text-align: center; color: red;">Lỗi kết nối mạng: ${error.message}</td></tr>`; // Updated colspan
  } finally {
    showLoading(false);
  }
}

async function loadCategories() {
  try {
    const response = await apiCall("/categories");
    if (response && response.ok) {
      categories = await response.json();
      populateCategoryOptions();
    } else {
      console.error("Failed to load categories");
    }
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

async function loadStores() {
  try {
    // Use the admin endpoint for stores if available and needed, otherwise use the public one
    const response = await apiCall("/stores"); // Or use "/stores/admin/list" if needed
    if (response && response.ok) {
      stores = await response.json();
      populateStoreOptions();
    } else {
      console.error("Failed to load stores");
    }
  } catch (error) {
    console.error("Error loading stores:", error);
  }
}

function populateCategoryOptions() {
  const select = document.getElementById("productCategory");
  select.innerHTML = '<option value="">-- Chọn danh mục --</option>'; // Default empty option

  categories.forEach((category) => {
    // Assuming category object has 'id' and 'name' properties
    select.innerHTML += `<option value="${category.id}">${category.name}</option>`;
  });
}

function populateStoreOptions() {
  const select = document.getElementById("productStore");
  select.innerHTML = '<option value="">-- Chọn cửa hàng --</option>'; // Default empty option

  stores.forEach((store) => {
    // Assuming store object has 'id' and 'name' properties
    select.innerHTML += `<option value="${store.id}">${store.name}</option>`;
  });
}

function displayProducts() {
  const tbody = document.getElementById("productsTableBody");

  // --- THÊM: Lấy danh sách tên cửa hàng và danh mục để tra cứu ---
  // Tạo Map để tra cứu tên nhanh hơn
  const categoryMap = new Map(categories.map((cat) => [cat.id, cat.name]));
  const storeMap = new Map(stores.map((store) => [store.id, store.name]));
  // --- KẾT THÚC THÊM ---

  if (!products || products.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                    Không có sản phẩm nào
                </td>
            </tr>
        `;
    return;
  }

  tbody.innerHTML = products
    .map((product) => {
      // --- SỬA: Lấy tên từ Map, hiển thị 'N/A' nếu không tìm thấy ---
      const storeName =
        storeMap.get(product.store_id) ||
        '<em style="color: #6c757d;">N/A</em>';
      const categoryName =
        categoryMap.get(product.category_id) ||
        '<em style="color: #6c757d;">N/A</em>';
      // --- KẾT THÚC SỬA ---

      const finalPrice =
        product.final_price ??
        calculateFinalPrice(product.price, product.discount_percentage);

      return `
        <tr>
            <td>
                <img src="${product.image_url || "img/placeholder.png"}"
                     alt="Ảnh ${product.title || "sản phẩm"}"
                     style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #dee2e6;"
                     onerror="this.onerror=null;this.src='img/placeholder.png';"
                     >
            </td>
            <td>${product.title || "N/A"}</td>
            <td title="${product.description || ""}">${truncateText(
        product.description,
        50
      )}</td>
            <td>${storeName}</td>
            <td>${categoryName}</td>
            <td>${formatPrice(product.price)}</td>
            <td>${formatPercentage(product.discount_percentage)}</td>
            <td>${formatPrice(finalPrice)}</td>
            <td>
                <span class="btn btn-sm ${getProductStatusClass(
                  product.status
                )}">
                    ${getProductStatusText(product.status)}
                </span>
            </td>
            <td>
                <button class="btn btn-warning btn-sm" onclick="openEditProductModal('${
                  product.id
                }')" style="margin-right: 0.5rem;" title="Sửa sản phẩm">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct('${
                  product.id
                }', '${product.title}')" title="Xóa sản phẩm">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
      `;
    })
    .join("");
}

// Hàm helper để tính giá cuối (nếu API chưa trả về)
function calculateFinalPrice(price, discountPercentage) {
  if (!price) return 0;
  const p = parseFloat(price);
  const d = parseFloat(discountPercentage);
  if (isNaN(p) || isNaN(d) || d <= 0 || d > 100) {
    return p;
  }
  return p - (p * d) / 100;
}

function getCategoryName(categoryId) {
  // Chuyển categoryId thành chuỗi để so sánh nhất quán (vì API trả về chuỗi)
  const idStr = categoryId ? String(categoryId) : null;
  const category = categories.find((c) => c.id === idStr);
  return category ? category.name : '<em style="color: #6c757d;">N/A</em>';
}

function getStoreName(storeId) {
  // Chuyển storeId thành chuỗi để so sánh nhất quán
  const idStr = storeId ? String(storeId) : null;
  const store = stores.find((s) => s.id === idStr);
  return store ? store.name : '<em style="color: #6c757d;">N/A</em>';
}

// --- Thêm hàm helper cho Trạng thái sản phẩm (tương tự User Status) ---
function getProductStatusClass(status) {
  switch (status) {
    case "active":
      return "btn-success";
    case "inactive":
      return "btn-secondary";
    default:
      return "btn-secondary";
  }
}

function getProductStatusText(status) {
  switch (status) {
    case "active":
      return "Hoạt động";
    case "inactive":
      return "Không hoạt động";
    default:
      return status || "N/A";
  }
}
// --- Kết thúc helper trạng thái sản phẩm ---

// XÓA: Hàm generateStars không còn dùng nữa
// function generateStars(rating) { ... }

function showLoading(show) {
  const loading = document.getElementById("productsLoading");
  const table = document.getElementById("productsTable");

  if (show) {
    loading.style.display = "block";
    table.style.display = "none";
  } else {
    loading.style.display = "none";
    table.style.display = "table";
  }
}

// --- Modal functions ---
function openAddProductModal() {
  isEditMode = false;
  document.getElementById("productModalTitle").textContent = "Thêm sản phẩm";
  document.getElementById("productForm").reset(); // Reset form
  document.getElementById("productId").value = ""; // Clear product ID

  // Reset image upload preview
  removeProductImage(false); // Gọi hàm remove nhưng không xóa URL/file

  // Đặt giá trị mặc định nếu cần (ví dụ: status là active)
  document.getElementById("productStatus").value = "active";

  document.getElementById("productModal").classList.add("show");
}

// SỬA: Đổi tên editProduct thành openEditProductModal
async function openEditProductModal(productIdString) {
  // SỬA: Chuyển ID chuỗi thành số để tìm kiếm nếu cần (tùy thuộc API trả về kiểu gì)
  // Backend service trả về ID dạng chuỗi, nên giữ nguyên là chuỗi
  const productId = productIdString;
  const product = products.find((p) => p.id === productId);

  if (!product) {
    showAlert("Không tìm thấy thông tin sản phẩm.", "error");
    console.error(`Product not found locally for ID: "${productId}"`);
    return;
  }

  isEditMode = true;
  document.getElementById("productModalTitle").textContent = "Sửa sản phẩm";
  document.getElementById("productForm").reset(); // Reset trước khi điền

  // Điền thông tin vào form
  document.getElementById("productId").value = product.id;
  document.getElementById("productTitle").value = product.title || "";
  document.getElementById("productDescription").value =
    product.description || "";
  document.getElementById("productPrice").value = product.price || 0;
  document.getElementById("productDiscountPercentage").value =
    product.discount_percentage || "";
  // XÓA: Không điền dữ liệu cho productRating nữa
  // document.getElementById("productRating").value = product.rating || "";
  document.getElementById("productCategory").value = product.category_id || ""; // ID dạng chuỗi
  document.getElementById("productStore").value = product.store_id || ""; // ID dạng chuỗi
  document.getElementById("productStatus").value = product.status || "inactive"; // Thêm dòng này

  // Set product image preview
  const preview = document.getElementById("productImagePreview");
  const removeBtn = document.getElementById("removeProductImageBtn");
  const hiddenUrlInput = document.getElementById("productImageUrl");

  if (product.image_url) {
    preview.innerHTML = `<img src="${product.image_url}" alt="Product Image">`;
    removeBtn.style.display = "inline-block";
    hiddenUrlInput.value = product.image_url;
  } else {
    preview.innerHTML = `<i class="fas fa-image"></i><span>Chọn ảnh</span>`;
    removeBtn.style.display = "none";
    hiddenUrlInput.value = "";
  }
  // XÓA: Không còn input productIsActive
  // document.getElementById("productIsActive").checked = product.is_active;

  document.getElementById("productModal").classList.add("show");

  // (Nâng cao) Gọi API để lấy thông tin mới nhất (tùy chọn)
}

function closeProductModal() {
  document.getElementById("productModal").classList.remove("show");
  document.getElementById("productForm").reset();
  isEditMode = false;
  document.getElementById("productId").value = "";
  // Reset image upload preview khi đóng
  removeProductImage(false);
}

// --- Setup form submission ---
function setupProductForm() {
  document
    .getElementById("productForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const submitButton = this.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

      // Lấy dữ liệu từ form
      const formData = new FormData(this);
      const productData = {
        title: formData.get("title"),
        description: formData.get("description") || null,
        price: parseFloat(formData.get("price")),
        discount_percentage: formData.get("discount_percentage")
          ? parseFloat(formData.get("discount_percentage"))
          : null,
        // XÓA: Không lấy dữ liệu rating nữa
        // rating: formData.get("rating") ? parseFloat(formData.get("rating")) : null,
        category_id: formData.get("category_id") || null, // Lấy đúng name="category_id"
        store_id: formData.get("store_id"), // Lấy đúng name="store_id"
        image_url: formData.get("image_url") || null, // Lấy URL từ input hidden
        status: formData.get("status"), // Lấy đúng name="status"
      };

      // --- Validation cơ bản ---
      if (!productData.title || productData.title.length < 2) {
        showAlert("Tên sản phẩm phải có ít nhất 2 ký tự.", "error");
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
        return;
      }
      if (!productData.store_id) {
        showAlert("Vui lòng chọn cửa hàng.", "error");
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
        return;
      }
      if (isNaN(productData.price) || productData.price < 0) {
        showAlert("Giá gốc không hợp lệ.", "error");
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
        return;
      }
      if (
        productData.discount_percentage !== null &&
        (isNaN(productData.discount_percentage) ||
          productData.discount_percentage < 0 ||
          productData.discount_percentage > 100)
      ) {
        showAlert("Phần trăm giảm giá phải từ 0 đến 100.", "error");
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
        return;
      }
      // --- Kết thúc Validation ---

      // --- Xử lý Upload Ảnh (Nếu có file mới được chọn) ---
      const imageFile = document.getElementById("productImageFile").files[0];
      let uploadedImageUrl = productData.image_url; // Giữ URL cũ nếu không có file mới

      if (imageFile) {
        // Hiện loading trên nút submit
        submitButton.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Đang tải ảnh lên...';
        try {
          const uploadFormData = new FormData();
          uploadFormData.append("image", imageFile); // 'image' phải khớp với backend

          // Gọi API upload ảnh của backend
          const uploadResponse = await apiCall("/products/upload-image", {
            method: "POST",
            body: uploadFormData, // Không set Content-Type, trình duyệt sẽ tự làm
            isFormData: true, // Thêm cờ để apiCall không set Content-Type JSON
          });

          if (uploadResponse && uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            uploadedImageUrl = uploadResult.image_url; // Lấy URL từ kết quả upload
            productData.image_url = uploadedImageUrl; // Cập nhật productData để gửi đi
            submitButton.innerHTML =
              '<i class="fas fa-spinner fa-spin"></i> Đang lưu...'; // Quay lại trạng thái lưu
          } else {
            const errorData = uploadResponse
              ? await uploadResponse.json()
              : { message: "Lỗi mạng khi upload" };
            console.error("Image Upload Error:", errorData);
            showAlert(`Lỗi khi tải ảnh lên: ${errorData.message}`, "error");
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
            return; // Dừng lại nếu upload lỗi
          }
        } catch (uploadError) {
          console.error("Error uploading image:", uploadError);
          showAlert(
            `Lỗi kết nối khi tải ảnh lên: ${uploadError.message}`,
            "error"
          );
          submitButton.disabled = false;
          submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
          return; // Dừng lại
        }
      }
      // --- Kết thúc Xử lý Upload Ảnh ---

      // --- Gọi API Lưu Sản phẩm (Thêm mới hoặc Cập nhật) ---
      try {
        let response;
        const productId = document.getElementById("productId").value;

        if (isEditMode && productId) {
          // Gọi API PUT /products/:productId
          response = await apiCall(`/products/${productId}`, {
            method: "PUT",
            body: JSON.stringify(productData), // Gửi dữ liệu đã cập nhật (bao gồm URL ảnh mới nếu có)
          });
        } else {
          // Gọi API POST /products
          response = await apiCall("/products", {
            method: "POST",
            body: JSON.stringify(productData), // Gửi dữ liệu mới (bao gồm URL ảnh nếu có)
          });
        }

        if (response && response.ok) {
          showAlert(
            isEditMode
              ? "Cập nhật sản phẩm thành công!"
              : "Thêm sản phẩm thành công!",
            "success"
          );
          closeProductModal();
          loadProducts(); // Tải lại bảng
        } else {
          const errorData = response
            ? await response.json()
            : { message: "Lỗi không xác định" };
          console.error("API Error saving product:", errorData);
          showAlert(`Lỗi khi lưu sản phẩm: ${errorData.message}`, "error");
        }
      } catch (error) {
        console.error("Error saving product:", error);
        showAlert(`Lỗi kết nối khi lưu sản phẩm: ${error.message}`, "error");
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
      }
      // --- Kết thúc Gọi API Lưu Sản phẩm ---
    });
}

async function deleteProduct(productId, productName) {
  if (
    !confirm(
      `Bạn có chắc chắn muốn xóa sản phẩm "${productName || "này"}" không?`
    )
  ) {
    return;
  }

  try {
    // Gọi API DELETE /products/:productId
    const response = await apiCall(`/products/${productId}`, {
      method: "DELETE",
    });

    if (response && response.ok) {
      showAlert("Xóa sản phẩm thành công!", "success");
      loadProducts(); // Tải lại bảng
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Lỗi không xác định" };
      console.error("API Error deleting product:", errorData);
      showAlert(`Lỗi khi xóa sản phẩm: ${errorData.message}`, "error");
    }
  } catch (error) {
    console.error("Error deleting product:", error);
    showAlert(`Lỗi khi xóa sản phẩm: ${error.message}`, "error");
  }
}

// --- Product Image Upload Functions ---
function selectProductImage() {
  document.getElementById("productImageFile").click();
}

/**
 * Xóa ảnh khỏi preview và input hidden.
 * @param {boolean} clearFileInput - Có xóa file đã chọn trong input type="file" hay không.
 */
function removeProductImage(clearFileInput = true) {
  const preview = document.getElementById("productImagePreview");
  const hiddenInput = document.getElementById("productImageUrl");
  const removeBtn = document.getElementById("removeProductImageBtn");

  // Reset preview về trạng thái mặc định
  preview.innerHTML = `
    <i class="fas fa-image"></i>
    <span>Chọn ảnh</span>
  `;

  // Xóa giá trị URL đã lưu
  hiddenInput.value = "";

  // Xóa file đã chọn nếu cần (thường là khi nhấn nút "Xóa")
  if (clearFileInput) {
    document.getElementById("productImageFile").value = "";
  }

  // Ẩn nút "Xóa"
  removeBtn.style.display = "none";

  // Cập nhật productData nếu đang trong quá trình submit form (đảm bảo image_url là null)
  if (document.getElementById("productForm").classList.contains("submitting")) {
    // Cần thêm class 'submitting' vào form khi submit
    const productData = getCurrentProductData(); // Cần hàm này để lấy data hiện tại
    productData.image_url = null;
  }
}

function setupProductImageUpload() {
  const fileInput = document.getElementById("productImageFile");
  const preview = document.getElementById("productImagePreview");
  const hiddenUrlInput = document.getElementById("productImageUrl");
  const removeBtn = document.getElementById("removeProductImageBtn");

  // Xử lý khi chọn file mới
  fileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) {
      // Nếu người dùng hủy chọn file, không làm gì cả hoặc reset nếu muốn
      // removeProductImage(false); // Bỏ comment nếu muốn reset khi hủy
      return;
    }

    // Validate loại file
    if (!file.type.startsWith("image/")) {
      showAlert("Vui lòng chọn file ảnh hợp lệ (JPG, PNG, GIF, WebP)", "error");
      fileInput.value = ""; // Xóa file không hợp lệ
      removeProductImage(false); // Reset preview
      return;
    }

    // Validate kích thước file (ví dụ: 10MB) - Nên khớp với backend
    const maxSizeInBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeInBytes) {
      showAlert(
        `Kích thước file không được vượt quá ${
          maxSizeInBytes / (1024 * 1024)
        }MB`,
        "error"
      );
      fileInput.value = ""; // Xóa file quá lớn
      removeProductImage(false); // Reset preview
      return;
    }

    // Hiển thị ảnh preview
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Xem trước ảnh sản phẩm">`;
      removeBtn.style.display = "inline-block"; // Hiện nút Xóa
      hiddenUrlInput.value = ""; // Xóa URL cũ (nếu có) vì sẽ upload file mới
    };
    reader.onerror = function (e) {
      console.error("FileReader error:", e);
      showAlert("Không thể đọc file ảnh đã chọn.", "error");
      removeProductImage(false);
    };
    reader.readAsDataURL(file);
  });

  // Cho phép nhấn vào preview để chọn lại ảnh
  preview.addEventListener("click", selectProductImage);
}
