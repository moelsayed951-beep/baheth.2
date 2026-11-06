export interface UniversityItem {
  id: string;
  nameAr: string;
  // كلمات للمطابقة مع اسم الجهة كما يرد من المصادر (عربي/إنجليزي، حروف صغيرة)
  aliases: string[];
}

export const EGYPTIAN_UNIVERSITIES: UniversityItem[] = [
  { id: 'cairo', nameAr: 'جامعة القاهرة', aliases: ['cairo university', 'جامعة القاهرة'] },
  { id: 'ain_shams', nameAr: 'جامعة عين شمس', aliases: ['ain shams', 'عين شمس'] },
  { id: 'alexandria', nameAr: 'جامعة الإسكندرية', aliases: ['alexandria university', 'جامعة الاسكندرية', 'جامعة الإسكندرية'] },
  { id: 'azhar', nameAr: 'جامعة الأزهر', aliases: ['al-azhar', 'al azhar', 'azhar university', 'azhar univ', 'الأزهر', 'الازهر'] },
  { id: 'assiut', nameAr: 'جامعة أسيوط', aliases: ['assiut', 'asyut', 'أسيوط', 'اسيوط'] },
  { id: 'mansoura', nameAr: 'جامعة المنصورة', aliases: ['mansoura', 'المنصورة'] },
  { id: 'tanta', nameAr: 'جامعة طنطا', aliases: ['tanta', 'طنطا'] },
  { id: 'zagazig', nameAr: 'جامعة الزقازيق', aliases: ['zagazig', 'الزقازيق'] },
  { id: 'helwan', nameAr: 'جامعة حلوان', aliases: ['helwan', 'حلوان'] },
  { id: 'benha', nameAr: 'جامعة بنها', aliases: ['benha', 'banha', 'بنها'] },
  { id: 'minia', nameAr: 'جامعة المنيا', aliases: ['minia', 'minya', 'المنيا'] },
  { id: 'beni_suef', nameAr: 'جامعة بني سويف', aliases: ['beni-suef', 'beni suef', 'بني سويف'] },
  { id: 'fayoum', nameAr: 'جامعة الفيوم', aliases: ['fayoum', 'fayum', 'الفيوم'] },
  { id: 'sohag', nameAr: 'جامعة سوهاج', aliases: ['sohag', 'سوهاج'] },
  { id: 'south_valley', nameAr: 'جامعة جنوب الوادي', aliases: ['south valley', 'جنوب الوادي', 'qena'] },
  { id: 'suez_canal', nameAr: 'جامعة قناة السويس', aliases: ['suez canal', 'قناة السويس'] },
  { id: 'suez', nameAr: 'جامعة السويس', aliases: ['suez university', 'جامعة السويس'] },
  { id: 'menoufia', nameAr: 'جامعة المنوفية', aliases: ['menoufia', 'menofia', 'المنوفية'] },
  { id: 'kafrelsheikh', nameAr: 'جامعة كفر الشيخ', aliases: ['kafrelsheikh', 'kafr el-sheikh', 'kafr elsheikh', 'كفر الشيخ'] },
  { id: 'damietta', nameAr: 'جامعة دمياط', aliases: ['damietta', 'دمياط'] },
  { id: 'port_said', nameAr: 'جامعة بورسعيد', aliases: ['port said', 'بورسعيد'] },
  { id: 'aswan', nameAr: 'جامعة أسوان', aliases: ['aswan', 'أسوان', 'اسوان'] },
  { id: 'damanhour', nameAr: 'جامعة دمنهور', aliases: ['damanhour', 'دمنهور'] },
  { id: 'arish', nameAr: 'جامعة العريش', aliases: ['arish', 'العريش'] },
  { id: 'luxor', nameAr: 'جامعة الأقصر', aliases: ['luxor', 'الأقصر', 'الاقصر'] },
  { id: 'aucegypt', nameAr: 'الجامعة الأمريكية بالقاهرة', aliases: ['american university in cairo', 'الجامعة الأمريكية'] }
];

// يطابق اسم جهة مع قائمة الجامعات المصرية ويرجع المعرف أو undefined
export function matchUniversity(text?: string): string | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  return EGYPTIAN_UNIVERSITIES.find((u) => u.aliases.some((a) => t.includes(a)))?.id;
}
