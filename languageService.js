/**
 * @file languageService.js
 * خلاصه یک‌خطی: این ماژول یک رابط یکپارچه برای دسترسی به زبان‌های پیش‌فرض و زبان‌های سفارشی (ذخیره‌شده در پایگاه داده) فراهم می‌کند.
 * Dependencies: ./languages.js, ./db.js
 * NOTE: Internal. این سرویس به عنوان یک Singleton عمل می‌کند و لیست زبان‌ها را در حافظه کش می‌کند تا از فراخوانی‌های مکرر پایگاه داده جلوگیری شود.
 * Comments updated by AI: 2025-11-11
 */
import { LANGUAGES as BASE_LANGUAGES } from "./languages.js";
import { getCustomLanguages, saveLanguage } from "./db.js";

/**
 * کش در حافظه (in-memory cache) برای لیست ادغام‌شده زبان‌ها (پیش‌فرض + سفارشی).
 * @type {Array<object>}
 */
let mergedLanguages = [];
/**
 * کش در حافظه برای نگاشت کد زبان به نام فارسی آن.
 * @type {Object.<string, string>}
 */
let langNamesMap = {};

/**
 * زبان‌های پایه را با زبان‌های سفارشی ذخیره‌شده در IndexedDB ادغام می‌کند.
 * این تابع کش‌های `mergedLanguages` و `langNamesMap` را به‌روزرسانی می‌کند.
 * از یک Map برای اطمینان از عدم وجود کدهای تکراری و اولویت دادن به زبان‌های سفارشی استفاده می‌شود.
 * @private
 * @returns {Promise<void>}
 */
async function loadLanguages() {
  const customLanguages = await getCustomLanguages();
  const languagesMap = new Map();

  // ابتدا زبان‌های پایه به نقشه اضافه می‌شوند.
  BASE_LANGUAGES.forEach((lang) => languagesMap.set(lang.code, lang));
  // سپس زبان‌های سفارشی اضافه می‌شوند که در صورت وجود کد مشابه، جایگزین زبان پایه می‌شوند.
  customLanguages.forEach((lang) => languagesMap.set(lang.code, lang));

  mergedLanguages = Array.from(languagesMap.values());

  // نقشه کمکی نام زبان‌ها مجدداً ساخته می‌شود.
  langNamesMap = mergedLanguages.reduce((acc, lang) => {
    acc[lang.code] = lang.name;
    return acc;
  }, {});
}

/**
 * لیست کامل تمام زبان‌های موجود را برمی‌گرداند.
 * در صورت خالی بودن کش، ابتدا زبان‌ها را بارگذاری می‌کند.
 * @public
 * @returns {Promise<Array<object>>} - آرایه‌ای از تمام اشیاء زبان‌های موجود.
 */
export async function getAllLanguages() {
  if (mergedLanguages.length === 0) {
    await loadLanguages();
  }
  return mergedLanguages;
}

/**
 * نگاشت کد زبان به نام فارسی آن را برمی‌گرداند.
 * در صورت خالی بودن کش، ابتدا زبان‌ها را بارگذاری می‌کند.
 * @public
 * @returns {Promise<Object.<string, string>>} - یک شیء که کد زبان را به نام آن نگاشت می‌کند.
 */
export async function getLangNames() {
  if (Object.keys(langNamesMap).length === 0) {
    await loadLanguages();
  }
  return langNamesMap;
}

/**
 * یک زبان جدید (سفارشی) را به پایگاه داده اضافه کرده و کش زبان‌ها را پاک می‌کند تا در فراخوانی بعدی مجدداً بارگذاری شوند.
 * @public
 * @param {object} langObject - شیء زبانی که باید اضافه شود. باید شامل کلیدهای `code` و `name` باشد.
 * @returns {Promise<void>}
 */
export async function addNewLanguage(langObject) {
  // اعتبارسنجی اولیه برای شیء زبان ورودی.
  if (!langObject || !langObject.code || !langObject.name) {
    console.error("Invalid language object provided to addNewLanguage.");
    return;
  }
  await saveLanguage(langObject);
  // کش‌ها را خالی می‌کند تا در دسترسی بعدی، لیست جدید از پایگاه داده خوانده شود.
  mergedLanguages = [];
  langNamesMap = {};
}

// بارگذاری اولیه زبان‌ها هنگام ایمپورت شدن ماژول برای آماده‌سازی کش.
loadLanguages();
