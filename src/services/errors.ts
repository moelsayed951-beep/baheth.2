// تصنيف سبب عدم توفر مصدر (ليس كله «فشلاً»: بعضه يحتاج إعداداً من المستخدم أو المشرف)
export type IssueKind = 'needs_key' | 'needs_login' | 'needs_ip' | 'quota' | 'no_translation' | 'network' | 'other';

// يُرمى عندما لا يمكن/لا يصح استخدام مصدر لهذا الاستعلام (ليس فشلاً في الاتصال)
export class SourceSkipped extends Error {
  constructor(message: string, readonly kind?: IssueKind) {
    super(message);
    this.name = 'SourceSkipped';
  }
}
