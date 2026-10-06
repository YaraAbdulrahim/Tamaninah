import type { AIProvider, ChatMessage } from "./provider";

/**
 * Mock analyze-only provider — no journey religious prose (repository serves learning content).
 * Opt-in (`AI_MOCK=true`) for tests and offline UI work only. The server filters its suggestions
 * to ready topics exactly like live model output.
 */
export const mockProvider: AIProvider = {
  name: "mock",
  async complete(messages: ChatMessage[]) {
    const last = messages.at(-1)?.content ?? "";
    let message = "";
    let language = "ar";
    let stage = "analyze";
    let prior = "";
    let candidates: { id: string; kind: string; text: string }[] = [];
    try {
      const parsed = JSON.parse(last) as {
        stage?: string;
        message?: string;
        language?: string;
        context?: { text?: string }[];
        knowledge_candidates?: { id: string; kind: string; text: string }[];
      };
      candidates = Array.isArray(parsed.knowledge_candidates) ? parsed.knowledge_candidates : [];
      message = String(parsed.message ?? "");
      language = parsed.language === "en" ? "en" : "ar";
      stage = parsed.stage === "analyze" ? "analyze" : "journey";
      prior = Array.isArray(parsed.context)
        ? parsed.context.map((turn) => String(turn.text ?? "")).join(" ")
        : "";
    } catch {
      message = last;
    }

    if (stage !== "analyze") {
      throw new Error("mockProvider is analyze-only; journey uses the repository API.");
    }

    if (/هل\s+زواجي|صلاتي\s+صحيحة|should i do in my marriage/i.test(`${prior} ${message}`)) {
      return JSON.stringify({
        context_summary: "سؤال عن حكم شخصي على حالة فردية.",
        level: "D",
        safety: "refer",
        input_intent: "RELIGIOUS_RULING_QUESTION",
        recommended_path: "referral",
        suggested_topics: [],
      });
    }

    const knowledge = mockKnowledgePick(message, language, candidates);
    if (knowledge) return JSON.stringify(knowledge);
    return JSON.stringify(buildAnalyze(`${prior} ${message}`, language));
  },
};

function buildAnalyze(message: string, language: string) {
  const en = language === "en";
  if (/وش حكم|حكم الشيء|هل يجوز/i.test(message)) {
    return {
      context_summary: en
        ? "You asked about a religious ruling on something that happened."
        : "سؤال عن حكم لشيء حصل معك.",
      level: "B",
      safety: "safe",
      input_intent: "RELIGIOUS_RULING_QUESTION",
      recommended_path: "direct_learning",
      suggested_topics: [],
    };
  }
  if (/معنى التوكل|what is tawakkul|meaning of tawakkul|وش معنى التوكل/i.test(message)) {
    return {
      context_summary: en ? "You asked what tawakkul means in Islam." : "سؤال عن معنى التوكل في الإسلام.",
      level: "A",
      safety: "safe",
      input_intent: "DIRECT_QUESTION",
      recommended_path: "direct_learning",
      suggested_topics: [
        {
          id: "tawakkul",
          title: en ? "Tawakkul" : "التوكل",
          reason: en ? "Matches your question." : "يرتبط بسؤالك.",
        },
      ],
    };
  }
  if (/زكاة|zakat|what is zakat|معنى الزكاة/i.test(message)) {
    return {
      context_summary: en
        ? "You asked about zakat — we need a verified topic in the catalog."
        : "سؤال عن الزكاة — لا يوجد topic موثّق جاهز في الكatalog حاليًا.",
      level: "B",
      safety: "safe",
      input_intent: "DIRECT_QUESTION",
      recommended_path: "direct_learning",
      suggested_topics: [],
    };
  }
  if (/توفى|فقد|grief|passed away/i.test(message)) {
    return {
      context_summary: en ? "You are living through loss and grief." : "تعيش فقدًا وحزنًا.",
      level: "A",
      safety: "safe",
      input_intent: "EXPERIENCE",
      recommended_path: "topic_discovery",
      suggested_topics: [
        { id: "grief", title: en ? "Grief and loss" : "الحزن والفقد", reason: en ? "Linked to loss in your words." : "مرتبط بالفقد في كلامك." },
        { id: "patience", title: en ? "Patience" : "الصبر", reason: en ? "Walking with pain over time." : "الثبات مع الألم." },
        { id: "hope", title: en ? "Hope" : "الرجاء", reason: en ? "Holding on to what comes next." : "التمسك بما هو آت." },
      ],
    };
  }
  if (/صلتي|تقوى|قرب|nearness|closer to/i.test(message)) {
    return {
      context_summary: en ? "You want to grow nearer to God." : "تبغى تقرب من الله.",
      level: "A",
      safety: "safe",
      input_intent: "GENERAL_ISLAMIC_LEARNING",
      recommended_path: "topic_discovery",
      suggested_topics: [
        { id: "nearness", title: en ? "Nearness to God" : "القرب من الله", reason: en ? "Linked to your wish for nearness." : "مرتبط برغبتك في القرب." },
        { id: "hope", title: en ? "Hope" : "الرجاء", reason: en ? "A gentle next concept." : "مفهوم تالي لطيف." },
      ],
    };
  }
  if (/نعمة|فرحت.*انتظر|grateful|gratitude|blessing|كنت أنتظر|جتني نعمة|امتنان|ممتن|الشكر/i.test(message)) {
    return {
      context_summary: en ? "Joy after waiting for something good." : "فرح بعد انتظار نعمة.",
      level: "A",
      safety: "safe",
      input_intent: "FEELING",
      recommended_path: "topic_discovery",
      suggested_topics: [
        { id: "gratitude", title: en ? "Gratitude" : "الشكر", reason: en ? "Linked to the good that came your way." : "مرتبط بالخير الذي وصلك." },
        { id: "hope", title: en ? "Hope" : "الرجاء", reason: en ? "Linked to gladness after waiting." : "مرتبط بالفرح بعد الانتظار." },
        { id: "nearness", title: en ? "Nearness to God" : "القرب من الله", reason: en ? "Joy can bring the heart closer." : "الفرح قد يقرّب القلب." },
        { id: "tawakkul", title: en ? "Tawakkul" : "التوكل", reason: en ? "What you hoped for came in its time." : "ما رجوته جاء في وقته." },
      ],
    };
  }
  if (/فشل|failed|إحباط|frustrat/i.test(message)) {
    return {
      context_summary: en ? "Setback and frustration weigh on you." : "إحباط بعد نتيجة لم تكن كما رجوت.",
      level: "A",
      safety: "safe",
      input_intent: "EXPERIENCE",
      recommended_path: "topic_discovery",
      suggested_topics: [
        { id: "patience", title: en ? "Patience" : "الصبر", reason: en ? "Walking with difficulty." : "الثبات مع التجربة." },
        { id: "hope", title: en ? "Hope" : "الرجاء", reason: en ? "Looking past this setback." : "النظر إلى ما بعد هذه العثرة." },
        { id: "anxiety", title: en ? "Anxiety and fear" : "القلق والخوف", reason: en ? "Worry about what comes next." : "القلق مما سيأتي." },
        { id: "grief", title: en ? "Grief and loss" : "الحزن والفقد", reason: en ? "Loss of what you hoped for." : "فقد أمل أو نتيجة." },
      ],
    };
  }
  if (/محتار|قرارين|decision|between two|confused.*choice/i.test(message)) {
    return {
      context_summary: en ? "You are weighing an important choice." : "تفكر في قرار مهم.",
      level: "A",
      safety: "safe",
      input_intent: "SITUATION",
      recommended_path: "topic_discovery",
      suggested_topics: [
        { id: "anxiety", title: en ? "Anxiety and fear" : "القلق والخوف", reason: en ? "Uncertainty about the future." : "قلق من المجهول." },
        { id: "effort", title: en ? "Effort" : "السعي", reason: en ? "Taking lawful means." : "الأخذ بالأسباب." },
        { id: "tawakkul", title: en ? "Tawakkul" : "التوكل", reason: en ? "After effort, entrusting outcomes." : "بعد السعي، تفويض النتيجة." },
      ],
    };
  }
  if (/وظيفة|job|مسؤولية|responsibility|انقبلت|accepted|بدأت وظيفة/i.test(message)) {
    return {
      context_summary: en
        ? "Joy at something new, with fear about responsibility."
        : "فرح بشيء جديد مع خوف من تحمل المسؤولية.",
      level: "A",
      safety: "safe",
      input_intent: "EXPERIENCE",
      recommended_path: "topic_discovery",
      suggested_topics: [
        { id: "tawakkul", title: en ? "Tawakkul" : "التوكل", reason: en ? "Trust while taking means." : "الاعتماد على الله مع الأخذ بالأسباب." },
        { id: "anxiety", title: en ? "Anxiety and fear" : "القلق والخوف", reason: en ? "Fear of the new responsibility." : "الخوف من المسؤولية الجديدة." },
        { id: "effort", title: en ? "Effort" : "السعي", reason: en ? "Linked to new work." : "مرتبط بالعمل الجديد." },
        { id: "amanah", title: en ? "Trustworthiness" : "الأمانة", reason: en ? "Carrying new responsibility." : "حمل المسؤولية بصدق." },
      ],
    };
  }
  return {
    context_summary: en ? "Long effort and waiting weigh on you." : "سعي وانتظار يثقل عليك.",
    level: "A",
    safety: "safe",
    input_intent: "EXPERIENCE",
    recommended_path: "topic_discovery",
    suggested_topics: [
      { id: "effort", title: en ? "Effort" : "السعي", reason: en ? "Linked to striving." : "مرتبط بالسعي." },
      { id: "hope", title: en ? "Hope" : "الرجاء", reason: en ? "Looking beyond the waiting." : "النظر إلى ما بعد الانتظار." },
      { id: "patience", title: en ? "Patience" : "الصبر", reason: en ? "Steadiness over time." : "الثبات مع الوقت." },
    ],
  };
}

/**
 * Mock routing for the knowledge route (offline UI work): a glossary candidate only for an
 * explicit "meaning / translate <term>" phrasing, a Q&A candidate only for a question when the
 * server offered one. The server still validates the id against its own candidate list.
 */
function mockKnowledgePick(
  message: string,
  language: string,
  candidates: { id: string; kind: string; text: string }[],
) {
  const en = language === "en";
  const base = {
    level: "A",
    safety: "safe",
    input_intent: "DIRECT_QUESTION",
    recommended_path: "direct_learning",
    suggested_topics: [],
  };
  const meaning = /(?:معنى|معني|ترجم(?:ة)?|ترجمة)\s+(?:كلمة\s+|مصطلح\s+)?(\S+)|(?:meaning of|translate|define)\s+(\S+)/i.exec(message);
  if (meaning) {
    const word = (meaning[1] ?? meaning[2] ?? "").replace(/[؟?!.،,]/g, "");
    const hit = candidates.find((c) => c.kind === "glossary" && word && c.text.includes(word));
    if (hit) {
      return {
        ...base,
        context_summary: en ? "You asked what a term means." : "سؤال عن معنى مصطلح.",
        domain: "terminology",
        knowledge_id: hit.id,
      };
    }
  }
  const qa = candidates.find((c) => c.kind === "qa");
  if (qa && /^(?:هل|لماذا|كيف|ما|why|is|does|how|what)(?:\s|$)/i.test(message.trim())) {
    return {
      ...base,
      level: "B",
      context_summary: en ? "You asked a general question about Islam." : "سؤال عام عن الإسلام.",
      domain: "shubuhat",
      knowledge_id: qa.id,
    };
  }
  return null;
}
