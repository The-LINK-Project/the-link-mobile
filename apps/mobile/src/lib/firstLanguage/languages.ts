/**
 * The languages a learner can name as the one they know best.
 *
 * This is not the app's locale list. The app is written in seven languages, but
 * a learner holding a finger on an English word wants that word in whatever
 * they actually grew up speaking, which on a Singapore worksite is a wider set.
 *
 * English is on the list, last. A learner who reads English best, or a
 * volunteer trying the app out, had no honest answer without it and was made
 * to claim a language they do not read. It is a first language and nothing
 * else: there is nothing to translate an English word into, and the speaking
 * tutor explains English from another language, so both of those work from
 * `TRANSLATION_LANGUAGES`, which leaves it out.
 *
 * Codes keep the app's historical locale codes where one exists, so a learner
 * running the app in Burmese and reading Burmese in the bubble sees one code in
 * both places.
 */

import { getLocales } from "expo-localization";

import { getLocale } from "@/lib/i18n";

export const FIRST_LANGUAGES = [
    "bn",
    "ta",
    "hi",
    "te",
    "ml",
    "bu",
    "fi",
    "in",
    "ms",
    "zh",
    "th",
    "vi",
    "fr",
    "es",
    "en",
] as const;

export type FirstLanguage = (typeof FIRST_LANGUAGES)[number];

/** A language English can be translated into and explained from. */
export type TranslationLanguage = Exclude<FirstLanguage, "en">;

export const TRANSLATION_LANGUAGES = FIRST_LANGUAGES.filter(
    (language): language is TranslationLanguage => language !== "en",
);

export function isTranslationLanguage(value: unknown): value is TranslationLanguage {
    return isFirstLanguage(value) && value !== "en";
}

/** What each language calls itself. A learner finds their own name fastest. */
export const FIRST_LANGUAGE_LABELS: Record<FirstLanguage, string> = {
    bn: "বাংলা",
    ta: "தமிழ்",
    hi: "हिन्दी",
    te: "తెలుగు",
    ml: "മലയാളം",
    bu: "မြန်မာ",
    fi: "Filipino",
    in: "Bahasa Indonesia",
    ms: "Bahasa Melayu",
    zh: "中文",
    th: "ไทย",
    vi: "Tiếng Việt",
    fr: "Français",
    es: "Español",
    en: "English",
};

/** For English copy, logs and the account screen's secondary line. */
export const FIRST_LANGUAGE_ENGLISH_NAMES: Record<FirstLanguage, string> = {
    bn: "Bengali",
    ta: "Tamil",
    hi: "Hindi",
    te: "Telugu",
    ml: "Malayalam",
    bu: "Burmese",
    fi: "Filipino",
    in: "Indonesian",
    ms: "Malay",
    zh: "Chinese (Simplified)",
    th: "Thai",
    vi: "Vietnamese",
    fr: "French",
    es: "Spanish",
    en: "English",
};

/**
 * The brief explanation on the first-language question, in the language the
 * learner has just picked. These are intentionally kept with the picker
 * languages instead of the app locale catalogues: eight translation languages
 * (Telugu, Malayalam, Malay, Chinese, Thai, Vietnamese, French and Spanish) are
 * offered in the bubble but are not full app locales yet.
 */
export const FIRST_LANGUAGE_ONBOARDING_COPY: Record<
    FirstLanguage,
    { title: string; body: string; continue: string; changeLater: string }
> = {
    bn: {
        title: "আপনার ভাষা কী?",
        body: "যে ভাষা আপনি সবচেয়ে ভালো জানেন, সেটি বেছে নিন। অ্যাপে যেকোনো ইংরেজি শব্দ চেপে ধরলে সেটি আপনার ভাষায় দেখতে পাবেন।",
        continue: "চালিয়ে যান",
        changeLater: "এটি পরে অ্যাকাউন্ট থেকে বদলাতে পারবেন।",
    },
    ta: {
        title: "உங்கள் மொழி என்ன?",
        body: "நீங்கள் நன்றாக அறிந்த மொழியைத் தேர்ந்தெடுங்கள். ஆப்பில் எந்த ஆங்கிலச் சொல்லையும் அழுத்திப் பிடித்தால், அதை உங்கள் மொழியில் காணலாம்.",
        continue: "தொடருங்கள்",
        changeLater: "இதை பின்னர் கணக்கில் மாற்றிக்கொள்ளலாம்.",
    },
    hi: {
        title: "आपकी भाषा कौन-सी है?",
        body: "जो भाषा आप सबसे अच्छी तरह जानते हैं, वह चुनें। ऐप में किसी भी अंग्रेज़ी शब्द को दबाकर रखें, उसे अपनी भाषा में देखें।",
        continue: "जारी रखें",
        changeLater: "इसे बाद में खाते में बदल सकते हैं।",
    },
    te: {
        title: "మీ భాష ఏమిటి?",
        body: "మీకు బాగా తెలిసిన భాషను ఎంచుకోండి. యాప్‌లో ఏదైనా ఆంగ్ల పదాన్ని నొక్కి ఉంచితే, దాన్ని మీ భాషలో చూడవచ్చు.",
        continue: "కొనసాగించండి",
        changeLater: "దీన్ని తర్వాత ఖాతాలో మార్చుకోవచ్చు.",
    },
    ml: {
        title: "നിങ്ങളുടെ ഭാഷ ഏതാണ്?",
        body: "നിങ്ങൾക്ക് ഏറ്റവും നന്നായി അറിയാവുന്ന ഭാഷ തിരഞ്ഞെടുക്കുക. ആപ്പിലെ ഏതെങ്കിലും ഇംഗ്ലീഷ് വാക്കിൽ അമർത്തിപ്പിടിച്ചാൽ അത് നിങ്ങളുടെ ഭാഷയിൽ കാണാം.",
        continue: "തുടരുക",
        changeLater: "ഇത് പിന്നീട് അക്കൗണ്ടിൽ മാറ്റാം.",
    },
    bu: {
        title: "သင့်ဘာသာစကား ဘာဖြစ်ပါသလဲ?",
        body: "သင် အကောင်းဆုံး တတ်သော ဘာသာစကားကို ရွေးပါ။ အက်ပ်ထဲရှိ မည်သည့် အင်္ဂလိပ်စကားလုံးကိုမဆို ဖိထားပါက သင့်ဘာသာစကားဖြင့် မြင်ရပါမည်။",
        continue: "ဆက်ရန်",
        changeLater: "ဤအရာကို နောက်မှ အကောင့်တွင် ပြောင်းနိုင်ပါသည်။",
    },
    fi: {
        title: "Ano ang iyong wika?",
        body: "Piliin ang wikang alam mo nang husto. Pindutin nang matagal ang anumang salitang Ingles sa app para makita ito sa iyong wika.",
        continue: "Magpatuloy",
        changeLater: "Puwede mo itong baguhin mamaya sa Account.",
    },
    in: {
        title: "Apa bahasa Anda?",
        body: "Pilih bahasa yang paling Anda kuasai. Tekan dan tahan kata bahasa Inggris apa saja di aplikasi untuk melihatnya dalam bahasa Anda.",
        continue: "Lanjutkan",
        changeLater: "Anda bisa mengubahnya nanti di Akun.",
    },
    ms: {
        title: "Apakah bahasa anda?",
        body: "Pilih bahasa yang paling anda kuasai. Tekan dan tahan mana-mana perkataan Bahasa Inggeris dalam aplikasi untuk melihatnya dalam bahasa anda.",
        continue: "Teruskan",
        changeLater: "Anda boleh menukarnya kemudian dalam Akaun.",
    },
    zh: {
        title: "您的语言是什么？",
        body: "请选择您最熟悉的语言。长按应用中的任何英文单词，即可用您的语言查看它。",
        continue: "继续",
        changeLater: "您可以稍后在账户中更改此设置。",
    },
    th: {
        title: "ภาษาของคุณคืออะไร?",
        body: "เลือกภาษาที่คุณรู้ดีที่สุด กดค้างที่คำภาษาอังกฤษคำใดก็ได้ในแอปเพื่อดูคำนั้นเป็นภาษาของคุณ",
        continue: "ดำเนินการต่อ",
        changeLater: "คุณเปลี่ยนสิ่งนี้ภายหลังได้ในการตั้งค่าบัญชี",
    },
    vi: {
        title: "Ngôn ngữ của bạn là gì?",
        body: "Chọn ngôn ngữ bạn biết rõ nhất. Nhấn giữ bất kỳ từ tiếng Anh nào trong ứng dụng để xem từ đó bằng ngôn ngữ của bạn.",
        continue: "Tiếp tục",
        changeLater: "Bạn có thể thay đổi điều này sau trong Tài khoản.",
    },
    fr: {
        title: "Quelle est votre langue ?",
        body: "Choisissez la langue que vous connaissez le mieux. Maintenez le doigt sur un mot anglais dans l'application pour le voir dans votre langue.",
        continue: "Continuer",
        changeLater: "Vous pourrez la changer plus tard dans Compte.",
    },
    es: {
        title: "¿Cuál es tu idioma?",
        body: "Elige el idioma que mejor conoces. Mantén pulsada cualquier palabra en inglés de la app para verla en tu idioma.",
        continue: "Continuar",
        changeLater: "Puedes cambiarlo más tarde en Cuenta.",
    },
    en: {
        title: "What is your language?",
        // Not the usual promise: there is no other language to show a held
        // English word in.
        body: "Choose the language you know best. The app will explain each lesson in it.",
        continue: "Continue",
        changeLater: "You can change this later in Account.",
    },
};

export function isFirstLanguage(value: unknown): value is FirstLanguage {
    return typeof value === "string" && (FIRST_LANGUAGES as readonly string[]).includes(value);
}

/**
 * Device language tags that mean one of ours under another name.
 *
 * Android and iOS report Burmese as "my" and Filipino as "fil" or "tl", while
 * our codes for those are "bu" and "fi" (see the locale list in lib/i18n).
 * Indonesian is "id" on modern devices and "in" on older ones, and "in" is also
 * our own code for it. The device's "fi" is deliberately absent: on a phone
 * that tag is Finnish, and offering a Finn Filipino would be worse than
 * offering nothing. English is absent too: most phones sold here are set to
 * English whatever their owner reads, so it is only ever chosen, never guessed.
 */
const DEVICE_LANGUAGES: Record<string, TranslationLanguage> = {
    bn: "bn",
    ta: "ta",
    hi: "hi",
    te: "te",
    ml: "ml",
    my: "bu",
    bu: "bu",
    fil: "fi",
    tl: "fi",
    id: "in",
    in: "in",
    ms: "ms",
    zh: "zh",
    th: "th",
    vi: "vi",
    fr: "fr",
    es: "es",
};

function fromDeviceTag(tag: string | null | undefined): TranslationLanguage | null {
    if (!tag) return null;
    const lower = tag.toLowerCase();
    // Every Chinese tag means the same bubble to us: we translate into
    // Simplified and do not ask a learner to pick a script.
    if (lower === "zh" || lower.startsWith("zh-")) return "zh";
    const base = lower.split(/[-_]/)[0];
    return DEVICE_LANGUAGES[base] ?? null;
}

/**
 * Best guess to pre-select on the onboarding screen; null when there is none.
 *
 * The app's own locale comes first: a learner who already switched the app to
 * Tamil has told us something deliberate. Failing that we read the phone's
 * language list, which is usually right and costs the learner nothing when it
 * is not, since the screen still asks.
 */
export function suggestFirstLanguage(): TranslationLanguage | null {
    const locale = getLocale();
    if (isTranslationLanguage(locale)) return locale;
    try {
        for (const device of getLocales()) {
            const match = fromDeviceTag(device.languageCode) ?? fromDeviceTag(device.languageTag);
            if (match) return match;
        }
    } catch {
        // A device that will not say what language it is in is not a reason to
        // fail the onboarding screen; it just gets no pre-selection.
    }
    return null;
}
