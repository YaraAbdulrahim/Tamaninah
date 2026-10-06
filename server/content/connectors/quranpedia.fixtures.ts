import type { QuranpediaMushafAyah, QuranpediaTranslationRow } from "./quranpediaTypes";

/** Offline API shapes for tests — text captured from Quranpedia v1 (Hafs mushaf 1). */
export const QURANPEDIA_FIXTURE_MUSHAF: Record<string, QuranpediaMushafAyah> = {
  "1-39-10": {
    id: 4068,
    number: 10,
    surah: "39",
    text: "قُلْ يَا عِبَادِيَ الَّذِينَ آمَنُوا اتَّقُوا رَبَّكُمْ ۖ لِلَّذِينَ أَحْسَنُوا فِي هَٰذِهِ الدُّنْيَا حَسَنَةٌ ۗ وَأَرْضُ اللَّهِ وَاسِعَةٌ ۗ إِنَّمَا يُوَفَّى الصَّابِرُونَ أَجْرَهُمْ بِغَيْرِ حِسَابٍ",
  },
  "1-39-53": {
    id: 4111,
    number: 53,
    surah: "39",
    text: "۞ قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا ۚ إِنَّهُ هُوَ الْغَفُورُ الرَّحِيمُ",
  },
  "1-2-286": {
    id: 494,
    number: 286,
    surah: "2",
    text: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنتَ مَوْلَانَا فَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ",
  },
};

export const QURANPEDIA_FIXTURE_TRANSLATIONS: Record<string, QuranpediaTranslationRow[]> = {
  "39-10": [
    {
      book: { id: 13638, name: "Sahih International", short_name: null },
      "translation-content":
        'Say, "O My servants who have believed, fear your Lord. For those who do good in this world is good, and the earth of Allah is spacious. Indeed, the patient will be given their reward without account."',
    },
  ],
  "39-53": [
    {
      book: { id: 13638, name: "Sahih International", short_name: null },
      "translation-content":
        'Say, "O My servants who have transgressed against themselves [by sinning], do not despair of the mercy of Allah. Indeed, Allah forgives all sins. Indeed, it is He who is the Forgiving, the Merciful."',
    },
  ],
  "2-286": [
    {
      book: { id: 13638, name: "Sahih International", short_name: null },
      "translation-content":
        "Allah does not charge a soul except [with that within] its capacity. It will have [the consequence of] what [good] it has gained, and it will bear [the consequence of] what [evil] it has earned. Our Lord, do not impose blame upon us if we forget or make a mistake.",
    },
  ],
};
