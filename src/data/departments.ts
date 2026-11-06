export interface DepartmentItem {
  id: string;
  nameAr: string;
  domain: 'education' | 'sharia';
  keywords: string[];
  keywordsEn: string[]; // مصطلحات إنجليزية لمطابقة الأبحاث الإنجليزية
}

export const ALL_DEPARTMENTS: DepartmentItem[] = [
  // أقسام التربية
  { id: 'curricula', nameAr: 'المناهج وطرق التدريس', domain: 'education', keywords: ['مناهج', 'طرق تدريس', 'استراتيجيات', 'تحصيل', 'المنهج', 'التدريس', 'استراتيجية تدريس'], keywordsEn: ['curriculum', 'curricula', 'teaching methods', 'instructional', 'pedagogy', 'academic achievement'] },
  { id: 'foundations', nameAr: 'أصول التربية والسياسات', domain: 'education', keywords: ['أصول التربية', 'فلسفة التربية', 'التنشئة', 'المجتمع', 'الفكر التربوي', 'السياسة التعليمية', 'علم اجتماع التربية'], keywordsEn: ['foundations of education', 'philosophy of education', 'educational policy', 'sociology of education'] },
  { id: 'psychology', nameAr: 'علم النفس التربوي والصحة النفسية', domain: 'education', keywords: ['علم النفس', 'صحة نفسية', 'ذكاء وجداني', 'قلق', 'نفسي', 'نفسية', 'الصحة النفسية'], keywordsEn: ['educational psychology', 'mental health', 'psychological', 'emotional intelligence', 'anxiety'] },
  { id: 'special_edu', nameAr: 'التربية الخاصة وصعوبات التعلم', domain: 'education', keywords: ['صعوبات التعلم', 'تربية خاصة', 'توحد', 'موهوبين', 'ذوي الاحتياجات', 'إعاقة', 'اضطراب طيف التوحد', 'الدمج', 'موهوب'], keywordsEn: ['learning disabilit', 'special education', 'autism', 'gifted', 'disabilit', 'inclusion', 'inclusive education'] },
  { id: 'technology', nameAr: 'تكنولوجيا التعليم والتعليم الرقمي', domain: 'education', keywords: ['تكنولوجيا التعليم', 'تعليم إلكتروني', 'منصات', 'ذكاء اصطناعي', 'التعلم عن بعد', 'الذكاء الاصطناعي', 'التعلم الرقمي', 'الحاسوب التعليمي'], keywordsEn: ['educational technology', 'e-learning', 'online learning', 'digital learning', 'artificial intelligence', 'mooc', 'learning platform', 'distance learning'] },
  { id: 'administration', nameAr: 'الإدارة التعليمية والمدرسية', domain: 'education', keywords: ['إدارة مدرسية', 'تخطيط تربوي', 'قيادة تعليمية', 'إدارة تعليمية', 'القيادة المدرسية', 'التخطيط التعليمي'], keywordsEn: ['school administration', 'educational administration', 'educational leadership', 'school leadership', 'educational planning'] },

  // أقسام العلوم الشرعية
  { id: 'fiqh', nameAr: 'الفقه الإسلامي والمقارن', domain: 'sharia', keywords: ['فقه', 'أحكام', 'معاملات مالية', 'مسائل فقهية', 'فقه النوازل', 'الفقه', 'فقهية', 'الفقه الإسلامي', 'فتوى'], keywordsEn: ['islamic jurisprudence', 'fiqh', 'islamic law', 'sharia', 'fatwa'] },
  { id: 'usul_fiqh', nameAr: 'أصول الفقه ومقاصد الشريعة', domain: 'sharia', keywords: ['أصول الفقه', 'مقاصد الشريعة', 'القواعد الفقهية', 'القياس', 'الأصول', 'المقاصد'], keywordsEn: ['usul al-fiqh', 'maqasid', 'objectives of sharia', 'legal maxims', 'islamic legal theory'] },
  { id: 'tafsir', nameAr: 'التفسير وعلوم القرآن', domain: 'sharia', keywords: ['تفسير', 'علوم القرآن', 'إعجاز القرآن', 'آيات الأحكام', 'القرآن', 'التفسير', 'قرآني', 'قرآنية'], keywordsEn: ['tafsir', 'quranic exegesis', 'quran', 'exegesis'] },
  { id: 'hadith', nameAr: 'الحديث الشريف وعلومه', domain: 'sharia', keywords: ['الحديث النبوي', 'الجرح والتعديل', 'علل الحديث', 'تخريج', 'الحديث', 'السنة النبوية', 'الإسناد', 'المحدثين'], keywordsEn: ['hadith', 'prophetic tradition', 'isnad'] },
  { id: 'aqeedah', nameAr: 'العقيدة والفلسفة الإسلامية', domain: 'sharia', keywords: ['العقيدة', 'علم الكلام', 'الفلسفة الإسلامية', 'الفرق والمذاهب', 'عقيدة', 'عقدي'], keywordsEn: ['islamic theology', 'kalam', 'islamic philosophy', 'aqidah'] },
  { id: 'dawah', nameAr: 'الدعوة والثقافة الإسلامية', domain: 'sharia', keywords: ['الدعوة الإسلامية', 'الخطاب الديني', 'الثقافة الإسلامية', 'الدعوة', 'دعاة'], keywordsEn: ['dawah', 'islamic preaching', 'islamic culture', 'religious discourse'] },
  { id: 'islamic_economy', nameAr: 'الاقتصاد والمصارف الإسلامية', domain: 'sharia', keywords: ['المصارف الإسلامية', 'الصكوك', 'التمويل الإسلامي', 'الزكاة', 'الاقتصاد الإسلامي'], keywordsEn: ['islamic banking', 'islamic finance', 'sukuk', 'zakat', 'islamic economics'] },
  { id: 'siyasah_shariyah', nameAr: 'السياسة الشرعية والقضاء الإسلامي', domain: 'sharia', keywords: ['السياسة الشرعية', 'القضاء في الإسلام', 'طرق الإثبات', 'القضاء', 'الإثبات', 'الحسبة'], keywordsEn: ['islamic political', 'siyasa shar', 'islamic judiciary', 'islamic law of evidence'] }
];
