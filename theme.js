/**
 * @file theme.js
 * خلاصه یک‌خطی: این اسکریپت تم (روشن، تاریک یا سیستم) را در اولین فرصت ممکن اعمال می‌کند تا از "چشمک زدن" صفحه (FOUC) جلوگیری شود.
 * NOTE: Internal. این یک اسکریپت حیاتی و مسدودکننده رندر (render-blocking) است.
 * این فایل به صورت یک IIFE (Immediately Invoked Function Expression) خوداجرا و بدون وابستگی به ماژول‌ها نوشته شده است تا بتواند قبل از بارگذاری کامل DOM و سایر اسکریپت‌ها اجرا شود و تم را فوراً اعمال کند.
 * Comments updated by AI: 2025-11-11
 */

// استفاده از IIFE برای ایجاد یک اسکوپ ایزوله و اجرای فوری کد بدون آلوده کردن فضای نام عمومی (global namespace).
(function () {
  // ثابت‌های مورد نیاز برای دسترسی مستقیم به IndexedDB.
  // این مقادیر باید با مقادیر موجود در db.js هماهنگ باشند.
  const DB_NAME = "TranslatorDB";
  const DB_VERSION = 3;
  const SETTINGS_STORE = "settings";
  const THEME_KEY = "theme";

  /**
   * تم مشخص شده را با افزودن یا حذف کلاس 'dark' به عنصر ریشه (<html>) اعمال می‌کند.
   * برای حالت 'system'، از تنظیمات مرورگر و سیستم‌عامل کاربر پیروی می‌کند.
   * @param {'light' | 'dark' | 'system'} theme - نام تمی که باید اعمال شود.
   */
  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // حالت پیش‌فرض یا 'system'
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      if (mediaQuery.matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }

  /**
   * یک تابع کمکی و سبک برای خواندن مستقیم تنظیمات تم از IndexedDB.
   * این تابع به صورت مستقل و بدون وابستگی به ماژول db.js پیاده‌سازی شده تا بتواند به سرعت و بدون انتظار برای بارگذاری سایر ماژول‌ها اجرا شود.
   * @returns {Promise<string>} - یک Promise که با مقدار تم ذخیره‌شده ('light', 'dark', 'system') یا مقدار پیش‌فرض 'system' در صورت بروز خطا، resolve می‌شود.
   */
  function getThemeSetting() {
    return new Promise((resolve) => {
      // تلاش برای باز کردن اتصال به پایگاه داده.
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // در صورت بروز هرگونه خطا در اتصال، به تم پیش‌فرض 'system' برمی‌گردد.
      request.onerror = () => resolve("system");

      // این رویداد برای ایجاد یا ارتقاء ساختار پایگاه داده اجرا می‌شود.
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
        }
      };

      // در صورت موفقیت‌آمیز بودن اتصال، مقدار تنظیمات تم را می‌خواند.
      request.onsuccess = (event) => {
        const db = event.target.result;
        // اگر object store مورد نظر وجود نداشته باشد، به حالت پیش‌فرض برمی‌گردد.
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          return resolve("system");
        }
        const transaction = db.transaction(SETTINGS_STORE, "readonly");
        const store = transaction.objectStore(SETTINGS_STORE);
        const getReq = store.get(THEME_KEY);

        // در صورت موفقیت در خواندن رکورد، مقدار آن را برمی‌گرداند.
        getReq.onsuccess = () => {
          resolve(getReq.result ? getReq.result.value : "system");
        };
        // در صورت بروز خطا در خواندن، به حالت پیش‌فرض برمی‌گردد.
        getReq.onerror = () => resolve("system");
      };
    });
  }

  // فرآیند را آغاز می‌کند: ابتدا تنظیمات تم را از پایگاه داده دریافت کرده و سپس آن را اعمال می‌کند.
  getThemeSetting().then(applyTheme);
})();
