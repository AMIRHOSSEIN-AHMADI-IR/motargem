/**
 * @file db.js
 * خلاصه یک‌خطی: این ماژول تمام تعاملات با پایگاه داده IndexedDB مرورگر را مدیریت می‌کند.
 * NOTE: Internal. این فایل شامل توابعی برای ذخیره و بازیابی تنظیمات، تاریخچه ترجمه و زبان‌های سفارشی است.
 * Comments updated by AI: 2025-11-10
 */

// ثابت‌های مربوط به پیکربندی IndexedDB.
const DB_NAME = "TranslatorDB";
const DB_VERSION = 3;
const SETTINGS_STORE = "settings";
const HISTORY_STORE = "history";
const LANGUAGES_STORE = "languages";

// یک نمونه (instance) از اتصال به پایگاه داده برای جلوگیری از باز شدن مکرر.
let db;

/**
 * اتصال به پایگاه داده IndexedDB را باز کرده و آن را مقداردهی اولیه می‌کند.
 * در صورت نیاز (مثلاً در اولین اجرا یا ارتقاء نسخه)، Object Store ها را ایجاد می‌کند.
 * این تابع از الگوی Singleton استفاده می‌کند تا از یک اتصال واحد در کل برنامه استفاده شود.
 * @returns {Promise<IDBDatabase>} یک Promise که در صورت موفقیت، به شیء اتصال پایگاه داده resolve می‌شود.
 * @throws {string} در صورت بروز خطا در هنگام باز کردن پایگاه داده، reject می‌شود.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    // اگر اتصال قبلاً برقرار شده باشد، همان را برمی‌گرداند.
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("Database error:", event.target.errorCode);
      reject("Database error");
    };

    // این رویداد تنها زمانی اجرا می‌شود که نسخه پایگاه داده جدیدتر باشد یا پایگاه داده وجود نداشته باشد.
    request.onupgradeneeded = (event) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(SETTINGS_STORE)) {
        dbInstance.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
      if (!dbInstance.objectStoreNames.contains(HISTORY_STORE)) {
        dbInstance.createObjectStore(HISTORY_STORE, { keyPath: "id" });
      }
      if (!dbInstance.objectStoreNames.contains(LANGUAGES_STORE)) {
        dbInstance.createObjectStore(LANGUAGES_STORE, { keyPath: "code" });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
  });
}

// --- توابع مربوط به تنظیمات (Settings) ---

/**
 * یک جفت کلید-مقدار را در انبار (store) تنظیمات ذخیره یا به‌روزرسانی می‌کند.
 * @param {string} key - کلید منحصربه‌فرد برای تنظیمات.
 * @param {*} value - مقداری که باید ذخیره شود.
 * @returns {Promise<void>}
 */
async function saveSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SETTINGS_STORE], "readwrite");
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.put({ key, value });
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * مقداری را بر اساس کلید آن از انبار تنظیمات بازیابی می‌کند.
 * @param {string} key - کلید تنظیماتی که باید بازیابی شود.
 * @returns {Promise<*|null>} مقدار ذخیره‌شده یا null در صورتی که کلید یافت نشود.
 */
async function getSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SETTINGS_STORE], "readonly");
    const store = transaction.objectStore(SETTINGS_STORE);
    const request = store.get(key);
    request.onsuccess = () =>
      resolve(request.result ? request.result.value : null);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * کلید API بعدی را از لیست کلیدهای ذخیره‌شده به صورت چرخشی (round-robin) برمی‌گرداند.
 * این کار برای توزیع بار بین کلیدهای مختلف API مفید است.
 * @returns {Promise<string|null>} کلید API بعدی یا null در صورتی که هیچ کلیدی ذخیره نشده باشد.
 */
async function getNextApiKey() {
  const keys = (await getSetting("apiKeys")) || [];
  if (keys.length === 0) return null;
  let lastIndex = (await getSetting("lastKeyIndex")) ?? -1;
  const nextIndex = (lastIndex + 1) % keys.length;
  await saveSetting("lastKeyIndex", nextIndex);
  return keys[nextIndex];
}

// --- توابع مربوط به تاریخچه (History) ---

/**
 * یک آیتم جدید (رکورد ترجمه) را به انبار تاریخچه اضافه می‌کند.
 * @param {object} item - شیء تاریخچه که باید ذخیره شود. باید شامل کلید `id` باشد.
 * @returns {Promise<void>}
 */
async function addHistoryItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], "readwrite");
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * تمام آیتم‌های تاریخچه را بازیابی کرده و آن‌ها را بر اساس جدیدترین مرتب می‌کند.
 * @returns {Promise<Array<object>>} آرایه‌ای از تمام آیتم‌های تاریخچه.
 */
async function getHistory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], "readonly");
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.getAll();
    request.onsuccess = () =>
      resolve(request.result.sort((a, b) => b.id - a.id));
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * یک آیتم خاص را از تاریخچه بر اساس شناسه (ID) آن حذف می‌کند.
 * @param {number} id - شناسه آیتمی که باید حذف شود.
 * @returns {Promise<void>}
 */
async function deleteHistoryItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], "readwrite");
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * تمام آیتم‌ها را از انبار تاریخچه پاک می‌کند.
 * @returns {Promise<void>}
 */
async function clearHistory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([HISTORY_STORE], "readwrite");
    const store = transaction.objectStore(HISTORY_STORE);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

// --- توابع مربوط به زبان‌ها (Languages) ---

/**
 * یک شیء زبان سفارشی (که توسط API شناسایی شده) را در انبار زبان‌ها ذخیره می‌کند.
 * @param {object} langObject - شیء زبان که باید ذخیره شود. باید شامل کلید `code` باشد.
 * @returns {Promise<void>}
 */
async function saveLanguage(langObject) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LANGUAGES_STORE], "readwrite");
    const store = transaction.objectStore(LANGUAGES_STORE);
    const request = store.put(langObject);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * تمام زبان‌های سفارشی ذخیره‌شده در پایگاه داده را بازیابی می‌کند.
 * @returns {Promise<Array<object>>} آرایه‌ای از اشیاء زبان‌های سفارشی.
 */
async function getCustomLanguages() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([LANGUAGES_STORE], "readonly");
    const store = transaction.objectStore(LANGUAGES_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event) => reject(event.target.error);
  });
}

export {
  saveSetting,
  getSetting,
  getNextApiKey,
  addHistoryItem,
  getHistory,
  deleteHistoryItem,
  clearHistory,
  saveLanguage,
  getCustomLanguages,
};