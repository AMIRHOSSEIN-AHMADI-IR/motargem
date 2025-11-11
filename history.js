/**
 * @file history.js
 * خلاصه یک‌خطی: این ماژول منطق صفحه تاریخچه را مدیریت می‌کند، شامل رندر کردن، جستجو و تعامل با آیتم‌های تاریخچه.
 * Dependencies: ./db.js, ./utils.js, ./languageService.js
 * NOTE: Internal. این اسکریپت به طور انحصاری برای history.html استفاده می‌شود.
 * Comments updated by AI: 2025-11-10
 */
import { getHistory, deleteHistoryItem } from "./db.js";
import { formatTimestamp, copyToClipboard, highlightText } from "./utils.js";
import { getAllLanguages, getLangNames } from "./languageService.js";

// اجرای اسکریپت پس از بارگذاری کامل محتوای DOM.
document.addEventListener("DOMContentLoaded", async () => {
  const historyContainer = document.getElementById("history-container");
  const historyEmptyState = document.getElementById("history-empty-state");
  const searchInput = document.getElementById("search-input");

  /**
   * به کاربر بازخورد بصری می‌دهد (مثلاً پس از یک عملیات موفق کپی).
   * آیکون دکمه را به طور موقت به یک تیک سبز تغییر می‌دهد.
   * @param {HTMLElement} button - دکمه‌ای که بازخورد روی آن نمایش داده می‌شود.
   */
  function provideFeedback(button) {
    const originalIconHref = button.querySelector("use").getAttribute("href");
    button.disabled = true;
    button.querySelector("use").setAttribute("href", "/icons.svg#icon-check");
    button.classList.replace("text-gray-400", "text-green-500");
    button.classList.replace("dark:text-gray-400", "dark:text-green-500");

    // پس از 1.5 ثانیه، دکمه را به حالت اولیه بازمی‌گرداند.
    setTimeout(() => {
      button.querySelector("use").setAttribute("href", originalIconHref);
      button.classList.replace("text-green-500", "text-gray-400");
      button.classList.replace("dark:text-green-500", "dark:text-gray-400");
      button.disabled = false;
    }, 1500);
  }

  /**
   * یک عنصر HTML برای یک آیتم تاریخچه ایجاد می‌کند.
   * @param {object} item - شیء آیتم تاریخچه از پایگاه داده.
   * @param {object} langNames - یک map از کدهای زبان به نام‌های فارسی آن‌ها.
   * @param {string[]} rtlLangs - آرایه‌ای از کدهای زبان‌های راست‌به‌چپ (RTL).
   * @param {string} searchTerm - عبارت جستجو شده برای هایلایت کردن در متن.
   * @returns {HTMLDivElement} - عنصر div ساخته‌شده برای آیتم تاریخچه.
   */
  function createHistoryItemElement(item, langNames, rtlLangs, searchTerm) {
    const div = document.createElement("div");
    div.className = "bg-white dark:bg-gray-800 rounded-2xl p-4 flex flex-col";
    div.dataset.id = item.id;
    div.dataset.item = JSON.stringify(item); // ذخیره داده کامل آیتم برای دسترسی آسان‌تر در event handler.

    // تعیین نام زبان و جهت متن برای زبان‌های مبدأ و مقصد.
    const sourceLangName =
      langNames[item.sourceLang] || item.sourceLang.toUpperCase();
    const targetLangName =
      langNames[item.targetLang] || item.targetLang.toUpperCase();
    const sourceDir = rtlLangs.includes(item.sourceLang) ? "rtl" : "ltr";
    const targetDir = rtlLangs.includes(item.targetLang) ? "rtl" : "ltr";

    // هایلایت کردن عبارت جستجو در متن مبدأ و مقصد.
    const highlightedSource = highlightText(item.sourceText, searchTerm);
    const highlightedTarget = highlightText(item.targetText, searchTerm);

    div.innerHTML = `
      <!-- هدر کارت: شامل تاریخ و دکمه حذف -->
      <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
        <span class="font-normal">${formatTimestamp(item.id)}</span>
        <button data-action="delete" aria-label="حذف این مورد" class="p-2 text-gray-400 dark:text-gray-400 lg:hover:text-red-500 dark:lg:hover:text-red-400 rounded-lg transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor"><use href="/icons.svg#icon-delete"></use></svg>
        </button>
      </div>

      <!-- بخش متن مبدأ -->
      <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex flex-col space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">${sourceLangName}</h3>
          <button data-action="copy-source" aria-label="کپی متن مبدأ" class="p-2 text-gray-400 dark:text-gray-400 lg:hover:text-blue-600 dark:lg:hover:text-blue-400 rounded-lg transition-colors">
            <svg class="w-6 h-6"><use href="/icons.svg#icon-copy"></use></svg>
          </button>
        </div>
        <p class="text-gray-800 dark:text-gray-200 text-justify leading-relaxed" dir="${sourceDir}">${highlightedSource}</p>
      </div>

      <!-- جداکننده فلش -->
      <div class="flex justify-center my-2">
        <svg class="w-6 h-6 text-gray-400 dark:text-gray-500">
            <use href="/icons.svg#icon-arrow-down"></use>
        </svg>
      </div>

      <!-- بخش متن مقصد (ترجمه‌شده) -->
      <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 flex flex-col space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-blue-700 dark:text-blue-400">${targetLangName}</h3>
          <button data-action="copy-target" aria-label="کپی متن ترجمه" class="p-2 text-gray-400 dark:text-gray-400 lg:hover:text-blue-600 dark:lg:hover:text-blue-400 rounded-lg transition-colors">
            <svg class="w-6 h-6"><use href="/icons.svg#icon-copy"></use></svg>
          </button>
        </div>
        <p class="text-blue-800 dark:text-blue-300 text-justify leading-relaxed" dir="${targetDir}">${highlightedTarget}</p>
      </div>
    `;
    return div;
  }

  /**
   * تاریخچه ترجمه‌ها را از پایگاه داده واکشی کرده، بر اساس عبارت جستجو فیلتر می‌کند و در صفحه نمایش می‌دهد.
   * همچنین وضعیت "خالی" را در صورت عدم وجود نتیجه مدیریت می‌کند.
   * @param {string} [searchTerm=""] - عبارتی که برای فیلتر کردن تاریخچه استفاده می‌شود.
   */
  async function renderHistory(searchTerm = "") {
    const items = await getHistory();
    const langNames = await getLangNames();
    const allLangs = await getAllLanguages();
    const rtlLangs = allLangs
      .filter((lang) => lang.dir === "rtl")
      .map((lang) => lang.code);

    const trimmedSearchTerm = searchTerm.trim();
    const lowercasedTerm = trimmedSearchTerm.toLowerCase();

    // فیلتر کردن آیتم‌ها بر اساس عبارت جستجو (اگر وجود داشته باشد).
    const filteredItems = lowercasedTerm
      ? items.filter(
          (item) =>
            item.sourceText.toLowerCase().includes(lowercasedTerm) ||
            item.targetText.toLowerCase().includes(lowercasedTerm)
        )
      : items;

    historyContainer.innerHTML = "";
    if (filteredItems.length === 0) {
      historyEmptyState.classList.remove("hidden");
      historyEmptyState.textContent = lowercasedTerm
        ? "موردی مطابق با جستجوی شما یافت نشد."
        : "تاریخچه‌ای برای نمایش وجود ندارد.";
    } else {
      historyEmptyState.classList.add("hidden");
      filteredItems.forEach((item) => {
        historyContainer.appendChild(
          createHistoryItemElement(item, langNames, rtlLangs, trimmedSearchTerm)
        );
      });
    }
  }

  /**
   * رویدادهای کلیک روی دکمه‌های عملیاتی (حذف، کپی) در کارت‌های تاریخچه را مدیریت می‌کند.
   * از الگوی event delegation برای بهبود کارایی استفاده می‌کند.
   * @param {Event} e - شیء رویداد کلیک.
   */
  async function handleHistoryAction(e) {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const itemElement = button.closest("[data-id]");
    if (!itemElement) return;

    const id = parseInt(itemElement.dataset.id, 10);
    const itemData = JSON.parse(itemElement.dataset.item);

    switch (action) {
      case "delete":
        await deleteHistoryItem(id);
        itemElement.remove();
        // اگر پس از حذف، هیچ آیتمی باقی نماند، لیست را دوباره رندر کن تا پیام مناسب نمایش داده شود.
        if (historyContainer.childElementCount === 0) {
          renderHistory(searchInput.value);
        }
        break;

      case "copy-source":
        if (itemData.sourceText) {
          if (await copyToClipboard(itemData.sourceText)) {
            provideFeedback(button);
          }
        }
        break;

      case "copy-target":
        if (itemData.targetText) {
          if (await copyToClipboard(itemData.targetText)) {
            provideFeedback(button);
          }
        }
        break;
    }
  }

  // ثبت event listener ها و اجرای اولیه رندر.
  searchInput.addEventListener("input", () => renderHistory(searchInput.value));
  historyContainer.addEventListener("click", handleHistoryAction);
  await renderHistory(); // رندر اولیه تاریخچه هنگام بارگذاری صفحه.
});
