/**
 * @file languages.js
 * خلاصه یک‌خطی: تعریف لیست زبان‌های پیش‌فرض و تولید ساختارهای داده کمکی برای مدیریت زبان‌ها.
 * NOTE: Internal. این فایل منبع اصلی (Single Source of Truth) برای زبان‌های اولیه است.
 * Comments updated by AI: 2025-11-11
 */

/**
 * لیست ثابت زبان‌های پیش‌فرض پشتیبانی‌شده در برنامه.
 * برای افزودن زبان‌های جدید به هسته برنامه، تنها کافیست شیء جدیدی به این آرایه اضافه کنید.
 * @type {Array<{code: string, name: string, englishName: string, dir: "ltr"|"rtl"}>}
 */
export const LANGUAGES = [
  {
    code: "auto",
    name: "تشخیص خودکار",
    englishName: "Auto-Detect",
    dir: "ltr",
  },
  { code: "fa", name: "فارسی", englishName: "Persian (Farsi)", dir: "rtl" },
  { code: "en", name: "انگلیسی", englishName: "English", dir: "ltr" },
  { code: "ar", name: "عربی", englishName: "Arabic", dir: "rtl" },
  { code: "de", name: "آلمانی", englishName: "German", dir: "ltr" },
  { code: "fr", name: "فرانسوی", englishName: "French", dir: "ltr" },
  { code: "es", name: "اسپانیایی", englishName: "Spanish", dir: "ltr" },
  { code: "ru", name: "روسی", englishName: "Russian", dir: "ltr" },
  { code: "zh", name: "چینی", englishName: "Chinese", dir: "ltr" },
  { code: "ja", name: "ژاپنی", englishName: "Japanese", dir: "ltr" },
];

// متغیرهای زیر (Derived State) به صورت خودکار محاسبه می‌شوند تا از تکرار کد جلوگیری شود.

/**
 * نگاشت کد زبان به نام فارسی آن (جهت نمایش در رابط کاربری).
 * @type {Object.<string, string>}
 * @example { fa: 'فارسی', en: 'انگلیسی', ... }
 */
export const langNames = LANGUAGES.reduce((acc, lang) => {
  acc[lang.code] = lang.name;
  return acc;
}, {});

/**
 * نگاشت کد زبان به نام انگلیسی آن (جهت استفاده در پرامپت‌های API).
 * @type {Object.<string, string>}
 * @example { fa: 'Persian (Farsi)', en: 'English', ... }
 */
export const langMap = LANGUAGES.reduce((acc, lang) => {
  acc[lang.code] = lang.englishName;
  return acc;
}, {});

/**
 * آرایه‌ای شامل کد زبان‌هایی که جهت نوشتاری آن‌ها راست‌به‌چپ (RTL) است.
 * @type {string[]}
 * @example ['fa', 'ar']
 */
export const rtlLangs = LANGUAGES.filter((lang) => lang.dir === "rtl").map(
  (lang) => lang.code
);
