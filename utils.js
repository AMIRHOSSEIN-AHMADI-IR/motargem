/**
 * @file utils.js
 * خلاصه یک‌خطی: این ماژول مجموعه‌ای از توابع کمکی عمومی را ارائه می‌دهد که در بخش‌های مختلف برنامه استفاده می‌شوند.
 * NOTE: Internal. شامل توابعی برای قالب‌بندی، تعامل با کلیپ‌بورد و دستکاری رشته‌ها است.
 * Comments updated by AI: 2025-11-11
 */

/**
 * اعداد انگلیسی (0-9) را در یک رشته به معادل فارسی آن‌ها (۰-۹) تبدیل می‌کند.
 * @param {string|number} n - رشته یا عددی که باید تبدیل شود.
 * @returns {string} - رشته‌ای با ارقام فارسی.
 */
function toPersianDigits(n) {
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/[0-9]/g, (w) => persianDigits[+w]);
}

/**
 * یک مُهر زمانی (timestamp) عددی را به یک رشته تاریخ و زمان خوانا به فرمت فارسی تبدیل می‌کند.
 * @param {number} timestamp - مُهر زمانی (Unix timestamp) در میلی‌ثانیه.
 * @returns {string} - رشته تاریخ فرمت‌شده (مثال: '۱۸ آبان ۱۴۰۴،‏ ۱۷:۳۰').
 */
function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * متن داده‌شده را در کلیپ‌بورد کاربر کپی می‌کند.
 * ابتدا از API مدرن و امن `navigator.clipboard` استفاده می‌کند. در صورت عدم پشتیبانی یا بروز خطا،
 * به روش قدیمی `document.execCommand` به عنوان جایگزین (fallback) عمل می‌کند.
 * @param {string} text - متنی که باید کپی شود.
 * @returns {Promise<boolean>} - یک Promise که در صورت موفقیت به `true` و در صورت شکست به `false` resolve می‌شود.
 */
async function copyToClipboard(text) {
  // روش مدرن
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("Modern copy failed, trying fallback.", err);
    }
  }
  // روش جایگزین (Fallback) برای مرورگرهای قدیمی
  const textArea = document.createElement("textarea");
  textArea.value = text;
  // اطمینان از اینکه عنصر خارج از دید کاربر است
  textArea.style.position = "fixed";
  textArea.style.top = "-9999px";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand("copy");
    return successful;
  } catch (err) {
    console.error("Fallback copy failed", err);
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

/**
 * کاراکترهای ویژه را در یک رشته برای استفاده در یک عبارت منظم (Regular Expression) escape می‌کند.
 * @param {string} str - رشته‌ای که باید escape شود.
 * @returns {string} - رشته escape شده.
 */
function escapeRegExp(str) {
  // $& به معنای کل رشته‌ای است که مطابقت داشته است.
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * رخدادهای یک عبارت جستجو را در یک متن هایلایت می‌کند.
 * این تابع به حروف بزرگ و کوچک حساس نیست و کاراکترهای ویژه را مدیریت می‌کند.
 * @param {string} text - متنی که باید در آن جستجو و هایلایت انجام شود.
 * @param {string} searchTerm - عبارتی که باید هایلایت شود.
 * @returns {string} - یک رشته HTML با عبارت جستجو شده که درون تگ `<span>` هایلایت شده است.
 */
function highlightText(text, searchTerm) {
  if (!searchTerm || !text) {
    return text;
  }
  // یک عبارت منظم سراسری (g) و غیرحساس به حروف (i) ایجاد می‌کند.
  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, "gi");
  // عبارات یافت‌شده را با یک تگ span استایل‌دار جایگزین می‌کند.
  // $1 به اولین گروه capture شده (خود عبارت جستجو) اشاره دارد تا حروف اصلی حفظ شوند.
  return text.replace(
    regex,
    `<span class="bg-yellow-200 dark:bg-yellow-700/60 text-gray-900 dark:text-yellow-100 rounded-sm px-0.5">$1</span>`
  );
}

export { toPersianDigits, formatTimestamp, copyToClipboard, highlightText };
