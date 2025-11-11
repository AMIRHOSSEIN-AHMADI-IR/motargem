/**
 * @file settings.js
 * خلاصه یک‌خطی: این فایل منطق صفحه تنظیمات (settings.html) را مدیریت می‌کند، شامل مدیریت کلیدهای API، تم، و سایر تنظیمات برنامه.
 * Dependencies: ./db.js, ./utils.js
 * NOTE: Internal. این اسکریپت به طور انحصاری برای settings.html استفاده می‌شود.
 * Comments updated by AI: 2025-11-11
 */
import { getSetting, saveSetting, clearHistory } from "./db.js";
import { copyToClipboard } from "./utils.js";

document.addEventListener("DOMContentLoaded", async () => {
  // --- ثابت‌ها ---

  /**
   * یک شیء برای نگهداری کلیدهای ثابت تنظیمات که در پایگاه داده استفاده می‌شوند.
   * این کار از بروز خطا به دلیل اشتباهات تایپی جلوگیری کرده و نگهداری کد را آسان‌تر می‌کند.
   */
  const SETTINGS = {
    API_KEYS: "apiKeys",
    LAST_KEY_INDEX: "lastKeyIndex",
    AUTO_TRANSLATE: "autoTranslateOnPaste",
    AUTO_COPY: "autoCopyResult",
    THEME: "theme",
  };
  let toastTimeout; // متغیری برای مدیریت زمان‌بندی نمایش اعلان‌ها

  // --- ذخیره‌سازی ارجاع به عناصر DOM برای دسترسی سریع‌تر ---
  const addKeyForm = document.getElementById("add-key-form");
  const apiKeyInput = document.getElementById("api-key-input");
  const toggleNewKeyVisibility = document.getElementById(
    "toggle-new-key-visibility"
  );
  const apiKeysList = document.getElementById("api-keys-list");
  const emptyKeysState = document.getElementById("empty-keys-state");
  const autoTranslateToggle = document.getElementById("auto-translate-toggle");
  const autoCopyToggle = document.getElementById("auto-copy-toggle");

  const themeSelector = document.getElementById("theme-selector");
  const themeButtons = document.querySelectorAll(".theme-button");
  const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // عناصر مودال راهنما
  const guideModal = document.getElementById("guide-modal");
  const openGuideModalButton = document.getElementById(
    "open-guide-modal-button"
  );
  const closeGuideModalButton = document.getElementById(
    "close-guide-modal-button"
  );
  const guideModalBackdrop = document.getElementById("guide-modal-backdrop");

  // عناصر مودال تایید حذف
  const clearHistoryButton = document.getElementById("clear-history-button");
  const confirmClearModal = document.getElementById("confirm-clear-modal");
  const confirmModalBackdrop = document.getElementById(
    "confirm-modal-backdrop"
  );
  const cancelClearButton = document.getElementById("cancel-clear-button");
  const confirmClearButton = document.getElementById("confirm-clear-button");

  // --- وضعیت (State) ---
  let keys = []; // آرایه‌ای برای نگهداری کلیدهای API در حافظه

  // --- توابع مربوط به UI و رندرینگ ---

  /**
   * تم انتخاب شده را بر روی کل سند HTML اعمال می‌کند.
   * با افزودن یا حذف کلاس 'dark' از عنصر `<html>` کار می‌کند.
   * @param {'light' | 'dark' | 'system'} theme - تمی که باید اعمال شود.
   */
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // برای حالت 'system'، بر اساس تنظیمات سیستم‌عامل تصمیم‌گیری می‌شود.
      if (systemThemeQuery.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }

  /**
   * وضعیت بصری دکمه‌های انتخاب تم را بر اساس تم فعال فعلی به‌روز می‌کند.
   * @param {string} currentTheme - تم فعلی ('light', 'dark', 'system').
   */
  function updateThemeUI(currentTheme) {
    themeButtons.forEach((button) => {
      const isSelected = button.dataset.themeValue === currentTheme;
      button.setAttribute("aria-checked", isSelected);
      // تغییر کلاس‌های CSS برای نمایش حالت انتخاب‌شده.
      if (isSelected) {
        button.classList.add("bg-blue-600", "text-white");
        button.classList.remove(
          "bg-gray-100",
          "dark:bg-gray-700",
          "text-gray-800",
          "dark:text-gray-200"
        );
      } else {
        button.classList.remove("bg-blue-600", "text-white");
        button.classList.add(
          "bg-gray-100",
          "dark:bg-gray-700",
          "text-gray-800",
          "dark:text-gray-200"
        );
      }
    });
  }

  /**
   * لیست کلیدهای API را بر اساس آرایه `keys` در صفحه رندر می‌کند.
   * در صورت خالی بودن لیست، پیام مناسب را نمایش می‌دهد.
   */
  function renderApiKeys() {
    apiKeysList.innerHTML = "";
    emptyKeysState.classList.toggle("hidden", keys.length > 0);

    keys.forEach((key, index) => {
      const keyElement = document.createElement("div");
      keyElement.className =
        "flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-2 ps-4 rounded-lg gap-x-2";
      keyElement.innerHTML = `
                <div class="flex-grow min-w-0">
                    <input type="password" value="${key}" readonly class="w-full bg-transparent text-gray-800 dark:text-gray-200 font-mono text-sm focus:outline-none truncate">
                </div>
                <div class="flex flex-shrink-0 items-center">
                    <button data-action="toggle" data-index="${index}" aria-label="نمایش کلید" class="p-2 text-gray-500 dark:text-gray-400 lg:hover:text-gray-800 dark:lg:hover:text-gray-200 rounded-lg transition-colors">
                        <svg class="w-6 h-6 pointer-events-none"><use href="/icons.svg#icon-eye"></use></svg>
                    </button>
                    <button data-action="copy" data-index="${index}" aria-label="کپی کلید" class="p-2 text-gray-500 dark:text-gray-400 lg:hover:text-gray-800 dark:lg:hover:text-gray-200 rounded-lg transition-colors">
                        <svg class="w-6 h-6 pointer-events-none"><use href="/icons.svg#icon-copy"></use></svg>
                    </button>
                    <button data-action="delete" data-index="${index}" aria-label="حذف کلید" class="p-2 text-gray-500 dark:text-gray-400 lg:hover:text-red-600 dark:lg:hover:text-red-400 rounded-lg transition-colors">
                        <svg class="w-6 h-6 pointer-events-none"><use href="/icons.svg#icon-delete"></use></svg>
                    </button>
                </div>
            `;
      apiKeysList.appendChild(keyElement);
    });
  }

  /**
   * وضعیت بصری یک کلید تاگل (switch) را به‌روز می‌کند.
   * @param {HTMLElement} toggleContainer - عنصر والد تاگل.
   * @param {boolean} isActive - آیا تاگل باید در حالت فعال نمایش داده شود؟
   */
  function updateToggleUI(toggleContainer, isActive) {
    const handle = toggleContainer.querySelector("div");
    toggleContainer.setAttribute("aria-checked", String(isActive));
    if (isActive) {
      toggleContainer.classList.remove("bg-gray-200", "dark:bg-gray-700");
      toggleContainer.classList.add("bg-blue-600");
      handle.classList.add("-translate-x-5");
    } else {
      toggleContainer.classList.remove("bg-blue-600");
      toggleContainer.classList.add("bg-gray-200", "dark:bg-gray-700");
      handle.classList.remove("-translate-x-5");
    }
  }

  /**
   * قابلیت نمایش یا مخفی کردن محتوای یک فیلد ورودی (مانند رمز عبور) را کنترل می‌کند.
   * @param {HTMLInputElement} input - فیلد ورودی.
   * @param {HTMLButtonElement} button - دکمه‌ای که این عمل را کنترل می‌کند.
   */
  function toggleInputVisibility(input, button) {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    input.classList.toggle("truncate", !isPassword);
    button
      .querySelector("use")
      .setAttribute(
        "href",
        isPassword ? "/icons.svg#icon-eye-slash" : "/icons.svg#icon-eye"
      );
  }

  /**
   * یک اعلان موقت (toast) در بالای صفحه نمایش می‌دهد.
   * @param {string} message - پیامی که باید نمایش داده شود.
   * @param {boolean} [isError=false] - اگر true باشد، اعلان با رنگ قرمز (خطا) نمایش داده می‌شود.
   */
  function showToast(message, isError = false) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    if (toastTimeout) clearTimeout(toastTimeout);
    container.innerHTML = "";
    const toast = document.createElement("div");
    const bgColor = isError ? "bg-red-600" : "bg-green-600";
    toast.className = `w-full max-w-md ${bgColor} text-white font-semibold text-center p-3 rounded-xl transition-all duration-300 ease-in-out opacity-0 -translate-y-12 pointer-events-auto`;
    toast.textContent = message;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove("opacity-0", "-translate-y-12");
      toast.classList.add("opacity-100", "translate-y-0");
    });
    toastTimeout = setTimeout(() => {
      toast.classList.remove("opacity-100", "translate-y-0");
      toast.classList.add("opacity-0", "-translate-y-12");
      toast.addEventListener("transitionend", () => toast.remove(), {
        once: true,
      });
    }, 7000);
  }

  /**
   * بازخورد بصری موقتی (نمایش تیک سبز) روی یک دکمه پس از یک عمل موفقیت‌آمیز ارائه می‌دهد.
   * @param {HTMLElement} button - دکمه‌ای که بازخورد روی آن اعمال می‌شود.
   */
  function provideFeedback(button) {
    const originalIconHref = button.querySelector("use").getAttribute("href");
    const originalColorClass = "text-gray-500";
    const successColorClass = "text-green-600";
    button.disabled = true;
    button.classList.remove(originalColorClass);
    button.classList.add(successColorClass);
    button.querySelector("use").setAttribute("href", "/icons.svg#icon-check");
    setTimeout(() => {
      button.querySelector("use").setAttribute("href", originalIconHref);
      button.classList.remove(successColorClass);
      button.classList.add(originalColorClass);
      button.disabled = false;
    }, 1500);
  }

  // --- توابع مربوط به منطق داده‌ها ---

  /**
   * تمام تنظیمات را از IndexedDB بارگذاری کرده و UI را بر اساس آن‌ها به‌روز می‌کند.
   */
  async function loadSettings() {
    try {
      keys = (await getSetting(SETTINGS.API_KEYS)) || [];
      renderApiKeys();

      const theme = (await getSetting(SETTINGS.THEME)) || "system";
      updateThemeUI(theme);

      const autoTranslate =
        (await getSetting(SETTINGS.AUTO_TRANSLATE)) || false;
      updateToggleUI(autoTranslateToggle, autoTranslate);

      const autoCopy = (await getSetting(SETTINGS.AUTO_COPY)) || false;
      updateToggleUI(autoCopyToggle, autoCopy);
    } catch (error) {
      console.error("Error loading settings:", error);
      showToast("خطا در بارگذاری تنظیمات.", true);
    }
  }

  /**
   * یک کلید API جدید را پس از اعتبارسنجی به لیست اضافه کرده و آن را در پایگاه داده ذخیره می‌کند.
   * @param {string} key - کلید API که باید اضافه شود.
   */
  async function addApiKey(key) {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      showToast("کلید API نمی‌تواند خالی باشد.", true);
      return;
    }
    if (keys.includes(trimmedKey)) {
      showToast("این کلید قبلاً اضافه شده است.", true);
      return;
    }
    keys.push(trimmedKey);
    await saveSetting(SETTINGS.API_KEYS, keys);
    apiKeyInput.value = "";
    showToast("کلید API با موفقیت افزوده شد.");
    renderApiKeys();
  }

  /**
   * یک کلید API را از لیست بر اساس ایندکس آن حذف می‌کند.
   * @param {number} index - ایندکس کلیدی که باید حذف شود.
   */
  async function deleteApiKey(index) {
    keys.splice(index, 1);
    await saveSetting(SETTINGS.API_KEYS, keys);
    // ایندکس کلید بعدی را ریست می‌کند تا از بروز خطا جلوگیری شود.
    await saveSetting(SETTINGS.LAST_KEY_INDEX, -1);
    showToast("کلید API حذف شد.");
    renderApiKeys();
  }

  /**
   * یک تابع عمومی برای مدیریت تغییر وضعیت تاگل‌های تنظیمات رفتاری برنامه.
   * @param {string} key - کلید تنظیمات در پایگاه داده.
   * @param {HTMLElement} toggle - عنصر تاگل.
   */
  async function handleBehaviorToggle(key, toggle) {
    const currentValue = toggle.getAttribute("aria-checked") === "true";
    const newValue = !currentValue;
    updateToggleUI(toggle, newValue);
    try {
      await saveSetting(key, newValue);
    } catch (error) {
      console.error(`Failed to save setting ${key}:`, error);
      // در صورت بروز خطا، UI را به حالت قبل بازمی‌گرداند.
      updateToggleUI(toggle, currentValue);
    }
  }

  // --- توابع مربوط به منطق مودال ---

  /**
   * یک مودال را نمایش می‌دهد.
   * @param {HTMLElement} modal - عنصر مودال.
   */
  function openModal(modal) {
    modal.classList.remove("hidden");
  }

  /**
   * یک مودال را مخفی می‌کند.
   * @param {HTMLElement} modal - عنصر مودال.
   */
  function closeModal(modal) {
    modal.classList.add("hidden");
  }

  // --- ثبت Event Listeners ---

  // مدیریت انتخاب تم
  themeSelector.addEventListener("click", async (e) => {
    const button = e.target.closest(".theme-button");
    if (!button) return;
    const theme = button.dataset.themeValue;
    updateThemeUI(theme);
    applyTheme(theme);
    await saveSetting(SETTINGS.THEME, theme);
  });

  // گوش دادن به تغییرات تم سیستم‌عامل برای به‌روزرسانی خودکار
  systemThemeQuery.addEventListener("change", async () => {
    const currentTheme = (await getSetting(SETTINGS.THEME)) || "system";
    if (currentTheme === "system") {
      applyTheme("system");
    }
  });

  // افزودن کلید API جدید با ارسال فرم
  addKeyForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addApiKey(apiKeyInput.value);
  });

  // نمایش/مخفی کردن کلید API جدید
  toggleNewKeyVisibility.addEventListener("click", () => {
    toggleInputVisibility(apiKeyInput, toggleNewKeyVisibility);
  });

  // مدیریت رویدادهای کلیک روی لیست کلیدهای API با استفاده از event delegation
  apiKeysList.addEventListener("click", async (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const index = parseInt(button.dataset.index, 10);
    const input =
      button.parentElement.previousElementSibling.querySelector("input");

    if (action === "delete") {
      deleteApiKey(index);
    } else if (action === "toggle") {
      toggleInputVisibility(input, button);
    } else if (action === "copy") {
      const success = await copyToClipboard(input.value);
      if (success) {
        provideFeedback(button);
      } else {
        showToast("کپی کردن با خطا مواجه شد.", true);
      }
    }
  });

  // مدیریت تاگل‌های تنظیمات رفتاری
  [autoTranslateToggle, autoCopyToggle].forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const key =
        toggle.id === "auto-translate-toggle"
          ? SETTINGS.AUTO_TRANSLATE
          : SETTINGS.AUTO_COPY;
      handleBehaviorToggle(key, toggle);
    });
    // افزودن پشتیبانی از کیبورد برای دسترسی‌پذیری
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle.click();
      }
    });
  });

  // باز کردن و بستن مودال راهنما
  openGuideModalButton.addEventListener("click", () => openModal(guideModal));
  closeGuideModalButton.addEventListener("click", () => closeModal(guideModal));
  guideModalBackdrop.addEventListener("click", () => closeModal(guideModal));

  // باز کردن و بستن مودال تایید حذف تاریخچه
  clearHistoryButton.addEventListener("click", () =>
    openModal(confirmClearModal)
  );
  cancelClearButton.addEventListener("click", () =>
    closeModal(confirmClearModal)
  );
  confirmModalBackdrop.addEventListener("click", () =>
    closeModal(confirmClearModal)
  );

  // تایید و اجرای عملیات پاک کردن تاریخچه
  confirmClearButton.addEventListener("click", async () => {
    try {
      await clearHistory();
      closeModal(confirmClearModal);
      showToast("تاریخچه با موفقیت پاک شد.", false);
    } catch (error) {
      console.error("Failed to clear history:", error);
      showToast("خطا در پاک کردن تاریخچه.", true);
    }
  });

  // بستن مودال‌ها با فشردن کلید Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!guideModal.classList.contains("hidden")) closeModal(guideModal);
      if (!confirmClearModal.classList.contains("hidden"))
        closeModal(confirmClearModal);
    }
  });

  // --- بارگذاری اولیه ---
  loadSettings();
});
