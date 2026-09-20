import { useLocale } from "@/lib/i18n";
import { localized } from "@/lib/lessons/localized";
import type { Localized } from "@/lib/lessons/types";

import type { FirstLanguage } from "./languages";
import { useFirstLanguage } from "./store";

// English needs no copy of its own: the lessons are authored in it.
type ExtraLessonLanguage = Exclude<FirstLanguage, "bn" | "ta" | "hi" | "en">;

/** Home-card translations for languages not yet authored throughout the lessons. */
const HOME_LESSON_COPY: Record<ExtraLessonLanguage, Record<string, string>> = {
    te: {
        "Taking the MRT": "ఎంఆర్‌టీ ప్రయాణం",
        "Find the right platform, top up your card, and get off at the right stop.":
            "సరైన ప్లాట్‌ఫారమ్‌ను కనుగొని, మీ కార్డుకు డబ్బు టాప్ అప్ చేసి, సరైన స్టాప్‌లో దిగండి.",
        "Buying food": "ఆహారం కొనడం",
        "Order at a food stall, ask the price, and say how you want it.":
            "ఆహార దుకాణంలో ఆర్డర్ చేసి, ధర అడిగి, మీకు ఎలా కావాలో చెప్పండి.",
        "Seeing a doctor": "డాక్టర్‌ను కలవడం",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "మీ సమస్యను చెప్పి, ఎంసీ అడిగి, మందు ఎలా తీసుకోవాలో తెలుసుకోండి.",
        "At work": "పని వద్ద",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "సూపర్‌వైజర్‌ను మళ్లీ చెప్పమని అడిగి, ఏదైనా సురక్షితం కాకపోతే చెప్పి, సెలవు అడగండి.",
        "Daily mix": "రోజువారీ మిశ్రమం",
        "A quick practice with words from every lesson. New every day.":
            "ప్రతి పాఠంలోని పదాలతో చిన్న అభ్యాసం. ప్రతిరోజూ కొత్తది.",
    },
    ml: {
        "Taking the MRT": "എംആർടി യാത്ര",
        "Find the right platform, top up your card, and get off at the right stop.":
            "ശരിയായ പ്ലാറ്റ്ഫോം കണ്ടെത്തുക, കാർഡിൽ പണം നിറയ്ക്കുക, ശരിയായ സ്റ്റോപ്പിൽ ഇറങ്ങുക.",
        "Buying food": "ഭക്ഷണം വാങ്ങൽ",
        "Order at a food stall, ask the price, and say how you want it.":
            "ഭക്ഷണക്കടയിൽ ഓർഡർ ചെയ്യുക, വില ചോദിക്കുക, എങ്ങനെ വേണമെന്ന് പറയുക.",
        "Seeing a doctor": "ഡോക്ടറെ കാണൽ",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "എന്താണ് പ്രശ്നമെന്ന് പറയുക, എംസി ചോദിക്കുക, മരുന്ന് എങ്ങനെ കഴിക്കണമെന്ന് മനസ്സിലാക്കുക.",
        "At work": "ജോലിസ്ഥലത്ത്",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "വീണ്ടും പറയാൻ സൂപ്പർവൈസറോട് ആവശ്യപ്പെടുക, സുരക്ഷിതമല്ലെങ്കിൽ പറയുക, അവധി ചോദിക്കുക.",
        "Daily mix": "ദൈനംദിന മിശ്ര പരിശീലനം",
        "A quick practice with words from every lesson. New every day.":
            "എല്ലാ പാഠങ്ങളിലെയും വാക്കുകൾ ഉപയോഗിച്ചുള്ള ചെറിയ പരിശീലനം. എല്ലാ ദിവസവും പുതിയത്.",
    },
    bu: {
        "Taking the MRT": "MRT စီးခြင်း",
        "Find the right platform, top up your card, and get off at the right stop.":
            "မှန်ကန်သော ပလက်ဖောင်းကို ရှာပါ၊ ကတ်ထဲ ငွေဖြည့်ပါ၊ မှန်ကန်သော မှတ်တိုင်တွင် ဆင်းပါ။",
        "Buying food": "အစားအစာ ဝယ်ခြင်း",
        "Order at a food stall, ask the price, and say how you want it.":
            "အစားအသောက်ဆိုင်တွင် မှာယူပါ၊ ဈေးနှုန်းမေးပါ၊ မည်သို့လိုချင်ကြောင်း ပြောပါ။",
        "Seeing a doctor": "ဆရာဝန်နှင့် ပြသခြင်း",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "ဘာဖြစ်နေကြောင်း ပြောပါ၊ MC တောင်းပါ၊ ဆေးကို မည်သို့သောက်ရမည်ကို နားလည်ပါ။",
        "At work": "အလုပ်ခွင်တွင်",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "ကြီးကြပ်သူကို ထပ်ပြောရန် မေးပါ၊ မလုံခြုံသည့်အခါ ပြောပါ၊ ခွင့်တစ်ရက် တောင်းပါ။",
        "Daily mix": "နေ့စဉ် ရောနှောလေ့ကျင့်မှု",
        "A quick practice with words from every lesson. New every day.":
            "သင်ခန်းစာတိုင်းမှ စကားလုံးများဖြင့် အမြန်လေ့ကျင့်ပါ။ နေ့တိုင်း အသစ်ဖြစ်သည်။",
    },
    fi: {
        "Taking the MRT": "Pagsakay sa MRT",
        "Find the right platform, top up your card, and get off at the right stop.":
            "Hanapin ang tamang platform, lagyan ng pera ang iyong card, at bumaba sa tamang hintuan.",
        "Buying food": "Pagbili ng pagkain",
        "Order at a food stall, ask the price, and say how you want it.":
            "Umorder sa puwesto ng pagkain, itanong ang presyo, at sabihin kung paano mo ito gusto.",
        "Seeing a doctor": "Pagpunta sa doktor",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "Sabihin ang nararamdaman mo, humingi ng MC, at unawain kung paano inumin ang gamot.",
        "At work": "Sa trabaho",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "Hilingin sa supervisor na ulitin, sabihin kapag hindi ligtas, at humingi ng isang araw na pahinga.",
        "Daily mix": "Araw-araw na halo",
        "A quick practice with words from every lesson. New every day.":
            "Mabilis na pagsasanay gamit ang mga salita sa bawat aralin. Bago araw-araw.",
    },
    in: {
        "Taking the MRT": "Naik MRT",
        "Find the right platform, top up your card, and get off at the right stop.":
            "Temukan peron yang tepat, isi saldo kartu, dan turun di halte yang tepat.",
        "Buying food": "Membeli makanan",
        "Order at a food stall, ask the price, and say how you want it.":
            "Pesan di warung makan, tanyakan harganya, dan katakan bagaimana Anda menginginkannya.",
        "Seeing a doctor": "Pergi ke dokter",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "Jelaskan keluhan Anda, minta MC, dan pahami cara minum obat.",
        "At work": "Di tempat kerja",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "Minta supervisor mengulanginya, katakan jika sesuatu tidak aman, dan minta cuti sehari.",
        "Daily mix": "Latihan campuran harian",
        "A quick practice with words from every lesson. New every day.":
            "Latihan singkat dengan kata-kata dari setiap pelajaran. Baru setiap hari.",
    },
    ms: {
        "Taking the MRT": "Menaiki MRT",
        "Find the right platform, top up your card, and get off at the right stop.":
            "Cari platform yang betul, tambah nilai kad anda, dan turun di hentian yang betul.",
        "Buying food": "Membeli makanan",
        "Order at a food stall, ask the price, and say how you want it.":
            "Pesan di gerai makanan, tanya harganya, dan beritahu cara yang anda mahukan.",
        "Seeing a doctor": "Berjumpa doktor",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "Beritahu masalah anda, minta MC, dan fahami cara mengambil ubat.",
        "At work": "Di tempat kerja",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "Minta penyelia mengulanginya, beritahu apabila sesuatu tidak selamat, dan minta cuti sehari.",
        "Daily mix": "Latihan campuran harian",
        "A quick practice with words from every lesson. New every day.":
            "Latihan ringkas dengan perkataan daripada setiap pelajaran. Baharu setiap hari.",
    },
    zh: {
        "Taking the MRT": "乘搭地铁",
        "Find the right platform, top up your card, and get off at the right stop.":
            "找到正确的站台，为交通卡充值，并在正确的车站下车。",
        "Buying food": "购买食物",
        "Order at a food stall, ask the price, and say how you want it.":
            "在食摊点餐、询问价格，并说明您想要的做法。",
        "Seeing a doctor": "看医生",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "说明哪里不舒服、索取病假单，并了解如何服药。",
        "At work": "在工作中",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "请主管再说一遍，发现不安全时说出来，并申请一天休假。",
        "Daily mix": "每日综合练习",
        "A quick practice with words from every lesson. New every day.":
            "快速练习每节课的单词。每天都有新内容。",
    },
    th: {
        "Taking the MRT": "การโดยสาร MRT",
        "Find the right platform, top up your card, and get off at the right stop.":
            "หาชานชาลาที่ถูกต้อง เติมเงินในบัตร และลงที่สถานีที่ถูกต้อง",
        "Buying food": "การซื้ออาหาร",
        "Order at a food stall, ask the price, and say how you want it.":
            "สั่งอาหารที่ร้าน ถามราคา และบอกว่าคุณต้องการแบบไหน",
        "Seeing a doctor": "การไปพบแพทย์",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "บอกอาการ ขอใบรับรองแพทย์ และเข้าใจวิธีใช้ยา",
        "At work": "ที่ทำงาน",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "ขอให้หัวหน้างานพูดอีกครั้ง บอกเมื่อมีสิ่งที่ไม่ปลอดภัย และขอวันหยุด",
        "Daily mix": "แบบฝึกผสมประจำวัน",
        "A quick practice with words from every lesson. New every day.":
            "ฝึกสั้น ๆ ด้วยคำจากทุกบทเรียน มีเนื้อหาใหม่ทุกวัน",
    },
    vi: {
        "Taking the MRT": "Đi tàu MRT",
        "Find the right platform, top up your card, and get off at the right stop.":
            "Tìm đúng sân ga, nạp tiền vào thẻ và xuống đúng trạm.",
        "Buying food": "Mua đồ ăn",
        "Order at a food stall, ask the price, and say how you want it.":
            "Gọi món tại quầy, hỏi giá và nói cách bạn muốn món ăn được chuẩn bị.",
        "Seeing a doctor": "Đi khám bác sĩ",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "Nói vấn đề của bạn, xin giấy nghỉ bệnh và hiểu cách dùng thuốc.",
        "At work": "Tại nơi làm việc",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "Nhờ quản lý nói lại, báo khi có điều không an toàn và xin nghỉ một ngày.",
        "Daily mix": "Bài luyện tập hằng ngày",
        "A quick practice with words from every lesson. New every day.":
            "Luyện nhanh các từ trong mọi bài học. Nội dung mới mỗi ngày.",
    },
    fr: {
        "Taking the MRT": "Prendre le MRT",
        "Find the right platform, top up your card, and get off at the right stop.":
            "Trouvez le bon quai, rechargez votre carte et descendez au bon arrêt.",
        "Buying food": "Acheter à manger",
        "Order at a food stall, ask the price, and say how you want it.":
            "Commandez à un stand de nourriture, demandez le prix et dites comment vous le voulez.",
        "Seeing a doctor": "Voir un médecin",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "Dites ce qui ne va pas, demandez un certificat médical (MC) et comprenez comment prendre vos médicaments.",
        "At work": "Au travail",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "Demandez à votre superviseur de répéter, dites quand quelque chose n'est pas sûr et demandez un jour de congé.",
        "Daily mix": "Mélange du jour",
        "A quick practice with words from every lesson. New every day.":
            "Un entraînement rapide avec les mots de toutes les leçons. Nouveau chaque jour.",
    },
    es: {
        "Taking the MRT": "Viajar en el MRT",
        "Find the right platform, top up your card, and get off at the right stop.":
            "Encuentra el andén correcto, recarga tu tarjeta y bájate en la parada correcta.",
        "Buying food": "Comprar comida",
        "Order at a food stall, ask the price, and say how you want it.":
            "Pide en un puesto de comida, pregunta el precio y di cómo lo quieres.",
        "Seeing a doctor": "Ir al médico",
        "Say what is wrong, ask for an MC, and understand how to take your medicine.":
            "Di qué te pasa, pide un certificado médico (MC) y entiende cómo tomar tu medicina.",
        "At work": "En el trabajo",
        "Ask your supervisor to say it again, say when something is not safe, and ask for a day off.":
            "Pide a tu supervisor que lo repita, avisa cuando algo no es seguro y pide un día libre.",
        "Daily mix": "Mezcla diaria",
        "A quick practice with words from every lesson. New every day.":
            "Una práctica rápida con palabras de todas las lecciones. Nueva cada día.",
    },
};

function hasExtraCopy(language: FirstLanguage): language is ExtraLessonLanguage {
    return language in HOME_LESSON_COPY;
}

/** Resolve a Home lesson title or description in the learner's first language. */
export function useHomeLessonCopy() {
    const [firstLanguage] = useFirstLanguage();
    const [locale] = useLocale();
    return (value: Localized) => {
        const language = firstLanguage ?? locale;
        if (firstLanguage && hasExtraCopy(firstLanguage)) {
            return HOME_LESSON_COPY[firstLanguage][value.en] ?? value.en;
        }
        return localized(value, language);
    };
}
