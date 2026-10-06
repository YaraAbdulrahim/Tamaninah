/** Practical / out-of-scope prompts — do not force Islamic topic discovery. */
const OUT_OF_SCOPE =
  /(?:سيارت|سيارة|car|engine|motor|repair|fix my|صلح|تصليح|ميكانيك|laptop|computer|programming code)/i;

const ISLAMIC_OR_EXPERiential =
  /(?:الله|رب|صلاة|قرآن|حديث|إسلام|islam|god|prayer|quran|hadith|work|job|وظيف|فرح|خوف|حزن|grief|hope|patience|anxiety|مسؤول|responsib|نعمة|فشل|قرار)/i;

export function isOutOfProductScope(message: string): boolean {
  const text = message.trim();
  if (text.length < 8) return false;
  if (!OUT_OF_SCOPE.test(text)) return false;
  return !ISLAMIC_OR_EXPERiential.test(text);
}
