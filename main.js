/**
 * @file main.js
 * خلاصه یک‌خطی: این فایل اسکریپت اصلی صفحه مترجم (index.html) است که تمام منطق رابط کاربری، تعاملات کاربر و هماهنگی فرآیند ترجمه را مدیریت می‌کند.
 * Dependencies: ./db.js, ./api.js, ./utils.js, ./languageService.js
 * NOTE: Internal. این اسکریپت قلب تپنده بخش کاربری برنامه است.
 * Comments updated by AI: 2025-11-11
 */
import { getSetting, addHistoryItem } from "./db.js";
import { translateText } from "./api.js";
import { toPersianDigits, copyToClipboard } from "./utils.js";
import {
  getAllLanguages,
  getLangNames,
  addNewLanguage,
} from "./languageService.js";

// تمام اسکریپت پس از بارگذاری کامل محتوای DOM اجرا می‌شود تا اطمینان حاصل شود که تمام عناصر در دسترس هستند.
document.addEventListener("DOMContentLoaded", async () => {
  // --- ذخیره‌سازی ارجاع به عناصر DOM برای دسترسی سریع‌تر ---
  const sourceTextarea = document.getElementById("source-text");
  const targetTextarea = document.getElementById("target-text");
  const translateButton = document.getElementById("translate-button");
  const swapButton = document.getElementById("swap-button");
  const sourceLangButton = document.getElementById("source-lang-button");
  const targetLangButton = document.getElementById("target-lang-button");
  const loadingSpinner = document.getElementById("loading-spinner");
  const apiKeyWarning = document.getElementById("api-key-warning");
  const pasteButton = document.getElementById("paste-button");
  const copySourceButton = document.getElementById("copy-source-button");
  const clearButton = document.getElementById("clear-button");
  const copyTargetButton = document.getElementById("copy-target-button");
  const charCounter = document.getElementById("char-counter");

  // --- عناصر مربوط به مودال انتخاب زبان ---
  const langModal = document.getElementById("lang-modal");
  const langModalTitle = document.getElementById("lang-modal-title");
  const langModalOptions = document.getElementById("lang-modal-options");
  const langModalCloseButton = document.getElementById(
    "lang-modal-close-button"
  );
  const langModalBackdrop = document.getElementById("lang-modal-backdrop");

  const MAX_CHARS = 5000; // حداکثر تعداد کاراکتر مجاز برای متن ورودی
  let toastTimeout; // متغیری برای مدیریت زمان‌بندی نمایش اعلان‌ها

  /**
   * شیء وضعیت برنامه که تمام داده‌های پویا را در خود نگهداری می‌کند.
   * این کار به مدیریت متمرکز و پیش‌بینی‌پذیر حالت‌های مختلف برنامه کمک می‌کند.
   */
  let state = {
    sourceLang: "auto", // زبان مبدأ فعلی
    targetLang: "fa", // زبان مقصد فعلی
    apiKeysAvailable: false, // آیا کلید API معتبری تنظیم شده است؟
    isTranslating: false, // آیا فرآیند ترجمه در حال انجام است؟
    autoTranslateOnPaste: false, // آیا ترجمه خودکار پس از جایگذاری فعال است؟
    autoCopyResult: false, // آیا کپی خودکار نتیجه ترجمه فعال است؟
    modalContext: null, // مشخص می‌کند مودال برای زبان مبدأ ('source') یا مقصد ('target') باز شده است.
  };

  /**
   * برنامه را در هنگام بارگذاری اولیه صفحه مقداردهی می‌کند.
   * تنظیمات را از پایگاه داده بارگذاری کرده، وضعیت اولیه UI را تنظیم می‌کند و داده‌های احتمالی از صفحات دیگر را بررسی می‌کند.
   */
  async function initializeApp() {
    try {
      // بارگذاری تنظیمات کاربر از IndexedDB
      const apiKeys = await getSetting("apiKeys");
      state.apiKeysAvailable = Array.isArray(apiKeys) && apiKeys.length > 0;
      state.autoTranslateOnPaste =
        (await getSetting("autoTranslateOnPaste")) || false;
      state.autoCopyResult = (await getSetting("autoCopyResult")) || false;

      // اگر کلید API تنظیم نشده باشد، هشدار را نمایش داده و دکمه ترجمه را غیرفعال می‌کند.
      if (!state.apiKeysAvailable) {
        apiKeyWarning.classList.remove("hidden");
        translateButton.disabled = true;
      }
    } catch (error) {
      showToast("خطا در بارگذاری تنظیمات.", "error");
    }
    await getAllLanguages(); // بارگذاری اولیه زبان‌ها برای کش شدن
    checkForReuseData(); // بررسی وجود داده برای "استفاده مجدد" از صفحه تاریخچه
    updateUI(); // به‌روزرسانی رابط کاربری بر اساس وضعیت اولیه
  }

  /**
   * فرآیند اصلی ترجمه متن را مدیریت می‌کند.
   * این تابع حالت بارگذاری را فعال کرده، با API ارتباط برقرار می‌کند، نتیجه را نمایش می‌دهد و آن را در تاریخچه ذخیره می‌کند.
   */
  async function handleTranslation() {
    if (state.isTranslating || !sourceTextarea.value.trim()) return;
    toggleLoading(true);
    targetTextarea.value = "";
    targetTextarea.placeholder =
      state.sourceLang === "auto"
        ? "در حال تشخیص زبان و ترجمه..."
        : "در حال ترجمه...";

    try {
      const result = await translateText(
        sourceTextarea.value,
        state.sourceLang,
        state.targetLang
      );

      targetTextarea.value = result.translatedText;

      // اگر API زبان جدیدی را شناسایی و اطلاعات آن را برگرداند، آن را به پایگاه داده اضافه می‌کند.
      if (result.newLanguageInfo) {
        await addNewLanguage(result.newLanguageInfo);
      }

      // بررسی می‌کند که زبان شناسایی‌شده در لیست زبان‌های موجود وجود دارد یا خیر.
      const allLangs = await getAllLanguages();
      const detectedLangExists = allLangs.some(
        (l) => l.code === result.detectedSourceLanguage
      );

      // اگر زبان مبدأ به درستی شناسایی شده بود، آن را در UI به‌روز می‌کند.
      if (result.detectedSourceLanguage && detectedLangExists) {
        state.sourceLang = result.detectedSourceLanguage;
        updateUI();
      }

      // اگر تنظیم "کپی خودکار" فعال باشد، نتیجه را در کلیپ‌بورد کپی می‌کند.
      if (state.autoCopyResult && result.translatedText) {
        if (await copyToClipboard(result.translatedText)) {
          provideFeedback(copyTargetButton);
        }
      }

      // آیتم ترجمه را به تاریخچه اضافه می‌کند.
      await addHistoryItem({
        id: Date.now(),
        sourceLang: result.detectedSourceLanguage,
        targetLang: state.targetLang,
        sourceText: sourceTextarea.value,
        targetText: result.translatedText,
      });
    } catch (error) {
      showToast(`ترجمه با خطا مواجه شد: ${error.message}`, "error");
      targetTextarea.placeholder = "ترجمه با خطا مواجه شد.";
    } finally {
      toggleLoading(false);
      // اگر ترجمه ناموفق بود، placeholder را به حالت پیش‌فرض برمی‌گرداند.
      if (!targetTextarea.value) {
        targetTextarea.placeholder = "ترجمه در اینجا نمایش داده می‌شود...";
      }
    }
  }

  /**
   * زبان‌های مبدأ و مقصد و محتوای متنی آن‌ها را با یکدیگر جابجا می‌کند.
   */
  function handleSwap() {
    if (state.isTranslating) return;

    // منطق ویژه برای حالتی که زبان مبدأ "تشخیص خودکار" است.
    if (state.sourceLang === "auto") {
      state.sourceLang = state.targetLang;
      state.targetLang = "en"; // یک زبان پیش‌فرض برای مقصد جدید
    } else {
      [state.sourceLang, state.targetLang] = [
        state.targetLang,
        state.sourceLang,
      ];
    }

    [sourceTextarea.value, targetTextarea.value] = [
      targetTextarea.value,
      sourceTextarea.value,
    ];
    updateUI();
  }

  /**
   * بررسی می‌کند آیا داده‌ای در localStorage برای "استفاده مجدد" (مثلاً از صفحه تاریخچه) وجود دارد یا خیر.
   * اگر وجود داشته باشد، فرم را با آن داده‌ها پر کرده و سپس داده را پاک می‌کند.
   */
  function checkForReuseData() {
    const dataToReuse = localStorage.getItem("translationToReuse");
    if (dataToReuse) {
      try {
        const item = JSON.parse(dataToReuse);
        sourceTextarea.value = item.sourceText;
        targetTextarea.value = item.targetText;
        state.sourceLang = item.sourceLang;
        state.targetLang = item.targetLang;
      } catch (e) {
        console.error("Failed to parse reuse data", e);
      } finally {
        localStorage.removeItem("translationToReuse");
      }
    }
  }

  /**
   * مودال انتخاب زبان را باز می‌کند.
   * @param {'source' | 'target'} context مشخص می‌کند که مودال برای انتخاب زبان مبدأ باز شده یا مقصد.
   */
  async function openLanguageModal(context) {
    state.modalContext = context;
    langModalTitle.textContent =
      context === "source" ? "انتخاب زبان مبدأ" : "انتخاب زبان مقصد";
    await populateModalOptions();
    langModal.classList.remove("hidden");
  }

  /**
   * مودال انتخاب زبان را می‌بندد.
   */
  function closeLanguageModal() {
    langModal.classList.add("hidden");
    state.modalContext = null;
  }

  /**
   * دکمه‌های انتخاب زبان را به صورت پویا در مودال ایجاد و نمایش می‌دهد.
   */
  async function populateModalOptions() {
    langModalOptions.innerHTML = "";
    const languages = await getAllLanguages();
    const selectedLangCode =
      state.modalContext === "source" ? state.sourceLang : state.targetLang;

    languages.forEach((lang) => {
      // "تشخیص خودکار" نباید برای زبان مقصد نمایش داده شود.
      if (lang.code === "auto" && state.modalContext === "target") return;

      const button = document.createElement("button");
      const isSelected = lang.code === selectedLangCode;
      button.className = `w-full text-center p-3 rounded-lg font-semibold transition-colors duration-200 ${
        isSelected
          ? "bg-blue-600 text-white"
          : "bg-gray-100 dark:bg-gray-700 lg:hover:bg-gray-200 dark:lg:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
      }`;
      button.textContent = lang.name;
      button.dataset.langCode = lang.code;
      langModalOptions.appendChild(button);
    });
  }

  /**
   * انتخاب زبان توسط کاربر در مودال را پردازش می‌کند.
   * @param {string} selectedLangCode کد زبان انتخاب شده.
   */
  function handleLanguageSelection(selectedLangCode) {
    if (state.modalContext === "source") {
      // اگر کاربر زبانی را انتخاب کند که با زبان مقصد یکسان است، زبان‌ها جابجا می‌شوند.
      if (selectedLangCode === state.targetLang) handleSwap();
      else state.sourceLang = selectedLangCode;
    } else if (state.modalContext === "target") {
      if (selectedLangCode === state.sourceLang) handleSwap();
      else state.targetLang = selectedLangCode;
    }
    updateUI();
    closeLanguageModal();
  }

  /**
   * رابط کاربری را بر اساس مقادیر فعلی در شیء `state` به‌روز می‌کند.
   * مواردی مانند متن دکمه‌های زبان، جهت‌گیری (dir) نواحی متنی و شمارنده کاراکترها را تنظیم می‌کند.
   */
  async function updateUI() {
    const languages = await getAllLanguages();
    const sourceLangData = languages.find((l) => l.code === state.sourceLang);
    const targetLangData = languages.find((l) => l.code === state.targetLang);

    if (sourceLangData) sourceLangButton.textContent = sourceLangData.name;
    if (targetLangData) targetLangButton.textContent = targetLangData.name;

    // جهت متن ورودی را تنها زمانی تغییر می‌دهد که زبان "تشخیص خودکار" نباشد.
    if (sourceLangData?.code !== "auto") {
      sourceTextarea.dir = sourceLangData?.dir || "ltr";
    }
    targetTextarea.dir = targetLangData?.dir || "ltr";
    updateCharCounter();
  }

  /**
   * یک اعلان موقت (toast) در بالای صفحه نمایش می‌دهد.
   * @param {string} message پیامی که باید نمایش داده شود.
   * @param {'error' | 'success'} [type='error'] نوع اعلان که رنگ آن را تعیین می‌کند.
   */
  function showToast(message, type = "error") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    if (toastTimeout) clearTimeout(toastTimeout);
    container.innerHTML = "";

    const toast = document.createElement("div");
    const bgColor = type === "error" ? "bg-red-600" : "bg-green-600";

    toast.className = `w-full max-w-md ${bgColor} text-white font-semibold text-center p-3 rounded-xl transition-all duration-300 ease-in-out opacity-0 -translate-y-12 pointer-events-auto`;
    toast.textContent = message;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");

    container.appendChild(toast);

    // انیمیشن ورود اعلان
    requestAnimationFrame(() => {
      toast.classList.remove("opacity-0", "-translate-y-12");
      toast.classList.add("opacity-100", "translate-y-0");
    });

    // تنظیم زمان برای حذف خودکار اعلان
    toastTimeout = setTimeout(() => {
      toast.classList.remove("opacity-100", "translate-y-0");
      toast.classList.add("opacity-0", "-translate-y-12");
      toast.addEventListener("transitionend", () => toast.remove(), {
        once: true,
      });
    }, 7000);
  }

  /**
   * شمارنده تعداد کاراکترهای متن ورودی را به‌روز می‌کند.
   * در صورت عبور از حد مجاز، رنگ آن را قرمز می‌کند.
   */
  function updateCharCounter() {
    const count = sourceTextarea.value.length;
    charCounter.textContent = `${toPersianDigits(count)} / ${toPersianDigits(
      MAX_CHARS
    )}`;
    charCounter.classList.toggle("text-red-500", count > MAX_CHARS);
  }

  /**
   * وضعیت بصری بارگذاری (loading) را در رابط کاربری کنترل می‌کند.
   * @param {boolean} isLoading آیا حالت بارگذاری باید فعال شود؟
   */
  function toggleLoading(isLoading) {
    state.isTranslating = isLoading;
    translateButton.disabled = isLoading;
    loadingSpinner.classList.toggle("hidden", !isLoading);
  }

  /**
   * بازخورد بصری موقتی (مانند نمایش تیک سبز) روی یک دکمه پس از یک عمل موفقیت‌آمیز ارائه می‌دهد.
   * @param {HTMLElement} button دکمه‌ای که بازخورد روی آن اعمال می‌شود.
   */
  function provideFeedback(button) {
    const originalIconHTML = button.innerHTML;
    button.innerHTML = `<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor"><use href="/icons.svg#icon-check"></use></svg>`;
    button.disabled = true;
    setTimeout(() => {
      button.innerHTML = originalIconHTML;
      button.disabled = false;
    }, 1500);
  }

  // --- ثبت Event Listeners برای تعاملات کاربر ---

  // کلیک روی دکمه "ترجمه کن"
  translateButton.addEventListener("click", handleTranslation);

  // کلیک روی دکمه جابجایی زبان‌ها
  swapButton.addEventListener("click", handleSwap);

  // تایپ کردن در ناحیه متن مبدأ
  sourceTextarea.addEventListener("input", async () => {
    updateCharCounter();
    const langNames = await getLangNames();
    // اگر متن پاک شود، زبان مبدأ به حالت "تشخیص خودکار" برمی‌گردد.
    if (!sourceTextarea.value.trim() && langNames[state.sourceLang]) {
      state.sourceLang = "auto";
      updateUI();
    }
  });

  // باز کردن مودال انتخاب زبان مبدأ و مقصد
  sourceLangButton.addEventListener("click", () => openLanguageModal("source"));
  targetLangButton.addEventListener("click", () => openLanguageModal("target"));

  // بستن مودال با کلیک روی دکمه بستن یا پس‌زمینه
  langModalCloseButton.addEventListener("click", closeLanguageModal);
  langModalBackdrop.addEventListener("click", closeLanguageModal);

  // انتخاب زبان از داخل مودال (استفاده از event delegation)
  langModalOptions.addEventListener("click", (e) => {
    const selectedButton = e.target.closest("button[data-lang-code]");
    if (selectedButton)
      handleLanguageSelection(selectedButton.dataset.langCode);
  });

  // بستن مودال با فشردن کلید Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !langModal.classList.contains("hidden")) {
      closeLanguageModal();
    }
  });

  // پاک کردن محتوای متنی
  clearButton.addEventListener("click", () => {
    sourceTextarea.value = "";
    targetTextarea.value = "";
    state.sourceLang = "auto";
    updateUI();
  });

  // جایگذاری متن از کلیپ‌بورد و ترجمه خودکار در صورت فعال بودن
  pasteButton.addEventListener("click", async () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      showToast(
        "مرورگر شما اجازه دسترسی به کلیپ‌بورد را نمی‌دهد. لطفاً متن را به صورت دستی جایگذاری کنید.",
        "error"
      );
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      sourceTextarea.value = text;
      updateCharCounter();
      if (state.autoTranslateOnPaste && text && state.apiKeysAvailable)
        handleTranslation();
    } catch (err) {
      showToast(
        "دسترسی به کلیپ‌بورد ممکن نیست. لطفاً متن را به صورت دستی جایگذاری کنید.",
        "error"
      );
    }
  });

  // کپی کردن متن مبدأ
  copySourceButton.addEventListener("click", async () => {
    if (sourceTextarea.value) {
      if (await copyToClipboard(sourceTextarea.value))
        provideFeedback(copySourceButton);
      else showToast("کپی کردن با خطا مواجه شد.", "error");
    }
  });

  // کپی کردن متن مقصد
  copyTargetButton.addEventListener("click", async () => {
    if (targetTextarea.value) {
      if (await copyToClipboard(targetTextarea.value))
        provideFeedback(copyTargetButton);
      else showToast("کپی کردن با خطا مواجه شد.", "error");
    }
  });

  // شروع برنامه
  initializeApp();
});
