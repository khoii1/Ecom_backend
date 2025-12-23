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

// Hàm khởi tạo - được gọi khi DOM sẵn sàng
function initializeProductsPage() {
  // Setup event listeners trước
  setupEventListeners();
  setupProductForm();
  setupProductImageUpload();
  
  // Load products ngay lập tức - KHÔNG đợi gì cả
  loadProducts().catch(() => {
    // Silent fail, will retry in fallback
  });
  
  // Load categories và stores song song (không block products)
  Promise.all([
    loadCategories().catch(() => {}),
    loadStores().catch(() => {})
  ]).then(() => {
    // Nếu products đã load nhưng chưa display (vì thiếu categories/stores), display lại
    if (products && products.length > 0) {
      displayProducts();
    }
  });
}

// Thử nhiều cách để đảm bảo code chạy
if (document.readyState === 'loading') {
  // DOM chưa load xong
  document.addEventListener('DOMContentLoaded', function() {
    initializeProductsPage();
  });
} else {
  // DOM đã load xong rồi - gọi ngay nhưng dùng setTimeout để đảm bảo script khác đã load
  setTimeout(function() {
    initializeProductsPage();
  }, 50); // Delay nhỏ để đảm bảo các script khác đã load
}

// Fallback 1: Sau 200ms nếu chưa có dữ liệu
setTimeout(function() {
  const tableBody = document.getElementById("productsTableBody");
  const loading = document.getElementById("productsLoading");
  
  if (!tableBody) {
    return;
  }
  
  const hasContent = tableBody.innerHTML && tableBody.innerHTML.trim() !== '';
  const isLoading = loading && loading.style.display !== 'none';
  
  if ((!products || products.length === 0) && (!hasContent || isLoading)) {
    loadProducts().catch(() => {});
  }
}, 200);

// Fallback 2: Sau 1000ms nếu vẫn chưa có dữ liệu
setTimeout(function() {
  const tableBody = document.getElementById("productsTableBody");
  if (!tableBody) return;
  
  const hasContent = tableBody.innerHTML && tableBody.innerHTML.trim() !== '';
  if (!hasContent && (!products || products.length === 0)) {
    loadProducts().catch(() => {});
  }
}, 1000);

function setupEventListeners() {
  // Add Product button
  const addProductBtn = document.getElementById("addProductBtn");
  if (addProductBtn) {
    addProductBtn.addEventListener("click", openAddProductModal);
  }
  
  // Refresh Products button
  const refreshProductsBtn = document.getElementById("refreshProductsBtn");
  if (refreshProductsBtn) {
    refreshProductsBtn.addEventListener("click", loadProducts);
  }
  
  // Setup filter listeners
  setupFilterListeners();
  
  // Close Modal buttons
  const closeProductModalBtn = document.getElementById("closeProductModalBtn");
  if (closeProductModalBtn) {
    closeProductModalBtn.addEventListener("click", closeProductModal);
  }
  
  const cancelProductBtn = document.getElementById("cancelProductBtn");
  if (cancelProductBtn) {
    cancelProductBtn.addEventListener("click", closeProductModal);
  }
  
  // Image upload buttons
  // selectProductImageBtn event listener đã được setup trong setupProductImageUpload()
  
  const removeProductImageBtn = document.getElementById("removeProductImageBtn");
  if (removeProductImageBtn) {
    removeProductImageBtn.addEventListener("click", removeProductImage);
  }
  
  // Event delegation cho Edit và Delete buttons (vì chúng được tạo động)
  const productsTableBody = document.getElementById("productsTableBody");
  if (productsTableBody) {
    productsTableBody.addEventListener("click", function(e) {
      // Handle Edit button
      if (e.target.closest(".edit-product-btn")) {
        const btn = e.target.closest(".edit-product-btn");
        const productId = btn.getAttribute("data-product-id");
        if (productId) {
          openEditProductModal(productId);
        }
      }
      
      // Handle Delete button
      if (e.target.closest(".delete-product-btn")) {
        const btn = e.target.closest(".delete-product-btn");
        const productId = btn.getAttribute("data-product-id");
        const productTitle = btn.getAttribute("data-product-title");
        if (productId) {
          deleteProduct(productId, productTitle || "sản phẩm");
        }
      }
    });
    
    // Handle image error để tránh CSP violation
    productsTableBody.addEventListener("error", function(e) {
      if (e.target.classList.contains("product-table-image")) {
        e.target.onerror = null; // Prevent infinite loop
        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Crect width='50' height='50' fill='%23ddd'/%3E%3C/svg%3E";
      }
    }, true); // Use capture phase
  }
}

async function loadProducts() {
  try {
    // Kiểm tra apiCall có tồn tại không
    if (typeof apiCall !== 'function') {
      showAlert("Lỗi: Không thể kết nối API. Vui lòng tải lại trang.", "error");
      return;
    }
    
    showLoading(true);

    // Build query params for advanced search
    const params = new URLSearchParams();
    const search = document.getElementById("searchProducts")?.value?.trim();
    const categoryId = document.getElementById("filterCategory")?.value;
    const storeId = document.getElementById("filterStore")?.value;
    const inStock = document.getElementById("filterInStock")?.checked;
    const hasDiscount = document.getElementById("filterHasDiscount")?.checked;
    const sort = document.getElementById("sortProducts")?.value;

    if (search) params.append("search", search);
    if (categoryId) params.append("category_id", categoryId);
    if (storeId) params.append("store_id", storeId);
    if (inStock) params.append("in_stock", "true");
    if (hasDiscount) params.append("has_discount", "true");
    if (sort) params.append("sort", sort);
    params.append("limit", "1000"); // Get all products for admin

    const queryString = params.toString();
    const url = queryString ? `/products?${queryString}` : "/products";
    const response = await apiCall(url);
    
    if (response && response.ok) {
      products = await response.json();
      
      // Đảm bảo categories và stores đã được load trước khi display
      // Nếu chưa có, thử load lại
      if (!categories || categories.length === 0) {
        await loadCategories();
      }
      if (!stores || stores.length === 0) {
        await loadStores();
      }
      
      // Hiển thị products sau khi đã có đầy đủ dữ liệu
      displayProducts();
      
      // Đảm bảo table được hiển thị (double check)
      const table = document.getElementById("productsTable");
      if (table) {
        table.style.display = "table";
      }
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      showAlert(
        `Lỗi khi tải danh sách sản phẩm: ${errorData.message}`,
        "error"
      );
      const tbody = document.getElementById("productsTableBody");
      const table = document.getElementById("productsTable");
      if (tbody) {
        tbody.innerHTML = `
        <tr><td colspan="10" style="text-align: center; color: red;">Lỗi khi tải dữ liệu: ${errorData.message}</td></tr>`;
      }
      if (table) {
        table.style.display = "table";
      }
      showLoading(false);
    }
  } catch (error) {
    showAlert("Lỗi kết nối khi tải sản phẩm", "error");
    const tbody = document.getElementById("productsTableBody");
    const table = document.getElementById("productsTable");
    if (tbody) {
      tbody.innerHTML = `
        <tr><td colspan="10" style="text-align: center; color: red;">Lỗi kết nối mạng: ${error.message}</td></tr>`;
    }
    if (table) {
      table.style.display = "table";
    }
    showLoading(false);
  } finally {
    // Chỉ ẩn loading nếu chưa bị lỗi (vì lỗi đã ẩn loading rồi)
    const loading = document.getElementById("productsLoading");
    if (loading && loading.style.display !== "none") {
      showLoading(false);
    }
  }
}

async function loadCategories() {
  try {
    const response = await apiCall("/categories");
    if (response && response.ok) {
      categories = await response.json();
      populateCategoryOptions();
      return categories;
    } else {
      return [];
    }
  } catch (error) {
    return [];
  }
}

async function loadStores() {
  try {
    // Use the admin endpoint for stores if available and needed, otherwise use the public one
    const response = await apiCall("/stores"); // Or use "/stores/admin/list" if needed
    if (response && response.ok) {
      stores = await response.json();
      populateStoreOptions();
      return stores;
    } else {
      return [];
    }
  } catch (error) {
    return [];
  }
}

function populateCategoryOptions() {
  const select = document.getElementById("productCategory");
  const filterSelect = document.getElementById("filterCategory");
  
  if (select) {
    select.innerHTML = '<option value="">-- Chọn danh mục --</option>';
    categories.forEach((category) => {
      select.innerHTML += `<option value="${category.id}">${category.name}</option>`;
    });
  }
  
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">Tất cả</option>';
    categories.forEach((category) => {
      filterSelect.innerHTML += `<option value="${category.id}">${category.name}</option>`;
    });
  }
}

function populateStoreOptions() {
  const select = document.getElementById("productStore");
  const filterSelect = document.getElementById("filterStore");
  
  if (select) {
    select.innerHTML = '<option value="">-- Chọn cửa hàng --</option>';
    stores.forEach((store) => {
      select.innerHTML += `<option value="${store.id}">${store.name}</option>`;
    });
  }
  
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">Tất cả</option>';
    stores.forEach((store) => {
      filterSelect.innerHTML += `<option value="${store.id}">${store.name}</option>`;
    });
  }
}

function applyFilters() {
  loadProducts();
}

// Add event listeners for filters
function setupFilterListeners() {
  const searchInput = document.getElementById("searchProducts");
  if (searchInput) {
    searchInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        applyFilters();
      }
    });
  }
  
  const filterCategory = document.getElementById("filterCategory");
  if (filterCategory) {
    filterCategory.addEventListener("change", applyFilters);
  }
  
  const filterStore = document.getElementById("filterStore");
  if (filterStore) {
    filterStore.addEventListener("change", applyFilters);
  }
  
  const filterInStock = document.getElementById("filterInStock");
  if (filterInStock) {
    filterInStock.addEventListener("change", applyFilters);
  }
  
  const filterHasDiscount = document.getElementById("filterHasDiscount");
  if (filterHasDiscount) {
    filterHasDiscount.addEventListener("change", applyFilters);
  }
  
  const sortProducts = document.getElementById("sortProducts");
  if (sortProducts) {
    sortProducts.addEventListener("change", applyFilters);
  }
}

function displayProducts() {
  const tbody = document.getElementById("productsTableBody");
  const table = document.getElementById("productsTable");
  
  if (!tbody) {
    return;
  }
  
  if (!table) {
    return;
  }

  // --- THÊM: Lấy danh sách tên cửa hàng và danh mục để tra cứu ---
  // Tạo Map để tra cứu tên nhanh hơn
  const categoryMap = new Map((categories || []).map((cat) => [cat.id, cat.name]));
  const storeMap = new Map((stores || []).map((store) => [store.id, store.name]));
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
    // Đảm bảo table được hiển thị ngay cả khi không có dữ liệu
    table.style.display = "table";
    showLoading(false);
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
                     class="product-table-image"
                     style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #dee2e6;"
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
                <button class="btn btn-warning btn-sm edit-product-btn" 
                        data-product-id="${product.id}"
                        style="margin-right: 0.5rem;" 
                        title="Sửa sản phẩm">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm delete-product-btn" 
                        data-product-id="${product.id}"
                        data-product-title="${(product.title || '').replace(/'/g, "&#39;")}"
                        title="Xóa sản phẩm">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
      `;
    })
    .join("");
  
  // Đảm bảo table được hiển thị sau khi render xong
  if (table) {
    table.style.display = "table";
  }
  showLoading(false);
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
  document.getElementById("productStockQuantity").value = 0;

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
  document.getElementById("productStockQuantity").value = product.stock_quantity || 0;
  // XÓA: Không điền dữ liệu cho productRating nữa
  // document.getElementById("productRating").value = product.rating || "";
  document.getElementById("productCategory").value = product.category_id || ""; // ID dạng chuỗi
  document.getElementById("productStore").value = product.store_id || ""; // ID dạng chuỗi
  document.getElementById("productStatus").value = product.status || "inactive"; // Thêm dòng này

  // Set product images preview (hỗ trợ nhiều ảnh)
  selectedImageFiles = []; // Reset files mới
  if (product.image_urls && product.image_urls.length > 0) {
    existingImageUrls = product.image_urls;
  } else if (product.image_url) {
    existingImageUrls = [product.image_url];
  } else {
    existingImageUrls = [];
  }
  updateImagePreview();
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
  selectedImageFiles = [];
  existingImageUrls = [];
  updateImagePreview();
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
        stock_quantity: parseInt(formData.get("stock_quantity")) || 0,
        // XÓA: Không lấy dữ liệu rating nữa
        // rating: formData.get("rating") ? parseFloat(formData.get("rating")) : null,
        category_id: formData.get("category_id") || null, // Lấy đúng name="category_id"
        store_id: formData.get("store_id"), // Lấy đúng name="store_id"
        // image_url và image_urls sẽ được set trong phần upload ảnh
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
      if (isNaN(productData.stock_quantity) || productData.stock_quantity < 0) {
        showAlert("Số lượng tồn kho phải là số nguyên không âm.", "error");
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
        return;
      }
      // --- Kết thúc Validation ---

      // --- Xử lý Upload Nhiều Ảnh (Nếu có file mới được chọn) ---
      let finalImageUrls = [...existingImageUrls]; // Bắt đầu với ảnh cũ (nếu có)

      if (selectedImageFiles.length > 0) {
        // Hiện loading trên nút submit
        submitButton.innerHTML =
          `<i class="fas fa-spinner fa-spin"></i> Đang tải ${selectedImageFiles.length} ảnh lên...`;
        try {
          const uploadFormData = new FormData();
          
          // Thêm tất cả file vào FormData với tên field là "images"
          selectedImageFiles.forEach((file) => {
            uploadFormData.append("images", file); // 'images' phải khớp với backend
          });

          // Gọi API upload nhiều ảnh của backend
          const uploadResponse = await apiCall("/products/upload-images", {
            method: "POST",
            body: uploadFormData, // Không set Content-Type, trình duyệt sẽ tự làm
            isFormData: true, // Thêm cờ để apiCall không set Content-Type JSON
          });

          if (uploadResponse && uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            const uploadedUrls = uploadResult.image_urls || []; // Lấy danh sách URLs từ kết quả upload
            
            // Kết hợp ảnh cũ và ảnh mới
            if (isEditMode && existingImageUrls.length > 0) {
              // Khi sửa: giữ ảnh cũ và thêm ảnh mới
              finalImageUrls = [...existingImageUrls, ...uploadedUrls];
            } else {
              // Khi thêm mới: chỉ dùng ảnh mới
              finalImageUrls = uploadedUrls;
            }
            
            // Cập nhật productData
            productData.image_urls = finalImageUrls;
            productData.image_url = finalImageUrls.length > 0 ? finalImageUrls[0] : null; // Giữ backward compatibility
            
            submitButton.innerHTML =
              '<i class="fas fa-spinner fa-spin"></i> Đang lưu...'; // Quay lại trạng thái lưu
          } else {
            const errorData = uploadResponse
              ? await uploadResponse.json()
              : { message: "Lỗi mạng khi upload" };
            showAlert(`Lỗi khi tải ảnh lên: ${errorData.message}`, "error");
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
            return; // Dừng lại nếu upload lỗi
          }
        } catch (uploadError) {
          showAlert(
            `Lỗi kết nối khi tải ảnh lên: ${uploadError.message}`,
            "error"
          );
          submitButton.disabled = false;
          submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
          return; // Dừng lại
        }
      } else {
        // Không có file mới, chỉ cập nhật với ảnh cũ (nếu có)
        if (finalImageUrls.length > 0) {
          productData.image_urls = finalImageUrls;
          productData.image_url = finalImageUrls[0]; // Giữ backward compatibility
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
          showAlert(`Lỗi khi lưu sản phẩm: ${errorData.message}`, "error");
        }
      } catch (error) {
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
      showAlert(`Lỗi khi xóa sản phẩm: ${errorData.message}`, "error");
    }
  } catch (error) {
    showAlert(`Lỗi khi xóa sản phẩm: ${error.message}`, "error");
  }
}

// --- Product Image Upload Functions ---
// Function selectProductImage đã được tích hợp vào setupProductImageUpload()

/**
 * Xóa ảnh khỏi preview và input hidden.
 * @param {boolean} clearFileInput - Có xóa file đã chọn trong input type="file" hay không.
 */
function removeProductImage(clearFileInput = true) {
  // Reset tất cả ảnh
  selectedImageFiles = [];
  existingImageUrls = [];
  updateImagePreview();
  
  if (clearFileInput) {
    const fileInput = document.getElementById("productImageFile");
    if (fileInput) fileInput.value = "";
  }
}

// Store selected image files and existing image URLs
let selectedImageFiles = [];
let existingImageUrls = [];

function setupProductImageUpload() {
  const fileInput = document.getElementById("productImageFile");
  const previewContainer = document.getElementById("productImagesPreview");
  const hiddenUrlInput = document.getElementById("productImageUrl");
  const hiddenUrlsInput = document.getElementById("productImageUrls");
  const removeAllBtn = document.getElementById("removeAllProductImagesBtn");
  const selectBtn = document.getElementById("selectProductImageBtn");

  // Xử lý khi chọn nhiều file
  fileInput.addEventListener("change", function (e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) {
      return;
    }

    // Kiểm tra số lượng ảnh tối đa (10)
    const currentCount = selectedImageFiles.length + existingImageUrls.length;
    const maxImages = 10;
    
    if (currentCount + files.length > maxImages) {
      const remainingSlots = maxImages - currentCount;
      showAlert(
        `Bạn chỉ có thể chọn tối đa ${maxImages} ảnh. Hiện tại đã có ${currentCount} ảnh. Chỉ có thể thêm ${remainingSlots} ảnh nữa.`,
        "error"
      );
      fileInput.value = "";
      return;
    }

    // Validate từng file
    const validFiles = [];
    const maxSizeInBytes = 10 * 1024 * 1024; // 10MB

    for (const file of files) {
      // Validate loại file
      if (!file.type.startsWith("image/")) {
        showAlert(`File "${file.name}" không phải là file ảnh hợp lệ.`, "error");
        continue;
      }

      // Validate kích thước
      if (file.size > maxSizeInBytes) {
        showAlert(`File "${file.name}" vượt quá kích thước tối đa 10MB.`, "error");
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      fileInput.value = "";
      return;
    }

    // Thêm vào danh sách file đã chọn (giữ nguyên thứ tự)
    // Sử dụng push từng file để đảm bảo thứ tự được giữ
    validFiles.forEach(file => {
      selectedImageFiles.push(file);
    });
    updateImagePreview();
    fileInput.value = ""; // Reset input để có thể chọn lại cùng file
  });

  // Nút chọn ảnh
  if (selectBtn) {
    selectBtn.addEventListener("click", function() {
      fileInput.click();
    });
  }

  // Nút xóa tất cả
  if (removeAllBtn) {
    removeAllBtn.addEventListener("click", function() {
      selectedImageFiles = [];
      existingImageUrls = [];
      updateImagePreview();
    });
  }
}

function updateImagePreview() {
  const previewContainer = document.getElementById("productImagesPreview");
  const removeAllBtn = document.getElementById("removeAllProductImagesBtn");
  const hiddenUrlInput = document.getElementById("productImageUrl");
  const hiddenUrlsInput = document.getElementById("productImageUrls");

  if (!previewContainer) {
    console.error("Preview container not found!");
    return;
  }

  const allImages = [...existingImageUrls.map(url => ({ type: 'url', value: url })), 
                     ...selectedImageFiles.map(file => ({ type: 'file', value: file }))];

  if (allImages.length === 0) {
    previewContainer.innerHTML = '';
    previewContainer.style.minHeight = '60px';
    if (removeAllBtn) removeAllBtn.style.display = 'none';
    if (hiddenUrlInput) hiddenUrlInput.value = '';
    if (hiddenUrlsInput) hiddenUrlsInput.value = '';
    return;
  }

  // Hiển thị nút xóa tất cả
  if (removeAllBtn) removeAllBtn.style.display = 'inline-block';

  // Tạo preview grid với error handling
  previewContainer.innerHTML = '';
  
  allImages.forEach((img, index) => {
    const isUrl = img.type === 'url';
    const imageId = isUrl ? `url-${index}` : `file-${index}`;
    
    // Tạo div container
    const previewItem = document.createElement('div');
    previewItem.className = 'image-preview-item';
    previewItem.id = `preview-${imageId}`;
    previewItem.style.cssText = 'position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 2px solid #e0e6ed; background: #f8f9fa;';
    
    // Tạo img element
    const imgElement = document.createElement('img');
    imgElement.id = `img-${imageId}`;
    imgElement.alt = `Preview ${index + 1}`;
    imgElement.style.cssText = 'width: 100%; height: 100%; object-fit: cover; cursor: pointer; display: block;';
    
    // Hiển thị loading state
    imgElement.style.opacity = '0.5';
    
    if (isUrl) {
      // Nếu là URL (ảnh từ server), dùng trực tiếp
      imgElement.src = img.value;
      imgElement.onclick = function() {
        previewImage(img.value);
      };
      imgElement.onload = function() {
        this.style.opacity = '1';
      };
    } else {
      // Nếu là File, luôn dùng FileReader để tạo data URL
      const reader = new FileReader();
      reader.onload = function(e) {
        imgElement.src = e.target.result;
        imgElement.style.opacity = '1';
        imgElement.onclick = function() {
          previewImage(e.target.result);
        };
      };
      reader.onerror = function() {
        console.error("Error reading file:", img.value.name);
        imgElement.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ELỗi%3C/text%3E%3C/svg%3E';
        imgElement.style.opacity = '1';
      };
      reader.readAsDataURL(img.value);
    }
    
    imgElement.onerror = function() {
      this.onerror = null;
      this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3ELỗi%3C/text%3E%3C/svg%3E';
      this.style.opacity = '1';
    };
    
    // Tạo nút xóa
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-image-btn';
    removeBtn.style.cssText = 'position: absolute; top: 4px; right: 4px; background: rgba(231, 76, 60, 0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; padding: 0; z-index: 10;';
    removeBtn.title = 'Xóa ảnh này';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.onclick = function() {
      removeImageAtIndex(index, isUrl);
    };
    
    previewItem.appendChild(imgElement);
    previewItem.appendChild(removeBtn);
    previewContainer.appendChild(previewItem);
  });


  // Cập nhật hidden inputs
  if (hiddenUrlsInput) {
    const allUrls = existingImageUrls; // URLs sẽ được cập nhật sau khi upload
    hiddenUrlsInput.value = JSON.stringify(allUrls);
  }
  if (hiddenUrlInput && allImages.length > 0) {
    // Giữ backward compatibility với image_url (ảnh đầu tiên)
    const firstImage = allImages[0];
    if (firstImage.type === 'url') {
      hiddenUrlInput.value = firstImage.value;
    }
  }
}

function removeImageAtIndex(index, isUrl) {
  if (isUrl) {
    existingImageUrls.splice(index, 1);
  } else {
    // Tìm index trong selectedImageFiles (bỏ qua existingImageUrls)
    const fileIndex = index - existingImageUrls.length;
    if (fileIndex >= 0 && fileIndex < selectedImageFiles.length) {
      selectedImageFiles.splice(fileIndex, 1);
    }
  }
  updateImagePreview();
}

function previewImage(src) {
  // Mở modal xem ảnh fullscreen (có thể implement sau)
  window.open(src, '_blank');
}
