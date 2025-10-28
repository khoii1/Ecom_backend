// Categories management functionality

let categories = [];
let isEditMode = false;

document.addEventListener("DOMContentLoaded", function () {
  loadCategories();
  setupCategoryForm();
});

async function loadCategories() {
  try {
    showLoading(true);

    const response = await apiCall("/categories");
    if (response && response.ok) {
      categories = await response.json();
      displayCategories();
      populateParentCategoryOptions();
    } else {
      showAlert("Lỗi khi tải danh sách danh mục", "error");
    }
  } catch (error) {
    console.error("Error loading categories:", error);
    showAlert("Lỗi kết nối khi tải danh mục", "error");
  } finally {
    showLoading(false);
  }
}

function displayCategories() {
  const tbody = document.getElementById("categoriesTableBody");

  if (categories.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    <i class="fas fa-tags" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                    Không có danh mục nào
                </td>
            </tr>
        `;
    return;
  }

  // Sắp xếp categories theo cấu trúc phân cấp
  const hierarchicalCategories = buildCategoryHierarchy(categories);

  tbody.innerHTML = hierarchicalCategories
    .map(
      (item) => `
        <tr>
            <td>
                <div style="display: flex; align-items: center;">
                    ${
                      item.category.image_url
                        ? `
                        <img src="${item.category.image_url}" alt="${item.category.name}" 
                             style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; margin-right: 10px;">
                    `
                        : `
                        <div style="width: 40px; height: 40px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; margin-right: 10px; display: flex; align-items: center; justify-content: center;">
                            <i class="fas fa-image" style="color: #6c757d; font-size: 14px;"></i>
                        </div>
                    `
                    }
                    <span style="margin-left: ${item.level * 20}px;">
                        ${item.category.name}
                    </span>
                </div>
            </td>
            <td>${getParentCategoryName(item.category.parent_id)}</td>
            <td>${formatDate(item.category.created_at)}</td>
            <td>
                <button class="btn btn-warning btn-sm" onclick="editCategory('${
                  item.category.id
                }')" style="margin-right: 0.5rem;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteCategory('${
                  item.category.id
                }', '${item.category.name}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join("");
}

function buildCategoryHierarchy(categoriesList) {
  const result = [];
  const categoryMap = {};

  // Tạo map để dễ tìm kiếm
  categoriesList.forEach((cat) => {
    categoryMap[cat.id] = { ...cat, children: [] };
  });

  // Tìm danh mục gốc và xây dựng cây
  const rootCategories = [];
  categoriesList.forEach((cat) => {
    if (!cat.parent_id) {
      rootCategories.push(categoryMap[cat.id]);
    } else if (categoryMap[cat.parent_id]) {
      categoryMap[cat.parent_id].children.push(categoryMap[cat.id]);
    }
  });

  // Chuyển cây thành danh sách phẳng với level
  function flattenTree(categories, level = 0) {
    categories.forEach((cat) => {
      result.push({ category: cat, level });
      if (cat.children.length > 0) {
        flattenTree(cat.children, level + 1);
      }
    });
  }

  flattenTree(rootCategories);
  return result;
}

function getParentCategoryName(parentId) {
  if (!parentId) return '<em style="color: #6c757d;">Danh mục gốc</em>';
  const parent = categories.find((c) => c.id === parentId);
  return parent
    ? parent.name
    : '<em style="color: #dc3545;">Không tìm thấy</em>';
}

function populateParentCategoryOptions() {
  const select = document.getElementById("parentCategory");
  if (!select) return;

  select.innerHTML = '<option value="">-- Không có danh mục cha --</option>';

  // Sắp xếp categories theo tên
  const sortedCategories = [...categories].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  sortedCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.appendChild(option);
  });
}

function showLoading(show) {
  const loading = document.getElementById("categoriesLoading");
  const table = document.getElementById("categoriesTable");

  if (show) {
    loading.style.display = "block";
    table.style.display = "none";
  } else {
    loading.style.display = "none";
    table.style.display = "table";
  }
}

// Modal functions
function openAddCategoryModal() {
  isEditMode = false;
  document.getElementById("categoryModalTitle").textContent = "Thêm danh mục";
  document.getElementById("categoryForm").reset();
  document.getElementById("categoryId").value = "";
  document.getElementById("categoryModal").classList.add("show");
}

function editCategory(categoryId) {
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return;

  isEditMode = true;
  document.getElementById("categoryModalTitle").textContent = "Sửa danh mục";
  document.getElementById("categoryId").value = category.id;
  document.getElementById("categoryName").value = category.name;
  document.getElementById("parentCategory").value = category.parent_id || "";
  document.getElementById("categoryImageUrl").value = category.image_url || "";

  // Set image preview
  const preview = document.getElementById("categoryImagePreview");
  const removeBtn = document.getElementById("removeCategoryImageBtn");

  if (category.image_url) {
    preview.innerHTML = `<img src="${category.image_url}" alt="Category Image">`;
    removeBtn.style.display = "inline-block";
  } else {
    preview.innerHTML = `
      <i class="fas fa-image"></i>
      <span>Chọn ảnh</span>
    `;
    removeBtn.style.display = "none";
  }

  document.getElementById("categoryModal").classList.add("show");
}

function closeCategoryModal() {
  document.getElementById("categoryModal").classList.remove("show");
  document.getElementById("categoryForm").reset();

  // Reset image upload
  const preview = document.getElementById("categoryImagePreview");
  const removeBtn = document.getElementById("removeCategoryImageBtn");

  preview.innerHTML = `
    <i class="fas fa-image"></i>
    <span>Chọn ảnh</span>
  `;
  removeBtn.style.display = "none";
  document.getElementById("categoryImageFile").value = "";
  document.getElementById("categoryImageUrl").value = "";
}

// Setup form submission
function setupCategoryForm() {
  document
    .getElementById("categoryForm")
    .addEventListener("submit", async function (e) {
      e.preventDefault();

      const formData = new FormData(this);
      const categoryData = {
        name: formData.get("name"),
        parent_id: formData.get("parent_id") || null,
        image_url: formData.get("image_url") || null,
      };

      console.log("Form data being sent:", categoryData);

      try {
        let response;

        if (isEditMode) {
          const categoryId = document.getElementById("categoryId").value;
          response = await apiCall(`/categories/${categoryId}`, {
            method: "PUT",
            body: JSON.stringify(categoryData),
          });
        } else {
          response = await apiCall("/categories", {
            method: "POST",
            body: JSON.stringify(categoryData),
          });
        }

        if (response && response.ok) {
          showAlert(
            isEditMode
              ? "Cập nhật danh mục thành công!"
              : "Thêm danh mục thành công!",
            "success"
          );
          closeCategoryModal();
          loadCategories();
        } else {
          const errorData = await response.json();
          showAlert(errorData.message || "Có lỗi xảy ra", "error");
        }
      } catch (error) {
        console.error("Error saving category:", error);
        showAlert("Lỗi khi lưu thông tin danh mục", "error");
      }
    });
}

async function deleteCategory(categoryId, categoryName) {
  if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${categoryName}"?`)) {
    return;
  }

  try {
    const response = await apiCall(`/categories/${categoryId}`, {
      method: "DELETE",
    });

    if (response && response.ok) {
      showAlert("Xóa danh mục thành công!", "success");
      loadCategories();
    } else {
      const errorData = await response.json();
      showAlert(errorData.message || "Có lỗi xảy ra khi xóa", "error");
    }
  } catch (error) {
    console.error("Error deleting category:", error);
    showAlert("Lỗi khi xóa danh mục", "error");
  }
}

// Image Upload Functions
function selectCategoryImage() {
  document.getElementById("categoryImageFile").click();
}

function removeCategoryImage() {
  const preview = document.getElementById("categoryImagePreview");
  const hiddenInput = document.getElementById("categoryImageUrl");
  const removeBtn = document.getElementById("removeCategoryImageBtn");

  // Reset preview
  preview.innerHTML = `
    <i class="fas fa-image"></i>
    <span>Chọn ảnh</span>
  `;

  // Clear values
  document.getElementById("categoryImageFile").value = "";
  hiddenInput.value = "";

  // Hide remove button
  removeBtn.style.display = "none";
}

function setupImageUpload() {
  const fileInput = document.getElementById("categoryImageFile");
  const preview = document.getElementById("categoryImagePreview");
  const removeBtn = document.getElementById("removeCategoryImageBtn");

  // Handle file selection
  fileInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      showAlert("Vui lòng chọn file ảnh hợp lệ", "error");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showAlert("Kích thước file không được vượt quá 5MB", "error");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
      removeBtn.style.display = "inline-block";

      // Convert to base64 for storage (temporary solution)
      document.getElementById("categoryImageUrl").value = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Handle click on preview to select new image
  preview.addEventListener("click", selectCategoryImage);
}

// Initialize image upload when DOM is ready
document.addEventListener("DOMContentLoaded", function () {
  setupImageUpload();
});
