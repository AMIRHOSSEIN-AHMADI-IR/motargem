/**
 * @file api.js
 * خلاصه یک‌خطی: این ماژول مسئول تمام تعاملات با API ترجمه گوگل (Gemini) است.
 * Dependencies: ./db.js, ./languageService.js, ./httpErrors.js
 * NOTE: Internal. این ماژول منطق اصلی ساخت پرامپت و پردازش پاسخ‌های API را در بر می‌گیرد.
 * Comments updated by AI: 2025-11-10
 */
import { getNextApiKey } from "./db.js";
import { getAllLanguages } from "./languageService.js";
import { getErrorMessage } from "./httpErrors.js";

// نقطه پایانی (endpoint) برای مدل Gemini 2.5 Pro جهت تولید محتوا.
const API_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

/**
 * یک پرامپت جامع برای مدل زبان بزرگ (LLM) بر اساس ورودی کاربر و زبان‌ها می‌سازد.
 * این پرامپت به مدل دستور می‌دهد که ترجمه‌ای با حفظ لحن انجام دهد و خروجی را در فرمت JSON مشخصی برگرداند.
 * @param {string} text - متنی که باید ترجمه شود.
 * @param {string} sourceLangCode - کد زبان مبدأ (ISO 639-1) یا 'auto' برای تشخیص خودکار.
 * @param {string} targetLangCode - کد زبان مقصد (ISO 639-1).
 * @returns {Promise<string>} - یک رشته پرامپت فرمت‌شده که به عنوان ورودی برای مدل زبان استفاده می‌شود.
 */
async function buildUnifiedPrompt(text, sourceLangCode, targetLangCode) {
  const allLangs = await getAllLanguages();
  const targetLanguage = allLangs.find(
    (l) => l.code === targetLangCode
  )?.englishName;
  const knownLanguages = allLangs
    .map((l) => `"${l.code}": "${l.englishName}"`)
    .join(", ");

  // بر اساس اینکه زبان مبدأ مشخص شده یا باید خودکار تشخیص داده شود، دستورالعمل متفاوتی ایجاد می‌شود.
  const sourceLanguageInstruction =
    sourceLangCode === "auto"
      ? `First, detect the source language of the text. The list of languages I already know is: {${knownLanguages}}.`
      : `The source language is explicitly provided as ${
          allLangs.find((l) => l.code === sourceLangCode)?.englishName
        }.`;

  return `
You are an expert linguist and a master translator. Your task is to perform a tone-aware translation and return the result in a specific JSON format.

**Instructions:**
1.  **Analyze the Source Text**: The user has provided the following text: "${text}"
2.  **Determine Source Language**: ${sourceLanguageInstruction}
3.  **Perform Translation**: Translate the text into ${targetLanguage}, meticulously preserving the original tone.
4.  **Format the Output**: Your response MUST be a single, valid JSON object with the following keys:
    - \`"detectedSourceLanguage"\`: A string containing the two-letter ISO 639-1 code of the language you identified.
    - \`"translatedText"\`: A string containing your final, polished translation.

5.  **Conditional Step - Add Language Info**:
    - **IF AND ONLY IF** the detected language code is NOT in the list of known languages I provided, you MUST add a third key to the JSON object called \`"newLanguageInfo"\`.
    - This \`"newLanguageInfo"\` must be an object with exactly these four string keys: \`"code"\`, \`"name"\`, \`"englishName"\`, and \`"dir"\` (which must be either "ltr" or "rtl"). The "name" should be the Persian name of the language.

**Example for a Known Language (e.g., 'fr'):**
{
  "detectedSourceLanguage": "fr",
  "translatedText": "سلام دنیا"
}

**Example for a New Language (e.g., 'it' for Italian):**
{
  "detectedSourceLanguage": "it",
  "translatedText": "سلام دنیا",
  "newLanguageInfo": {
    "code": "it",
    "name": "ایتالیایی",
    "englishName": "Italian",
    "dir": "ltr"
  }
}
`;
}

/**
 * متن ورودی را با استفاده از Gemini API از زبان مبدأ به زبان مقصد ترجمه می‌کند.
 * @param {string} text - متنی که باید ترجمه شود.
 * @param {string} sourceLang - کد زبان مبدأ (ISO 639-1) یا 'auto'.
 * @param {string} targetLang - کد زبان مقصد (ISO 639-1).
 * @returns {Promise<Object>} - یک شیء شامل متن ترجمه‌شده و زبان مبدأ شناسایی‌شده.
 * @throws {Error} - در صورت عدم وجود کلید API، خطاهای شبکه یا پاسخ‌های نامعتبر از API، خطا پرتاب می‌کند.
 */
async function translateText(text, sourceLang, targetLang) {
  // کلید API بعدی را از پایگاه داده دریافت می‌کند.
  const apiKey = await getNextApiKey();
  if (!apiKey)
    throw new Error(
      "هیچ کلید API تنظیم نشده است. لطفاً به صفحه تنظیمات بروید."
    );

  // اگر متن ورودی خالی یا فقط حاوی فضای خالی باشد، بدون فراخوانی API نتیجه خالی برمی‌گرداند.
  if (!text.trim())
    return { detectedSourceLanguage: sourceLang, translatedText: "" };

  const prompt = await buildUnifiedPrompt(text, sourceLang, targetLang);

  // درخواست به API Gemini ارسال می‌شود.
  const response = await fetch(`${API_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  // مدیریت خطاهای احتمالی در پاسخ API.
  if (!response.ok) {
    const statusCode = response.status;
    const userFriendlyMessage = getErrorMessage(statusCode);
    let apiSpecificMessage =
      "No specific details could be read from the API response.";

    try {
      // تلاش برای خواندن جزئیات بیشتر خطا از بدنه پاسخ API.
      const errorData = await response.json();
      apiSpecificMessage = errorData.error?.message || apiSpecificMessage;
    } catch (e) {
      // ممکن است بدنه پاسخ JSON معتبر نباشد که اشکالی ندارد.
      // پیام خطای API همان مقدار پیش‌فرض باقی می‌ماند.
    }

    console.error(
      `API Error: Status ${statusCode} | Details: ${apiSpecificMessage}`
    );

    // پرتاب خطا با پیام کاربرپسند که در رابط کاربری نمایش داده خواهد شد.
    throw new Error(userFriendlyMessage);
  }

  const data = await response.json();
  // استخراج رشته JSON از ساختار پیچیده پاسخ API.
  const jsonString = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!jsonString) {
    console.error("Invalid response structure from API:", data);
    throw new Error(
      "پاسخ معتبری از API دریافت نشد. ساختار پاسخ تغییر کرده است."
    );
  }

  try {
    // حذف بک‌تیک‌های Markdown از ابتدا و انتهای رشته قبل از پارس کردن.
    const cleanedJsonString = jsonString.replace(/^```json\s*|```$/g, "");
    return JSON.parse(cleanedJsonString);
  } catch (e) {
    console.error("Failed to parse JSON response:", jsonString);
    throw new Error("پاسخ API در فرمت مورد انتظار (JSON) نبود.");
  }
}

export { translateText };
