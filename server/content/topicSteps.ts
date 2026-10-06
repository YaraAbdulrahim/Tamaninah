import type { ActionType, Lang, SuggestedAction } from "../../shared/experience/guidance";

/**
 * «خطوتك الآن» — one practical step per topic, taken from the product copy in
 * docs/EXPERIENCE.md §06 (Arabic as written there; English is a faithful translation).
 * Title = the screen's call-to-action label, description = its guidance line.
 * Product guidance only: no rulings, verses or hadith.
 */
const STEPS: Record<Exclude<ActionType, "prayer">, Record<Lang, { title: string; description: string }>> = {
  // §06: «إذا كان حزين: خذ دقيقتين فقط واقرأ ما تيسر لك من القرآن …» → «ابدأ الآن»
  quran: {
    ar: {
      title: "ابدأ الآن",
      description: "خذ دقيقتين فقط واقرأ ما تيسر لك من القرآن. مو عشان تهرب من شعورك… عشان ما تواجهه وحدك.",
    },
    en: {
      title: "Start now",
      description:
        "Take just two minutes and read whatever you can of the Qur'an. Not to run away from what you feel… but so you don't face it alone.",
    },
  },
  // §06: «إذا تحتاج تفريج: ادعُ الله الآن بكلامك أنت …» → «اكتب دعاءك»
  dua: {
    ar: {
      title: "اكتب دعاءك",
      description: "ادعُ الله الآن بكلامك أنت. ما تحتاج كلمات مرتبة… قل له اللي بقلبك.",
    },
    en: {
      title: "Write your du'a",
      description: "Call on God now, in your own words. You don't need polished words… tell Him what is in your heart.",
    },
  },
  // §06: «إذا تحتاج تشعر بالأثر: تصدّق بما تستطيع، ولو بشيء بسيط.» → «أبي أعمل خير»
  charity: {
    ar: {
      title: "أبي أعمل خير",
      description: "تصدّق بما تستطيع، ولو بشيء بسيط.",
    },
    en: {
      title: "I want to do some good",
      description: "Give in charity whatever you can, even something small.",
    },
  },
  // §06: «إذا كنت تحتاج أحد: مو كل شيء لازم تحمله لحالك …» → «أرسل رسالة»
  reach_out: {
    ar: {
      title: "أرسل رسالة",
      description: "مو كل شيء لازم تحمله لحالك. تواصل مع شخص تثق فيه وقل له ببساطة: \"أنا اليوم محتاج أتكلم.\"",
    },
    en: {
      title: "Send a message",
      description:
        "Not everything has to be carried alone. Reach out to someone you trust and simply tell them: \"I need to talk today.\"",
    },
  },
};

/**
 * Which §06 situation fits each topic:
 * - sadness (quran): patience, grief, nearness
 * - needing relief (dua): anxiety, hope, tawakkul
 * - wanting to feel the effect of doing good (charity): effort
 * - needing someone (reach_out): loss, amanah (a weight not to be carried alone)
 */
export const TOPIC_STEP_TYPE: Record<string, Exclude<ActionType, "prayer">> = {
  patience: "quran",
  grief: "quran",
  nearness: "quran",
  anxiety: "dua",
  hope: "dua",
  tawakkul: "dua",
  effort: "charity",
  loss: "reach_out",
  amanah: "reach_out",
};

/**
 * Topics whose situation §06 does not cover get their own line in the same voice (product
 * guidance, not religious text). Gratitude: notice one blessing and thank God for it in your words.
 */
const TOPIC_STEP_OVERRIDES: Record<string, { type: ActionType; copy: Record<Lang, { title: string; description: string }> }> = {
  gratitude: {
    type: "dua",
    copy: {
      ar: {
        title: "اشكر الله بكلامك",
        description: "خذ لحظة وسمِّ نعمة وحدة صارت لك… واشكر الله عليها بكلامك أنت. ما تحتاج كلمات مرتبة.",
      },
      en: {
        title: "Thank God in your own words",
        description:
          "Take a moment and name one blessing that came your way… then thank God for it in your own words. You don't need polished words.",
      },
    },
  },
};

export function topicSuggestedAction(topicId: string, lang: Lang): SuggestedAction {
  const override = TOPIC_STEP_OVERRIDES[topicId];
  if (override) {
    const copy = override.copy[lang === "en" ? "en" : "ar"];
    return { type: override.type, title: copy.title, description: copy.description };
  }
  const type = TOPIC_STEP_TYPE[topicId] ?? "reach_out";
  const copy = STEPS[type][lang === "en" ? "en" : "ar"];
  return { type, title: copy.title, description: copy.description };
}
