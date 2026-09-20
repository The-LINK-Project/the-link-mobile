import { useEffect, useMemo } from "react";

import i18n, { getLocale, LOCALES, setLocale, useTranslations, type Locale } from "@/lib/i18n";

import type { FirstLanguage } from "./languages";
import { useFirstLanguage } from "./store";

type InterfaceNamespace = "account" | "foundation" | "lessons" | "speaking";
type ExtraInterfaceLanguage = "te" | "ml" | "ms" | "zh" | "th" | "vi";

// These languages are offered for word translation but do not yet have a full
// app catalogue. Home and Account are the first screens a learner sees, so
// keep their navigation and status copy in the learner's language rather than
// dropping back to English. Lesson titles and goals remain authored content
// and continue to use the existing lesson-language fallback rules.
const EXTRA_INTERFACE_COPY: Record<
    ExtraInterfaceLanguage,
    Record<InterfaceNamespace, Record<string, string>>
> = {
    te: {
        foundation: {
            home: "హోమ్",
            welcome: "LINKకి స్వాగతం",
            lessonsTitle: "పాఠాలు",
            lessonsBody:
                "ప్రారంభించడానికి ఒక పాఠాన్ని నొక్కండి. ప్రతి పాఠానికి సుమారు 5 నిమిషాలు పడుతుంది.",
            practiceTitle: "త్వరిత అభ్యాసం",
            empty: "మీ పాఠాలు",
            emptyBody: "కొత్త పాఠాలు త్వరలో ఇక్కడ కనిపిస్తాయి.",
            syncError:
                "మీ ఖాతాను లోడ్ చేయలేకపోయాం. మీ ఇంటర్నెట్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.",
            sharedAccount: "మీ ప్రొఫైల్ మరియు పాస్‌వర్డ్ LINK వెబ్‌సైట్‌లో కూడా ఒకటే.",
            contact: "మమ్మల్ని సంప్రదించండి",
            signOutError: "సైన్ అవుట్ చేయలేకపోయాం. మళ్లీ ప్రయత్నించండి.",
        },
        account: {
            title: "ఖాతా",
            myLanguage: "నా భాష",
            myLanguageHint: "ఏదైనా ఇంగ్లీష్ పదాన్ని నొక్కి ఉంచి, ఈ భాషలో చూడండి.",
            signOut: "సైన్ అవుట్",
            privacy: "గోప్యత",
            deleteAccount: "ఖాతాను తొలగించండి",
            about: "మా గురించి",
            editProfile: "ప్రొఫైల్ మార్చండి",
            changePassword: "పాస్‌వర్డ్ మార్చండి",
        },
        lessons: {
            progress: "పాఠం పురోగతి",
            quit: "పాఠాన్ని మూసివేయండి",
            play: "వినండి",
            playSlow: "నెమ్మదిగా",
            tapToListen: "వినడానికి నొక్కండి",
            check: "తనిఖీ చేయండి",
            continue: "కొనసాగించండి",
            gotIt: "సరే",
            finish: "ముగించండి",
            introTitle: "ఈ పాఠంలోని పదాలు",
            introBody: "వినడానికి ఒక పదాన్ని నొక్కండి. సిద్ధమైనప్పుడు ప్రారంభించండి.",
            introStart: "ప్రారంభించండి",
            minutes: "{count} నిమి",
            "level.beginner": "ప్రారంభం",
            "level.intermediate": "మధ్యస్థం",
            statusStarted: "{total}లో {done} పూర్తయ్యాయి",
            statusLearned: "పూర్తయింది",
            statusSpoken: "పూర్తయింది, మాట్లాడడం కూడా",
            statusNext: "ఇక్కడ ప్రారంభించండి",
            summarySpeak: "మాట్లాడటం అభ్యసించండి",
            continueTitle: "కొనసాగించండి",
            continueTalk: "మాట్లాడటం: {total}లో {done} పూర్తయ్యాయి",
            doneCount: "పూర్తయిన పాఠాలు: {total}లో {done}",
            mixDoneToday: "ఈరోజు పూర్తయింది",
        },
        speaking: {
            close: "మాట్లాడే అభ్యాసాన్ని మూసివేయండి",
            title: "మాట్లాడటం అభ్యసించండి",
            intro: "ఒక ట్యూటర్ మీ భాషలో మాట్లాడతారు. ట్యూటర్ అడిగినప్పుడు ఇంగ్లీష్‌ను బిగ్గరగా చెప్పండి.",
            language: "మీరు ఏ భాష మాట్లాడతారు?",
            chooseLanguage: "ముందుగా మీ భాషను ఎంచుకోండి",
            youWillSay: "మీరు ఇవి చెప్పడం అభ్యసిస్తారు:",
            privacy:
                "ట్యూటర్ మీ మాట వినడానికి మీ స్వరం Google యొక్క Gemini AIకి పంపబడుతుంది. The LINK Project మీ రికార్డింగ్‌లను నిల్వ చేయదు.",
            data: "ఇది మొబైల్ డేటాను ఉపయోగిస్తుంది. Wi-Fi ఉత్తమం.",
            start: "ప్రారంభించండి",
            micBlocked:
                "ఈ యాప్‌కు మైక్రోఫోన్ ఆఫ్‌లో ఉంది. మాట్లాడటం అభ్యసించడానికి Settingsలో దాన్ని ఆన్ చేయండి.",
            openSettings: "Settings తెరవండి",
            nothingToPractise: "ఈ పాఠంలో ఇంకా మాట్లాడే అభ్యాసం లేదు.",
        },
    },
    ml: {
        foundation: {
            home: "ഹോം",
            welcome: "LINK-ലേക്ക് സ്വാഗതം",
            lessonsTitle: "പാഠങ്ങൾ",
            lessonsBody:
                "തുടങ്ങാൻ ഒരു പാഠത്തിൽ ടാപ്പ് ചെയ്യുക. ഓരോ പാഠത്തിനും ഏകദേശം 5 മിനിറ്റ് എടുക്കും.",
            practiceTitle: "വേഗത്തിലുള്ള പരിശീലനം",
            empty: "നിങ്ങളുടെ പാഠങ്ങൾ",
            emptyBody: "പുതിയ പാഠങ്ങൾ ഉടൻ ഇവിടെ കാണാം.",
            syncError:
                "നിങ്ങളുടെ അക്കൗണ്ട് ലോഡ് ചെയ്യാനായില്ല. ഇന്റർനെറ്റ് പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.",
            sharedAccount: "നിങ്ങളുടെ പ്രൊഫൈലും പാസ്‌വേഡും LINK വെബ്‌സൈറ്റിലും ഒന്നുതന്നെയാണ്.",
            contact: "ഞങ്ങളെ ബന്ധപ്പെടുക",
            signOutError: "സൈൻ ഔട്ട് ചെയ്യാനായില്ല. വീണ്ടും ശ്രമിക്കുക.",
        },
        account: {
            title: "അക്കൗണ്ട്",
            myLanguage: "എന്റെ ഭാഷ",
            myLanguageHint: "ഏതെങ്കിലും ഇംഗ്ലീഷ് വാക്കിൽ അമർത്തിപ്പിടിച്ച് ഈ ഭാഷയിൽ കാണുക.",
            signOut: "സൈൻ ഔട്ട്",
            privacy: "സ്വകാര്യത",
            deleteAccount: "അക്കൗണ്ട് ഇല്ലാതാക്കുക",
            about: "ഞങ്ങളെക്കുറിച്ച്",
            editProfile: "പ്രൊഫൈൽ തിരുത്തുക",
            changePassword: "പാസ്‌വേഡ് മാറ്റുക",
        },
        lessons: {
            progress: "പാഠത്തിന്റെ പുരോഗതി",
            quit: "പാഠം അടയ്ക്കുക",
            play: "കേൾക്കുക",
            playSlow: "പതുക്കെ",
            tapToListen: "കേൾക്കാൻ ടാപ്പ് ചെയ്യുക",
            check: "പരിശോധിക്കുക",
            continue: "തുടരുക",
            gotIt: "ശരി",
            finish: "പൂർത്തിയാക്കുക",
            introTitle: "ഈ പാഠത്തിലെ വാക്കുകൾ",
            introBody: "കേൾക്കാൻ ഒരു വാക്കിൽ ടാപ്പ് ചെയ്യുക. തയ്യാറാകുമ്പോൾ തുടങ്ങുക.",
            introStart: "തുടങ്ങുക",
            minutes: "{count} മിനിറ്റ്",
            "level.beginner": "തുടക്കക്കാരൻ",
            "level.intermediate": "ഇടത്തരം",
            statusStarted: "{total}-ൽ {done} പൂർത്തിയായി",
            statusLearned: "പൂർത്തിയായി",
            statusSpoken: "പൂർത്തിയായി, സംസാരിച്ചും",
            statusNext: "ഇവിടെ തുടങ്ങുക",
            summarySpeak: "സംസാരം പരിശീലിക്കുക",
            continueTitle: "തുടരുക",
            continueTalk: "സംസാരം: {total}-ൽ {done} പൂർത്തിയായി",
            doneCount: "പൂർത്തിയായ പാഠങ്ങൾ: {total}-ൽ {done}",
            mixDoneToday: "ഇന്ന് പൂർത്തിയായി",
        },
        speaking: {
            close: "സംസാര പരിശീലനം അടയ്ക്കുക",
            title: "സംസാരം പരിശീലിക്കുക",
            intro: "ഒരു ട്യൂട്ടർ നിങ്ങളുടെ ഭാഷയിൽ സംസാരിക്കും. ട്യൂട്ടർ ചോദിക്കുമ്പോൾ ഇംഗ്ലീഷ് ഉറക്കെ പറയുക.",
            language: "നിങ്ങൾ ഏത് ഭാഷ സംസാരിക്കുന്നു?",
            chooseLanguage: "ആദ്യം നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക",
            youWillSay: "നിങ്ങൾ ഇവ പറയാൻ പരിശീലിക്കും:",
            privacy:
                "ട്യൂട്ടർക്ക് നിങ്ങളെ കേൾക്കാൻ നിങ്ങളുടെ ശബ്ദം Google-ന്റെ Gemini AI-ലേക്ക് അയയ്ക്കുന്നു. The LINK Project നിങ്ങളുടെ റെക്കോർഡിംഗുകൾ സൂക്ഷിക്കില്ല.",
            data: "ഇത് മൊബൈൽ ഡാറ്റ ഉപയോഗിക്കുന്നു. Wi-Fi ആണ് നല്ലത്.",
            start: "തുടങ്ങുക",
            micBlocked:
                "ഈ ആപ്പിന് മൈക്രോഫോൺ ഓഫ് ആണ്. സംസാര പരിശീലനത്തിന് Settings-ൽ അത് ഓൺ ചെയ്യുക.",
            openSettings: "Settings തുറക്കുക",
            nothingToPractise: "ഈ പാഠത്തിൽ ഇപ്പോൾ സംസാരിക്കാൻ ഒന്നുമില്ല.",
        },
    },
    ms: {
        foundation: {
            home: "Laman utama",
            welcome: "Selamat datang ke LINK",
            lessonsTitle: "Pelajaran",
            lessonsBody: "Tekan pelajaran untuk mula. Setiap satu mengambil kira-kira 5 minit.",
            practiceTitle: "Latihan pantas",
            empty: "Pelajaran anda",
            emptyBody: "Pelajaran baharu akan muncul di sini tidak lama lagi.",
            syncError:
                "Kami tidak dapat memuatkan akaun anda. Periksa internet anda dan cuba lagi.",
            sharedAccount: "Profil dan kata laluan anda sama di laman web LINK.",
            contact: "Hubungi kami",
            signOutError: "Tidak dapat log keluar. Cuba lagi.",
        },
        account: {
            title: "Akaun",
            myLanguage: "Bahasa saya",
            myLanguageHint:
                "Tekan dan tahan mana-mana perkataan Inggeris untuk melihatnya dalam bahasa ini.",
            signOut: "Log keluar",
            privacy: "Privasi",
            deleteAccount: "Padam akaun",
            about: "Tentang kami",
            editProfile: "Edit profil",
            changePassword: "Tukar kata laluan",
        },
        lessons: {
            progress: "Kemajuan pelajaran",
            quit: "Tutup pelajaran",
            play: "Dengar",
            playSlow: "Lebih perlahan",
            tapToListen: "Tekan untuk dengar",
            check: "Semak",
            continue: "Teruskan",
            gotIt: "Baik",
            finish: "Selesai",
            introTitle: "Perkataan dalam pelajaran ini",
            introBody: "Tekan perkataan untuk mendengarnya. Mula apabila anda bersedia.",
            introStart: "Mula",
            minutes: "{count} min",
            "level.beginner": "Pemula",
            "level.intermediate": "Pertengahan",
            statusStarted: "{done} daripada {total} selesai",
            statusLearned: "Selesai",
            statusSpoken: "Selesai dan dipraktikkan",
            statusNext: "Mulakan di sini",
            summarySpeak: "Latih bercakap",
            continueTitle: "Sambung",
            continueTalk: "Bercakap: {done} daripada {total} selesai",
            doneCount: "Pelajaran selesai: {done} daripada {total}",
            mixDoneToday: "Selesai hari ini",
        },
        speaking: {
            close: "Tutup latihan bercakap",
            title: "Latih bercakap",
            intro: "Tutor akan bercakap dengan anda dalam bahasa anda. Apabila tutor bertanya, sebut bahasa Inggeris dengan kuat.",
            language: "Bahasa apa yang anda tuturkan?",
            chooseLanguage: "Pilih bahasa anda dahulu",
            youWillSay: "Anda akan berlatih menyebut:",
            privacy:
                "Suara anda dihantar kepada Gemini AI Google supaya tutor boleh mendengar anda. The LINK Project tidak menyimpan rakaman anda.",
            data: "Ini menggunakan data mudah alih. Wi-Fi adalah terbaik.",
            start: "Mula",
            micBlocked:
                "Mikrofon dimatikan untuk aplikasi ini. Hidupkannya dalam Tetapan untuk berlatih bercakap.",
            openSettings: "Buka Tetapan",
            nothingToPractise: "Belum ada latihan bercakap dalam pelajaran ini.",
        },
    },
    zh: {
        foundation: {
            home: "首页",
            welcome: "欢迎来到 LINK",
            lessonsTitle: "课程",
            lessonsBody: "点击课程开始。每节课大约需要 5 分钟。",
            practiceTitle: "快速练习",
            empty: "您的课程",
            emptyBody: "新课程很快会显示在这里。",
            syncError: "无法加载您的账户。请检查网络后重试。",
            sharedAccount: "您的个人资料和密码与 LINK 网站相同。",
            contact: "联系我们",
            signOutError: "无法退出登录。请重试。",
        },
        account: {
            title: "账户",
            myLanguage: "我的语言",
            myLanguageHint: "长按任何英文单词，即可用此语言查看它。",
            signOut: "退出登录",
            privacy: "隐私",
            deleteAccount: "删除账户",
            about: "关于我们",
            editProfile: "编辑个人资料",
            changePassword: "更改密码",
        },
        lessons: {
            progress: "课程进度",
            quit: "关闭课程",
            play: "听一听",
            playSlow: "慢速播放",
            tapToListen: "点击收听",
            check: "检查",
            continue: "继续",
            gotIt: "知道了",
            finish: "完成",
            introTitle: "本课单词",
            introBody: "点击单词即可收听。准备好后开始。",
            introStart: "开始",
            minutes: "{count} 分钟",
            "level.beginner": "初级",
            "level.intermediate": "中级",
            statusStarted: "已完成 {done}/{total}",
            statusLearned: "已完成",
            statusSpoken: "已完成，也练习了口语",
            statusNext: "从这里开始",
            summarySpeak: "练习说话",
            continueTitle: "继续",
            continueTalk: "口语：已完成 {done}/{total}",
            doneCount: "已完成课程：{done}/{total}",
            mixDoneToday: "今天已完成",
        },
        speaking: {
            close: "关闭口语练习",
            title: "练习口语",
            intro: "导师会用您的语言与您交谈。导师提问时，请大声说出英语。",
            language: "您说哪种语言？",
            chooseLanguage: "请先选择您的语言",
            youWillSay: "您将练习说：",
            privacy:
                "您的语音会发送给 Google 的 Gemini AI，以便导师听到您的声音。The LINK Project 不会保存您的录音。",
            data: "这会使用移动数据。建议使用 Wi-Fi。",
            start: "开始",
            micBlocked: "此应用的麦克风已关闭。请在设置中开启，以练习口语。",
            openSettings: "打开设置",
            nothingToPractise: "本课暂时没有可练习的口语内容。",
        },
    },
    th: {
        foundation: {
            home: "หน้าแรก",
            welcome: "ยินดีต้อนรับสู่ LINK",
            lessonsTitle: "บทเรียน",
            lessonsBody: "แตะบทเรียนเพื่อเริ่ม แต่ละบทใช้เวลาประมาณ 5 นาที",
            practiceTitle: "ฝึกเร็ว",
            empty: "บทเรียนของคุณ",
            emptyBody: "บทเรียนใหม่จะปรากฏที่นี่เร็ว ๆ นี้",
            syncError: "เราโหลดบัญชีของคุณไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง",
            sharedAccount: "โปรไฟล์และรหัสผ่านของคุณเหมือนกับในเว็บไซต์ LINK",
            contact: "ติดต่อเรา",
            signOutError: "ออกจากระบบไม่ได้ โปรดลองอีกครั้ง",
        },
        account: {
            title: "บัญชี",
            myLanguage: "ภาษาของฉัน",
            myLanguageHint: "กดค้างที่คำภาษาอังกฤษเพื่อดูคำในภาษานี้",
            signOut: "ออกจากระบบ",
            privacy: "ความเป็นส่วนตัว",
            deleteAccount: "ลบบัญชี",
            about: "เกี่ยวกับเรา",
            editProfile: "แก้ไขโปรไฟล์",
            changePassword: "เปลี่ยนรหัสผ่าน",
        },
        lessons: {
            progress: "ความคืบหน้าของบทเรียน",
            quit: "ปิดบทเรียน",
            play: "ฟัง",
            playSlow: "ช้าลง",
            tapToListen: "แตะเพื่อฟัง",
            check: "ตรวจคำตอบ",
            continue: "ทำต่อ",
            gotIt: "ตกลง",
            finish: "เสร็จสิ้น",
            introTitle: "คำศัพท์ในบทเรียนนี้",
            introBody: "แตะคำเพื่อฟัง เริ่มเมื่อคุณพร้อม",
            introStart: "เริ่ม",
            minutes: "{count} นาที",
            "level.beginner": "เริ่มต้น",
            "level.intermediate": "ระดับกลาง",
            statusStarted: "เสร็จแล้ว {done} จาก {total}",
            statusLearned: "เสร็จแล้ว",
            statusSpoken: "เสร็จแล้วและฝึกพูดแล้ว",
            statusNext: "เริ่มที่นี่",
            summarySpeak: "ฝึกพูด",
            continueTitle: "ทำต่อ",
            continueTalk: "การพูด: เสร็จแล้ว {done} จาก {total}",
            doneCount: "บทเรียนที่เสร็จ: {done} จาก {total}",
            mixDoneToday: "เสร็จแล้ววันนี้",
        },
        speaking: {
            close: "ปิดการฝึกพูด",
            title: "ฝึกพูด",
            intro: "ผู้สอนจะพูดกับคุณเป็นภาษาของคุณ เมื่อผู้สอนถาม ให้พูดภาษาอังกฤษออกมาดัง ๆ",
            language: "คุณพูดภาษาอะไร?",
            chooseLanguage: "เลือกภาษาของคุณก่อน",
            youWillSay: "คุณจะฝึกพูดว่า:",
            privacy:
                "เสียงของคุณจะถูกส่งไปยัง Gemini AI ของ Google เพื่อให้ผู้สอนได้ยินคุณ The LINK Project จะไม่เก็บเสียงบันทึกของคุณ",
            data: "การทำงานนี้ใช้ข้อมูลมือถือ ควรใช้ Wi-Fi",
            start: "เริ่ม",
            micBlocked: "ไมโครโฟนถูกปิดสำหรับแอปนี้ เปิดในการตั้งค่าเพื่อฝึกพูด",
            openSettings: "เปิดการตั้งค่า",
            nothingToPractise: "ยังไม่มีเนื้อหาให้ฝึกพูดในบทเรียนนี้",
        },
    },
    vi: {
        foundation: {
            home: "Trang chủ",
            welcome: "Chào mừng đến với LINK",
            lessonsTitle: "Bài học",
            lessonsBody: "Chạm vào bài học để bắt đầu. Mỗi bài mất khoảng 5 phút.",
            practiceTitle: "Luyện nhanh",
            empty: "Bài học của bạn",
            emptyBody: "Bài học mới sẽ sớm xuất hiện ở đây.",
            syncError: "Không thể tải tài khoản của bạn. Kiểm tra mạng và thử lại.",
            sharedAccount: "Hồ sơ và mật khẩu của bạn giống với trên trang web LINK.",
            contact: "Liên hệ chúng tôi",
            signOutError: "Không thể đăng xuất. Hãy thử lại.",
        },
        account: {
            title: "Tài khoản",
            myLanguage: "Ngôn ngữ của tôi",
            myLanguageHint: "Nhấn giữ bất kỳ từ tiếng Anh nào để xem bằng ngôn ngữ này.",
            signOut: "Đăng xuất",
            privacy: "Quyền riêng tư",
            deleteAccount: "Xóa tài khoản",
            about: "Về chúng tôi",
            editProfile: "Chỉnh sửa hồ sơ",
            changePassword: "Đổi mật khẩu",
        },
        lessons: {
            progress: "Tiến độ bài học",
            quit: "Đóng bài học",
            play: "Nghe",
            playSlow: "Chậm hơn",
            tapToListen: "Chạm để nghe",
            check: "Kiểm tra",
            continue: "Tiếp tục",
            gotIt: "Đã hiểu",
            finish: "Hoàn thành",
            introTitle: "Từ trong bài học này",
            introBody: "Chạm vào một từ để nghe. Bắt đầu khi bạn sẵn sàng.",
            introStart: "Bắt đầu",
            minutes: "{count} phút",
            "level.beginner": "Mới bắt đầu",
            "level.intermediate": "Trung cấp",
            statusStarted: "Đã xong {done}/{total}",
            statusLearned: "Đã xong",
            statusSpoken: "Đã xong và đã luyện nói",
            statusNext: "Bắt đầu ở đây",
            summarySpeak: "Luyện nói",
            continueTitle: "Tiếp tục",
            continueTalk: "Nói: đã xong {done}/{total}",
            doneCount: "Bài đã xong: {done}/{total}",
            mixDoneToday: "Đã xong hôm nay",
        },
        speaking: {
            close: "Đóng phần luyện nói",
            title: "Luyện nói",
            intro: "Gia sư sẽ nói chuyện với bạn bằng ngôn ngữ của bạn. Khi gia sư hỏi, hãy nói tiếng Anh thành tiếng.",
            language: "Bạn nói ngôn ngữ nào?",
            chooseLanguage: "Hãy chọn ngôn ngữ của bạn trước",
            youWillSay: "Bạn sẽ luyện nói:",
            privacy:
                "Giọng nói của bạn được gửi đến Gemini AI của Google để gia sư có thể nghe bạn. The LINK Project không lưu bản ghi âm của bạn.",
            data: "Tính năng này dùng dữ liệu di động. Wi-Fi là tốt nhất.",
            start: "Bắt đầu",
            micBlocked: "Micrô đang tắt cho ứng dụng này. Hãy bật trong Cài đặt để luyện nói.",
            openSettings: "Mở Cài đặt",
            nothingToPractise: "Bài học này chưa có nội dung để luyện nói.",
        },
    },
};

/**
 * The app catalogue that goes with a first language: its own where the app is
 * written in it, and English for the six that only have the copy above.
 */
export function localeFor(language: FirstLanguage): Locale {
    return (LOCALES as readonly string[]).includes(language) ? (language as Locale) : "en";
}

/**
 * Keeps the app's locale in step with the learner's language.
 *
 * The locale still decides the screens this file does not cover (Privacy,
 * About, Contact, the profile forms), and used to be a second setting under
 * Account. The two drifted apart: a learner reading Home in Bengali would open
 * Privacy in whatever the other setting said. Mounted once, signed in, so a
 * choice arriving from the server moves the locale as well as one tapped here.
 */
export function useLocaleFollowsFirstLanguage() {
    const [language] = useFirstLanguage();
    useEffect(() => {
        if (language && getLocale() !== localeFor(language)) void setLocale(localeFor(language));
    }, [language]);
}

function isExtraInterfaceLanguage(value: string): value is ExtraInterfaceLanguage {
    return value in EXTRA_INTERFACE_COPY;
}

function interpolate(copy: string, options?: Record<string, unknown>) {
    return copy.replace(/\{(\w+)\}/g, (_, key: string) => String(options?.[key] ?? `{${key}}`));
}

/** Translation hook for the Home and Account interface. */
export function useFirstLanguageInterface(namespace: InterfaceNamespace) {
    const fallback = useTranslations(`mobile.${namespace}`);
    const [language] = useFirstLanguage();
    return useMemo(
        () => (key: string, options?: Record<string, unknown>) => {
            if (language && (LOCALES as readonly string[]).includes(language)) {
                return i18n.t(`mobile.${namespace}.${key}`, { locale: language, ...options });
            }
            const copy =
                language && isExtraInterfaceLanguage(language)
                    ? EXTRA_INTERFACE_COPY[language][namespace][key]
                    : undefined;
            return copy ? interpolate(copy, options) : fallback(key, options);
        },
        [fallback, language, namespace],
    );
}
