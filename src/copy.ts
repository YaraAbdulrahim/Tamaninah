export type Lang = "ar" | "en";

/*
 * Interface copy only. No religious text lives here: every verse, hadith, explanation, story,
 * term or answer the person sees comes from the server's verified catalog, with its source.
 */

const ar = {
  docTitle: "طمأنينة | Tamaninah — من تجربة تعيشها إلى معرفة تكتشفها",
  skip: "تخطَّ إلى المحتوى",
  langLabel: "English",

  // 1 · Hero
  heroLine1: "كل تجربة ممكن تكون",
  heroLine2: "بداية لاكتشاف الإسلام.",
  heroLead: "احكِ ما تعيشه، أو اسأل عمّا يشغلك، وابدأ رحلتك في المعرفة الإسلامية من حيث أنت.",
  heroCta: "ابدأ من حيث أنت",
  explore: "استكشف طمأنينة",

  // 2 · Human start
  s2Lead: "ما تحتاج تعرف اسم الموضوع.",
  s2Body: "اكتب تجربتك، سؤالك، أو الشيء الذي ترغب في فهمه بطريقتك.",
  s2Who: "قد تكون مسلمًا تبحث عن فهم أعمق لشيء تعيشه، أو شخصًا يتعرّف على الإسلام ويسأل عن مفهوم لأول مرة.",
  phrases: ["«انقبلت في وظيفة جديدة،", "فرحان جدًا،", "لكن خايف ما أكون قد المسؤولية.»"],
  s2TopicsLabel: "موضوعات يمكنك استكشافها",
  s2Topics: ["التوكل", "الأمانة", "المسؤولية"],
  s2TopicsNote: "الموضوعات المقترحة تختلف باختلاف ما تكتبه.",

  // 3 · Journey
  journeyTitle: "من تجربة تعيشها… إلى معرفة تكتشفها.",
  stations: [
    ["تحكي", "بكلامك أنت، تجربة أو سؤال أو شيء ترغب في فهمه."],
    ["نكتشف", "نساعدك على اكتشاف موضوعات إسلامية مرتبطة بما كتبت."],
    ["تختار", "أنت تختار الموضوع الذي تريد استكشافه."],
    ["تتعلّم", "رحلة معرفية من القرآن والحديث والتفسير، بمصادر موثوقة."],
  ] as [string, string][],

  // 4 · Story gateway
  storyLine1: "ومن الموضوع…",
  storyLine2: "تبدأ الرحلة.",
  storyItems: [
    ["القرآن", "آيات مرتبطة بالموضوع من مصدر معتمد."],
    ["الحديث", "أحاديث صحيحة من المصادر المعتمدة."],
    ["التفسير", "شرح موثوق يساعدك على فهم الآية وسياقها."],
  ] as [string, string][],
  storyFoot: "مصادر موثوقة ومراجعة — والمصدر واضح مع كل محتوى.",

  // 5 · Trust + the AI's role
  trustTitle: "كل كلمة لها مصدر.",
  trustBody:
    "القرآن والحديث والتفسير والمحتوى التعليمي في طمأنينة يأتي من مصادر معتمدة ومراجعة، مع إظهار مصدر المحتوى بوضوح.",
  source: "المصدر",
  verifiedCatalog: "مكتبة موثّقة",
  aiRoleTitle: "دور الذكاء الاصطناعي؟",
  aiRoleSteps: ["يفهم ما كتبته", "يقترح الموضوعات", "يرتب لك رحلة التعلم."],
  aiRoleNote: "ولا يولّد المحتوى الديني من نفسه.",

  // 6 · Experience
  question: "وش يشغلك اليوم؟",
  questionSub: "احكِ تجربة، اطرح سؤالًا، أو اكتب ما ترغب في فهمه.",
  placeholder: "اكتب تجربتك أو سؤالك هنا…",
  examplesLabel: "أمثلة",
  examples: [
    "وش معنى التوكل في الإسلام؟",
    "صار لي شيء جميل وأحس بالامتنان، وودي أفهم كيف يكون الشكر في الإسلام.",
    "تعبت من كل شيء… وأبغى أفهم كيف يتعامل الإسلام مع الصبر.",
  ],
  kindLabel: "نوع ما تكتبه (اختياري)",
  chipsPrefix: "نوع ما أكتبه:",
  sendLabel: "اكتشف الموضوعات",
  sendHint: "اكتب جملة واحدة على الأقل لتبدأ.",
  aiNote: "طمأنينة أداة مدعومة بالذكاء الاصطناعي؛ تفهم كلامك وتدلّك على المحتوى من مصادره المعتمدة، ولا تُصدر فتوى.",
  privacyNote: "خصوصيتك مهمة. لا تحتاج طمأنينة إلى اسمك أو بياناتك الشخصية. اكتب فقط ما تحتاجه لتبدأ رحلتك.",
  yourWords: "كلامك",
  edit: "عدّل",

  // 02 · while understanding (EXPERIENCE.md §02)
  thinkingAnalyze: ["أقرأ ما كتبته…", "أبحث عن موضوعات مرتبطة بكلامك…", "أجهّز لك من المصادر المعتمدة…"],
  thinkingJourney: ["أجهّز لك رحلة التعلم في هذا الموضوع…", "أجمع لك المحتوى من مصادره المعتمدة…"],

  // The AI's reading — always marked as generated, never as source text
  understood: "فهمت عليك",
  aiReading: "قراءة الذكاء الاصطناعي لكلامك",

  // Topic discovery
  topicsTitle: "اختر موضوعًا تستكشفه",
  topicsNote: "العناوين من مكتبتنا الموثّقة، والربط بكلامك من الذكاء الاصطناعي.",

  // Learning result
  verifiedSource: "مصدر موثّق",
  hadithExplanation: "شرح الحديث",
  grade: "الدرجة",
  readMore: "اقرأ المزيد",
  readLess: "اختصر",
  arabicOnly: "النص بالعربية كما ورد في مصدره.",
  // The journey: default bridges (used when the payload brings none), disclosures, the ending
  bridgeQuran: "شيء من القرآن يلامس ما تعيشه",
  bridgeTafsir: "ماذا نفهم من الآية؟",
  bridgeHadith: "وحديث عن النبي ﷺ يقرّب المعنى",
  bridgeSeerah: "موقف عاشه النبي ﷺ",
  connectTitle: "ما يمر بك اليوم… ليس خارج الرحلة.",
  connectPoints: ["ما أشعر به", "ما أتعلمه", "ما أستطيع أن أفعله الآن"] as [string, string, string],
  showFullTafsir: "عرض التفسير كاملًا",
  showFullHadith: "قراءة الحديث كاملًا",
  showLess: "عرض أقل",
  excerpt: "(مقتطف)",
  continueLabel: "تابع",
  duaTitle: "والآن… قل ما في قلبك.",
  duaSub: "لا تحتاج كلمات مرتبة. ادعُ الله بكلامك أنت.",
  duaPlaceholder: "يا رب…",
  duaPrivacy: "لا يُرسل ولا يُحفظ — بينك وبين ربك.",
  endJourney: "أختم رحلتي",
  lessonsTitle: "لتتعلّم أكثر",
  lessonsNote: "أقسام منقولة كما وردت في مصادرها، لما طلبت أن تتعلمه.",
  lessonBadge: "من مصدر معتمد",
  gapNote: "المحتوى المتاح في طمأنينة لا يغطي هذا الجزء من سؤالك بشكل موثوق.",
  nextPath: "أو استكشف موضوعًا مرتبطًا",
  newTab: "(يفتح في تبويب جديد)",
  openSource: "افتح المصدر",

  // Knowledge answer
  knowGlossary: "مصطلح",
  knowQa: "من المصادر المعتمدة",
  sourceText: "نص المصدر",
  termEn: "بالإنجليزية",
  excerptNote: "مقتطف من الجواب — اقرأ الجواب كاملًا في المصدر",

  // Referral · «أنت مهم» (EXPERIENCE.md §12)
  careTitle: "أنت مهم",
  careBody: [
    "واضح إن الألم اللي تمر فيه كبير جدًا، وما أبغاك تواجهه لحالك.",
    "التقرب إلى الله وطلب المساعدة من أهل الاختصاص ما يتعارضان. كلاهما ممكن يكون سببًا في نجاتك بإذن الله.",
  ],
  careAction: "تواصل الآن مع شخص تثق فيه أو جهة مختصة في بلدك.",
  careEmergency: "وإذا كنت في خطر الآن، اتصل برقم الطوارئ في بلدك فورًا.",
  careHelpline: "ابحث عن خط مساعدة في بلدك",

  // Referral · personal ruling / disputed matter
  referTitle: "سؤالك يحتاج أهل العلم",
  referFallback: "سؤالك يمس حكمًا يحتاج نظرًا في تفاصيل حالتك.",
  referNote: "طمأنينة لا تُصدر فتوى شخصية؛ اسأل عالمًا مؤهلًا أو مركزًا شرعيًا موثوقًا.",
  pointerLeadRefer: "وللمعلومات العامة في هذا الباب، ارجع لمصادره المعتمدة:",

  // Honest "not enough in the sources"
  insuffLabel: "بصراحة",
  insuffTitle: "ما وجدنا في مصادرنا المعتمدة ما يكفي لنجيبك بدقة.",
  insuffBody: "نفضّل نقول لك هذا بدل ما نعطيك جوابًا ما له مصدر.",
  pointerLead: "تقدر تبحث عنه في مصادره المعتمدة:",
  rephrase: "اكتب بطريقة ثانية",

  // Unclear
  unclearTitle: "ما فهمت عليك كفاية…",
  unclearBody: "تقدر تكتب أكثر شوي؟ احكِ وش اللي صار، أو وش اللي تبي تفهمه.",
  writeMore: "أكمل الكتابة",

  // Something went wrong
  errorTitle: "ما قدرنا نكمل الحين",
  errorBody: "صار خلل في الاتصال من جهتنا، وكلامك ما ضاع. جرّب مرة ثانية بعد لحظة.",
  errorRate: "وصلتنا طلبات كثيرة في وقت قصير. انتظر دقيقة، ثم جرّب مرة ثانية.",
  retry: "حاول مرة ثانية",

  closing: "ابدأ من حيث أنت.",
  closingLead: "تجربة تعيشها. سؤال يشغلك. رغبة في الفهم.",
  closingBody: "قد تكون أي واحدة منها بداية لاكتشاف الإسلام.",
  closingCta: "ابدأ رحلتي",
  tagline: "الذكاء الاصطناعي في خدمة المحتوى الإسلامي",

  // Footer + its sheets (source pages stay in clean MSA)
  footerAbout: "عن المنصة",
  footerSources: "المصادر المعتمدة",
  footerPrivacy: "الخصوصية",
  footerTerms: "الشروط",
  close: "إغلاق",
  sourcesTitle: "المصادر المعتمدة",
  sourcesIntro:
    "هذه هي المصادر المعتمدة في المرجعية العلمية التي تعتمدها طمأنينة. كل نص شرعي تعرضه طمأنينة مأخوذ منها حرفيًا ومعه مصدره، وما لا يتوفر عندنا نحيلك فيه إلى المصدر المختص منها.",
  privacyTitle: "الخصوصية",
  privacyBody: [
    "خصوصيتك مهمة. لا توجد في طمأنينة حسابات، ولا نطلب اسمك أو أي بيانات شخصية.",
    "لا نحفظ ما تكتبه: لا توجد قاعدة بيانات للرسائل، وسجلات الخادم تحفظ نتيجة الطلب ومدته فقط، لا نص رسالتك.",
    "ولكي تفهم طمأنينة ما كتبته، يُرسَل النص إلى نموذج Gemini من Google. ووفق شروط Google قد تُستخدم النصوص المرسلة إليه لتحسين خدماتها؛ لذلك اترك الأسماء والتفاصيل التي تعرّف بك أو بغيرك.",
  ],
  termsTitle: "الشروط وحدود الاستخدام",
  termsBody: [
    "طمأنينة أداة تعليمية مدعومة بالذكاء الاصطناعي، تساعدك على اكتشاف المحتوى الإسلامي من مصادره المعتمدة.",
    "لا تُصدر طمأنينة فتوى، ولا تقدّم تشخيصًا أو علاجًا نفسيًا. وللمسائل الشخصية اسأل عالمًا مؤهلًا أو مركزًا شرعيًا موثوقًا.",
    "قراءة الذكاء الاصطناعي لكلامك اجتهاد آلي قد يخطئ، وتُعرض منفصلة عن النصوص الشرعية ومصادرها.",
    "إذا كنت في خطر أو تفكر في إيذاء نفسك، فتواصل فورًا مع جهة الطوارئ في بلدك أو مع شخص تثق به.",
  ],
};

type Copy = typeof ar;

const en: Copy = {
  docTitle: "طمأنينة | Tamaninah — From an experience you live to knowledge you discover",
  skip: "Skip to content",
  langLabel: "العربية",

  heroLine1: "Every experience could be",
  heroLine2: "the beginning of discovering Islam.",
  heroLead:
    "Share what you’re living through, or ask about what’s on your mind, and begin your journey in Islamic knowledge from where you are.",
  heroCta: "Start from where you are",
  explore: "Explore Tamaninah",

  s2Lead: "You don’t need to know the topic’s name.",
  s2Body: "Write your experience, your question, or what you’d like to understand, in your own way.",
  s2Who: "You may be a Muslim looking for a deeper understanding of something you’re living through, or someone getting to know Islam and asking about a concept for the first time.",
  phrases: ["“I got a new job,", "I’m so happy,", "but I’m afraid I’m not up to the responsibility.”"],
  s2TopicsLabel: "Topics you could explore",
  s2Topics: ["Tawakkul", "Trustworthiness", "Responsibility"],
  s2TopicsNote: "The suggested topics differ depending on what you write.",

  journeyTitle: "From an experience you’re living… to knowledge you discover.",
  stations: [
    ["You share", "In your own words: an experience, a question, or something you want to understand."],
    ["We discover", "We help you discover Islamic topics related to what you wrote."],
    ["You choose", "You choose the topic you want to explore."],
    ["You learn", "A learning journey through the Quran, Hadith and tafsir, from trusted sources."],
  ],

  storyLine1: "From the topic…",
  storyLine2: "the journey begins.",
  storyItems: [
    ["The Quran", "Verses related to the topic, from an approved source."],
    ["The Hadith", "Authentic hadith from the approved sources."],
    ["Tafsir", "A trusted explanation that helps you understand the verse and its context."],
  ],
  storyFoot: "Trusted, reviewed sources — and the source is clear with every piece of content.",

  trustTitle: "Every word has a source.",
  trustBody:
    "The Quran, Hadith, tafsir and learning content in Tamaninah come from approved, reviewed sources, and the source of each piece is shown clearly.",
  source: "Source",
  verifiedCatalog: "Verified catalog",
  aiRoleTitle: "The AI’s role?",
  aiRoleSteps: ["Understands what you wrote", "Suggests topics", "Arranges your learning journey."],
  aiRoleNote: "It does not generate religious content on its own.",

  question: "What’s on your mind today?",
  questionSub: "Share an experience, ask a question, or write what you’d like to understand.",
  placeholder: "Write your experience or question here…",
  examplesLabel: "Examples",
  examples: [
    "What does tawakkul mean in Islam?",
    "Something good happened to me and I feel grateful; I’d like to understand what gratitude looks like in Islam.",
    "I’m tired of everything… and I want to understand how Islam approaches patience.",
  ],
  kindLabel: "What you’re writing about (optional)",
  chipsPrefix: "What I’m writing about:",
  sendLabel: "Discover topics",
  sendHint: "Write at least one sentence to begin.",
  aiNote:
    "Tamaninah is an AI-assisted tool: it understands your words and points you to content from its approved sources. It does not issue fatwas.",
  privacyNote:
    "Your privacy matters. Tamaninah doesn’t need your name or personal details. Write only what you need to begin your journey.",
  yourWords: "Your words",
  edit: "Edit",

  thinkingAnalyze: [
    "Reading what you wrote…",
    "Looking for topics related to your words…",
    "Preparing it from the approved sources…",
  ],
  thinkingJourney: ["Preparing your learning journey on this topic…", "Gathering the content from its approved sources…"],

  understood: "What I understood",
  aiReading: "The AI’s reading of your words",

  topicsTitle: "Choose a topic to explore",
  topicsNote: "Titles come from our verified library; the link to your words is the AI’s.",

  verifiedSource: "Verified source",
  hadithExplanation: "Explaining the narration",
  grade: "Grade",
  readMore: "Read more",
  readLess: "Show less",
  arabicOnly: "Shown in Arabic, as published in its source.",
  bridgeQuran: "Something from the Quran that touches what you’re living",
  bridgeTafsir: "What do we understand from the verse?",
  bridgeHadith: "And a hadith of the Prophet ﷺ that brings it closer",
  bridgeSeerah: "A moment the Prophet ﷺ lived through",
  connectTitle: "What you’re going through today… is not outside the journey.",
  connectPoints: ["What I feel", "What I learn", "What I can do now"],
  showFullTafsir: "Show the full tafsir",
  showFullHadith: "Read the full hadith",
  showLess: "Show less",
  excerpt: "(excerpt)",
  continueLabel: "Continue",
  duaTitle: "And now… say what’s in your heart.",
  duaSub: "You don’t need well-ordered words. Call on Allah in your own words.",
  duaPlaceholder: "O Allah…",
  duaPrivacy: "It isn’t sent or saved — it stays between you and your Lord.",
  endJourney: "Finish my journey",
  lessonsTitle: "To learn more",
  lessonsNote: "Sections quoted as they appear in their sources, for what you asked to learn.",
  lessonBadge: "From an approved source",
  gapNote: "The content available in Tamaninah doesn’t cover this part of your question reliably.",
  nextPath: "Or explore a related topic",
  newTab: "(opens in a new tab)",
  openSource: "Open the source",

  knowGlossary: "Term",
  knowQa: "From the approved sources",
  sourceText: "Source text",
  termEn: "In English",
  excerptNote: "An excerpt from the answer — read the full answer at the source",

  careTitle: "You matter",
  careBody: [
    "It’s clear the pain you’re carrying is very heavy, and I don’t want you to face it alone.",
    "Turning to Allah and asking for help from people trained to give it don’t contradict each other. Both can be a means of your safety, by Allah’s will.",
  ],
  careAction: "Reach out now to someone you trust, or to a specialised service in your country.",
  careEmergency: "If you are in danger right now, call your local emergency number straight away.",
  careHelpline: "Find a helpline in your country",

  referTitle: "This question needs a qualified scholar",
  referFallback: "Your question touches a ruling that depends on the details of your situation.",
  referNote: "Tamaninah does not issue personal fatwas — please ask a qualified scholar or a trusted Islamic centre.",
  pointerLeadRefer: "For general information on this, see its approved sources:",

  insuffLabel: "Honestly",
  insuffTitle: "We didn’t find enough in our approved sources to answer this accurately.",
  insuffBody: "We’d rather tell you that than give you an answer without a source.",
  pointerLead: "You can look for it in its approved sources:",
  rephrase: "Write it another way",

  unclearTitle: "I couldn’t quite understand…",
  unclearBody: "Could you write a little more? Tell me what happened, or what you’d like to understand.",
  writeMore: "Write a little more",

  errorTitle: "We couldn’t finish just now",
  errorBody: "Something went wrong on our side — your words are still here. Try again in a moment.",
  errorRate: "We received many requests in a short time. Wait a minute, then try again.",
  retry: "Try again",

  closing: "Start from where you are.",
  closingLead: "An experience you’re living. A question on your mind. A wish to understand.",
  closingBody: "Any one of them could be the beginning of discovering Islam.",
  closingCta: "Start my journey",
  tagline: "AI in the service of Islamic content",

  footerAbout: "About",
  footerSources: "Approved sources",
  footerPrivacy: "Privacy",
  footerTerms: "Terms",
  close: "Close",
  sourcesTitle: "Approved sources",
  sourcesIntro:
    "These are the approved scholarly sources Tamaninah relies on. Every religious text Tamaninah shows is taken from them verbatim, with its source; where we don’t have an answer, we point you to the right one of them.",
  privacyTitle: "Privacy",
  privacyBody: [
    "Your privacy matters. Tamaninah has no accounts, and it never asks for your name or any personal details.",
    "We don’t store what you write: there is no message database, and server logs keep only a request’s outcome and timing — never your message.",
    "So that Tamaninah can understand what you wrote, the text is sent to Google’s Gemini model. Under Google’s terms, text sent to it may be used to improve Google’s services, so please leave out names and details that identify you or anyone else.",
  ],
  termsTitle: "Terms & limits of use",
  termsBody: [
    "Tamaninah is an AI-assisted learning tool that helps you discover Islamic content from its approved sources.",
    "Tamaninah does not issue fatwas, and it does not diagnose or offer therapy. For personal matters, ask a qualified scholar or a trusted Islamic centre.",
    "The AI’s reading of your words is an automated interpretation that can be wrong, and it is always shown apart from religious texts and their sources.",
    "If you are in danger or thinking of harming yourself, contact your local emergency services or someone you trust right away.",
  ],
};

export const copy: Record<Lang, Copy> = { ar, en };
export type { Copy };

/** Optional hints about what kind of thing the person is writing — appended to the message, never required. */
export const chipList: [string, string][] = [
  ["تجربة جديدة", "A new experience"],
  ["سؤال يشغلني", "A question on my mind"],
  ["شيء جميل حصل لي", "Something good happened to me"],
  ["أريد أن أفهم أكثر", "I want to understand more"],
  ["شعور لا أعرف اسمه", "A feeling I can’t name"],
];

/** Helpline directory linked from the «أنت مهم» screen (country-aware, no numbers hard-coded here). */
export const HELPLINE_URL = "https://findahelpline.com";

/** The challenge's approved scholarly references (sources.pdf, «المرجعية العلمية المعتمدة»). */
export const approvedSources: { ar: string; en: string; noteAr?: string; noteEn?: string; links: { label: string; url: string }[] }[] = [
  {
    ar: "الموضوعات الدعوية والمحتوى الإسلامي",
    en: "Da‘wah topics and Islamic content",
    links: [
      { label: "dawa.center", url: "https://dawa.center" },
      { label: "islamic-content.com", url: "https://islamic-content.com" },
    ],
  },
  {
    ar: "القرآن الكريم",
    en: "The Holy Quran",
    noteAr: "طبعة مجمع الملك فهد لطباعة المصحف الشريف وترجماتها",
    noteEn: "King Fahd Complex edition of the Mushaf and its translations",
    links: [{ label: "quranpedia.net", url: "https://quranpedia.net" }],
  },
  {
    ar: "التفسير",
    en: "Tafsir (Quran exegesis)",
    links: [{ label: "dorar.net/tafseer", url: "https://dorar.net/tafseer" }],
  },
  {
    ar: "الحديث النبوي",
    en: "Hadith",
    links: [
      { label: "dorar.net/hadith", url: "https://dorar.net/hadith" },
      { label: "shamela.ws", url: "https://shamela.ws" },
    ],
  },
  {
    ar: "العقيدة والتعريف بالإسلام",
    en: "Creed and introducing Islam",
    links: [{ label: "dorar.net/aqeeda", url: "https://dorar.net/aqeeda" }],
  },
  {
    ar: "الفقه العام",
    en: "General fiqh",
    links: [{ label: "dorar.net/feqhia", url: "https://dorar.net/feqhia" }],
  },
  {
    ar: "السيرة والتاريخ",
    en: "Seerah and history",
    links: [{ label: "dorar.net/history", url: "https://dorar.net/history" }],
  },
  {
    ar: "الشبهات والأسئلة المتكررة",
    en: "Common questions and doubts",
    noteAr: "«بيّنات»",
    noteEn: "“Bayyinat”",
    links: [{ label: "dawa.center/file/7937", url: "https://dawa.center/file/7937" }],
  },
  {
    ar: "الترجمة والمصطلحات",
    en: "Translation and terminology",
    links: [{ label: "islamic-content.com/dictionary", url: "https://islamic-content.com/dictionary" }],
  },
];
