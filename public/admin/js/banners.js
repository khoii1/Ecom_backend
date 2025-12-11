// Banners management functionality

let banners = [];
let isEditMode = false;
let products = [];
let categories = [];
let stores = [];

document.addEventListener("DOMContentLoaded", function () {
  loadBanners();
  loadProducts();
  loadCategories();
  loadStores();
  setupBannerForm();
  setupLinkTypeHandler();
  setupBannerImageUpload();
  addSearchToTable("searchBanner", "bannersTable");
  
  // Setup modal close button
  const closeBtn = document.getElementById("closeBannerModalBtn");
  const cancelBtn = document.getElementById("cancelBannerBtn");
  const addBtn = document.getElementById("addBannerBtn");
  
  if (closeBtn) {
    closeBtn.addEventListener("click", closeBannerModal);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener("click", closeBannerModal);
  }
  if (addBtn) {
    addBtn.addEventListener("click", () => openBannerModal());
  }
});

// Load products for dropdown
async function loadProducts() {
  try {
    const response = await apiCall("/products");
    if (response && response.ok) {
      products = await response.json();
    }
  } catch (error) {
    // Silent fail
  }
}

// Load categories for dropdown
async function loadCategories() {
  try {
    const response = await apiCall("/categories");
    if (response && response.ok) {
      categories = await response.json();
    }
  } catch (error) {
    // Silent fail
  }
}

// Load stores for dropdown
async function loadStores() {
  try {
    const response = await apiCall("/stores");
    if (response && response.ok) {
      stores = await response.json();
    }
  } catch (error) {
    // Silent fail
  }
}

async function loadBanners() {
  try {
    showLoading(true);

    const response = await apiCall("/banners");
    if (response && response.ok) {
      banners = await response.json();
      displayBanners();
    } else {
      const errorData = response
        ? await response.json()
        : { message: "Network error" };
      showAlert(
        `Lỗi khi tải danh sách banners: ${errorData.message}`,
        "error"
      );
      document.getElementById("bannersTableBody").innerHTML = `
        <tr><td colspan="9" style="text-align: center; color: red;">Lỗi khi tải dữ liệu: ${errorData.message}</td></tr>`;
    }
  } catch (error) {
    showAlert("Lỗi kết nối khi tải banners", "error");
    document.getElementById("bannersTableBody").innerHTML = `
        <tr><td colspan="9" style="text-align: center; color: red;">Lỗi kết nối mạng: ${error.message}</td></tr>`;
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  const loading = document.getElementById("bannersLoading");
  const table = document.getElementById("bannersTable");

  if (show) {
    loading.style.display = "block";
    table.style.display = "none";
  } else {
    loading.style.display = "none";
    table.style.display = "table";
  }
}

function displayBanners() {
  const tbody = document.getElementById("bannersTableBody");

  if (banners.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px; color: #6c757d;">
          <i class="fas fa-images" style="font-size: 48px; margin-bottom: 10px; display: block; opacity: 0.3;"></i>
          Chưa có banner nào. Nhấn "Thêm Banner" để tạo mới.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = banners
    .map(
      (banner) => `
    <tr>
      <td>
        <img 
          src="${banner.image_url}" 
          alt="${banner.title || ""}"
          style="width: 100px; height: 60px; object-fit: cover; border-radius: 4px;"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'60\\'%3E%3Crect fill=\\'%23ddd\\' width=\\'100\\' height=\\'60\\'/%3E%3Ctext fill=\\'%23999\\' font-family=\\'sans-serif\\' font-size=\\'14\\' x=\\'50\\' y=\\'30\\' text-anchor=\\'middle\\'%3ENo Image%3C/text%3E%3C/svg%3E'"
        />
      </td>
      <td>
        <strong>${banner.title || "-"}</strong>
        ${banner.description ? `<br><small style="color: #6c757d;">${truncateText(banner.description, 50)}</small>` : ""}
      </td>
      <td>
        <span class="badge badge-info">${getPositionLabel(banner.position)}</span>
      </td>
      <td>${banner.display_order || 0}</td>
      <td>
        ${getLinkDisplay(banner)}
      </td>
      <td>
        <span class="badge">${banner.click_count || 0}</span>
      </td>
      <td>
        <span class="badge ${banner.is_active ? "badge-success" : "badge-danger"}">
          ${banner.is_active ? "Đang hoạt động" : "Tắt"}
        </span>
      </td>
      <td>${formatDate(banner.createdAt)}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editBanner('${banner.id}')" title="Chỉnh sửa">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteBanner('${banner.id}')" title="Xóa">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `
    )
    .join("");
}

function getPositionLabel(position) {
  const labels = {
    home_top: "Trang chủ - Top",
    home_middle: "Trang chủ - Giữa",
    home_bottom: "Trang chủ - Dưới",
    category_top: "Danh mục - Top",
    sidebar: "Sidebar",
  };
  return labels[position] || position;
}

function getLinkDisplay(banner) {
  if (!banner.link_type || banner.link_type === "none") {
    return '<span style="color: #6c757d;">-</span>';
  }

  const linkText = banner.link_target_id || "-";
  const typeLabels = {
    product: "Sản phẩm",
    category: "Danh mục",
    store: "Cửa hàng",
  };

  // Tìm tên của đối tượng
  let displayName = linkText;
  if (banner.link_type === "product") {
    const product = products.find(p => p.id === linkText);
    displayName = product ? (product.title || linkText) : linkText;
  } else if (banner.link_type === "category") {
    const category = categories.find(c => c.id === linkText);
    displayName = category ? (category.name || linkText) : linkText;
  } else if (banner.link_type === "store") {
    const store = stores.find(s => s.id === linkText);
    displayName = store ? (store.name || linkText) : linkText;
  }

  return `<span class="badge">${typeLabels[banner.link_type] || banner.link_type}: ${truncateText(displayName, 30)}</span>`;
}

function setupLinkTypeHandler() {
  const linkTypeSelect = document.getElementById("bannerLinkType");
  const linkTargetGroup = document.getElementById("linkTargetGroup");
  const linkTargetLabel = document.getElementById("linkTargetLabel");
  const linkTargetSelect = document.getElementById("bannerLinkTarget");

  linkTypeSelect.addEventListener("change", function () {
    const linkType = this.value;

    if (linkType === "none") {
      linkTargetGroup.style.display = "none";
      linkTargetSelect.innerHTML = '<option value="">-- Chọn --</option>';
    } else {
      linkTargetGroup.style.display = "block";
      
      // Cập nhật label
      const labels = {
        product: "Chọn sản phẩm",
        category: "Chọn danh mục",
        store: "Chọn cửa hàng"
      };
      linkTargetLabel.innerHTML = `
        <i class="fas fa-list" style="margin-right: 8px; color: #3498db; font-size: 16px;"></i>
        ${labels[linkType] || "Chọn đối tượng"}
      `;

      // Populate dropdown based on link type
      linkTargetSelect.innerHTML = '<option value="">-- Chọn --</option>';
      
      if (linkType === "product") {
        products.forEach(product => {
          const option = document.createElement("option");
          option.value = product.id;
          option.textContent = product.title || `Sản phẩm #${product.id}`;
          linkTargetSelect.appendChild(option);
        });
      } else if (linkType === "category") {
        categories.forEach(category => {
          const option = document.createElement("option");
          option.value = category.id;
          option.textContent = category.name || `Danh mục #${category.id}`;
          linkTargetSelect.appendChild(option);
        });
      } else if (linkType === "store") {
        stores.forEach(store => {
          const option = document.createElement("option");
          option.value = store.id;
          option.textContent = store.name || `Cửa hàng #${store.id}`;
          linkTargetSelect.appendChild(option);
        });
      }
    }
  });
}

function setupBannerImageUpload() {
  const imageFileInput = document.getElementById("bannerImageFile");
  const imagePreview = document.getElementById("bannerImagePreview");
  const selectBtn = document.getElementById("selectBannerImageBtn");
  const removeBtn = document.getElementById("removeBannerImageBtn");
  const hiddenUrlInput = document.getElementById("bannerImageUrl");

  // Click vào preview hoặc button để chọn file
  if (imagePreview) {
    imagePreview.addEventListener("click", () => imageFileInput.click());
  }
  if (selectBtn) {
    selectBtn.addEventListener("click", () => imageFileInput.click());
  }

  // Khi chọn file
  if (imageFileInput) {
    imageFileInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          showAlert("File ảnh không được vượt quá 5MB", "error");
          return;
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
          showAlert("Vui lòng chọn file ảnh hợp lệ", "error");
          return;
        }

        // Preview image
        const reader = new FileReader();
        reader.onload = function (e) {
          imagePreview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;" />`;
          if (removeBtn) removeBtn.style.display = "inline-block";
          // Lưu file vào biến để upload sau
          window._bannerImageFile = file;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Xóa ảnh
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      imagePreview.innerHTML = `
        <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: #95a5a6; margin-bottom: 0.5rem;"></i>
        <span style="color: #6c757d; font-size: 14px; font-weight: 500;">Chọn hoặc kéo thả ảnh</span>
      `;
      removeBtn.style.display = "none";
      if (imageFileInput) imageFileInput.value = "";
      if (hiddenUrlInput) hiddenUrlInput.value = "";
      window._bannerImageFile = null;
    });
  }
}

function setupBannerForm() {
  const form = document.getElementById("bannerForm");
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitButton = this.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    // Xử lý upload ảnh trước
    let imageUrl = document.getElementById("bannerImageUrl").value.trim();
    const imageFile = window._bannerImageFile || document.getElementById("bannerImageFile").files[0];

    if (imageFile) {
      try {
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải ảnh lên...';
        
        const uploadFormData = new FormData();
        uploadFormData.append("image", imageFile);

        // Sử dụng endpoint upload của products (hoặc tạo endpoint riêng cho banner)
        const uploadResponse = await apiCall("/products/upload-image", {
          method: "POST",
          body: uploadFormData,
          isFormData: true,
        });

        if (uploadResponse && uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          imageUrl = uploadResult.image_url;
        } else {
          const errorData = uploadResponse ? await uploadResponse.json() : { message: "Lỗi upload ảnh" };
          showAlert(`Lỗi khi tải ảnh lên: ${errorData.message}`, "error");
          submitButton.disabled = false;
          submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
          return;
        }
        } catch (error) {
        showAlert(`Lỗi kết nối khi tải ảnh lên: ${error.message}`, "error");
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
        return;
      }
    }

    if (!imageUrl) {
      showAlert("Vui lòng chọn ảnh banner", "error");
      submitButton.disabled = false;
      submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
      return;
    }

    const bannerData = {
      title: document.getElementById("bannerTitle").value.trim(),
      description: document.getElementById("bannerDescription").value.trim() || null,
      image_url: imageUrl,
      position: document.getElementById("bannerPosition").value,
      display_order: parseInt(document.getElementById("bannerDisplayOrder").value) || 0,
      link_type: document.getElementById("bannerLinkType").value,
      is_active: document.getElementById("bannerIsActive").checked,
    };

    // Handle link data
    const linkType = bannerData.link_type;
    if (linkType !== "none") {
      bannerData.link_target_id = document.getElementById("bannerLinkTarget").value.trim() || null;
    } else {
      bannerData.link_target_id = null;
    }

    // Handle dates
    const startDate = document.getElementById("bannerStartDate").value;
    if (startDate) {
      bannerData.start_date = new Date(startDate).toISOString();
    }

    const endDate = document.getElementById("bannerEndDate").value;
    if (endDate) {
      bannerData.end_date = new Date(endDate).toISOString();
    } else {
      bannerData.end_date = null;
    }

    const bannerId = document.getElementById("bannerId").value;

    try {
      let response;
      if (bannerId) {
        // Update
        response = await apiCall(`/banners/${bannerId}`, {
          method: "PUT",
          body: JSON.stringify(bannerData),
        });
      } else {
        // Create
        response = await apiCall("/banners", {
          method: "POST",
          body: JSON.stringify(bannerData),
        });
      }

      if (response && response.ok) {
        showAlert(
          bannerId ? "Cập nhật banner thành công!" : "Tạo banner thành công!",
          "success"
        );
        closeBannerModal();
        loadBanners();
      } else {
        const errorData = await response.json();
        showAlert(
          `Lỗi: ${errorData.message || "Không thể lưu banner"}`,
          "error"
        );
      }
    } catch (error) {
      showAlert(`Lỗi kết nối khi lưu banner: ${error.message}`, "error");
      submitButton.disabled = false;
      submitButton.innerHTML = '<i class="fas fa-save"></i> Lưu';
    }
  });
}

// Biến để tránh vòng lặp vô hạn
let isOpeningModal = false;

function openBannerModal(bannerId = null) {
  // Tránh gọi nhiều lần đồng thời
  if (isOpeningModal) {
    return;
  }
  
  const modal = document.getElementById("bannerModal");
  const form = document.getElementById("bannerForm");
  const title = document.getElementById("modalTitle");

  if (!modal || !form || !title) {
    return;
  }

  isOpeningModal = true;
  isEditMode = !!bannerId;

  // Load dữ liệu cho dropdown nếu chưa có (load ở background, không block)
  if (products.length === 0 || categories.length === 0 || stores.length === 0) {
    // Load dữ liệu ở background, không đợi
    Promise.all([
      loadProducts(),
      loadCategories(),
      loadStores()
    ]).catch(() => {
      // Không block việc mở modal nếu load lỗi
    });
  }

  if (bannerId) {
    const banner = banners.find((b) => b.id === bannerId);
    if (banner) {
      title.textContent = "Chỉnh sửa Banner";
      document.getElementById("bannerId").value = banner.id;
      document.getElementById("bannerTitle").value = banner.title || "";
      document.getElementById("bannerDescription").value = banner.description || "";
      document.getElementById("bannerImageUrl").value = banner.image_url || "";
      
      // Hiển thị preview ảnh nếu có
      const imagePreview = document.getElementById("bannerImagePreview");
      if (banner.image_url && imagePreview) {
        imagePreview.innerHTML = `<img src="${banner.image_url}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;" />`;
        const removeBtn = document.getElementById("removeBannerImageBtn");
        if (removeBtn) removeBtn.style.display = "inline-block";
      }
      
      document.getElementById("bannerPosition").value = banner.position || "home_top";
      document.getElementById("bannerDisplayOrder").value = banner.display_order || 0;
      document.getElementById("bannerLinkType").value = banner.link_type || "none";
      document.getElementById("bannerIsActive").checked = banner.is_active !== false;

      // Trigger link type change first to populate dropdown
      document.getElementById("bannerLinkType").dispatchEvent(new Event("change"));
      
      // Set link target value after dropdown is populated
      setTimeout(() => {
        if (banner.link_type && banner.link_type !== "none") {
          const targetSelect = document.getElementById("bannerLinkTarget");
          if (targetSelect) {
            targetSelect.value = banner.link_target_id || "";
          }
        } else {
          const targetSelect = document.getElementById("bannerLinkTarget");
          if (targetSelect) {
            targetSelect.value = "";
          }
        }
        isOpeningModal = false;
      }, 300);

      // Handle dates
      if (banner.start_date) {
        const startDate = new Date(banner.start_date);
        document.getElementById("bannerStartDate").value = startDate.toISOString().slice(0, 16);
      } else {
        document.getElementById("bannerStartDate").value = "";
      }

      if (banner.end_date) {
        const endDate = new Date(banner.end_date);
        document.getElementById("bannerEndDate").value = endDate.toISOString().slice(0, 16);
      } else {
        document.getElementById("bannerEndDate").value = "";
      }
    }
  } else {
    title.textContent = "Thêm Banner Mới";
    form.reset();
    document.getElementById("bannerId").value = "";
    document.getElementById("bannerDisplayOrder").value = 0;
    document.getElementById("bannerLinkType").value = "none";
    document.getElementById("bannerIsActive").checked = true;
    document.getElementById("linkTargetGroup").style.display = "none";
    
    // Reset image preview
    const imagePreview = document.getElementById("bannerImagePreview");
    if (imagePreview) {
      imagePreview.innerHTML = `
        <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: #95a5a6; margin-bottom: 0.5rem;"></i>
        <span style="color: #6c757d; font-size: 14px; font-weight: 500;">Chọn hoặc kéo thả ảnh</span>
      `;
    }
    const removeBtn = document.getElementById("removeBannerImageBtn");
    if (removeBtn) removeBtn.style.display = "none";
    window._bannerImageFile = null;
  }

  modal.classList.add("show");
  // Reset flag sau khi mở modal
  setTimeout(() => {
    isOpeningModal = false;
  }, 100);
}

function closeBannerModal() {
  const modal = document.getElementById("bannerModal");
  modal.classList.remove("show");
  document.getElementById("bannerForm").reset();
  document.getElementById("bannerId").value = "";
  
  // Reset image preview
  const imagePreview = document.getElementById("bannerImagePreview");
  const removeBtn = document.getElementById("removeBannerImageBtn");
  if (imagePreview) {
    imagePreview.innerHTML = `
      <i class="fas fa-cloud-upload-alt" style="font-size: 3rem; color: #95a5a6; margin-bottom: 0.5rem;"></i>
      <span style="color: #6c757d; font-size: 14px; font-weight: 500;">Chọn hoặc kéo thả ảnh</span>
    `;
  }
  if (removeBtn) removeBtn.style.display = "none";
  window._bannerImageFile = null;
  
  isEditMode = false;
}

async function editBanner(bannerId) {
  openBannerModal(bannerId);
}

async function deleteBanner(bannerId) {
  if (!confirm("Bạn có chắc chắn muốn xóa banner này?")) {
    return;
  }

  try {
    const response = await apiCall(`/banners/${bannerId}`, {
      method: "DELETE",
    });

    if (response && response.ok) {
      showAlert("Xóa banner thành công!", "success");
      loadBanners();
    } else {
      const errorData = await response.json();
      showAlert(`Lỗi: ${errorData.message || "Không thể xóa banner"}`, "error");
    }
  } catch (error) {
    showAlert("Lỗi kết nối khi xóa banner", "error");
  }
}

