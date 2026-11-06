-- عدّادات حدود الاستخدام (لكل IP ولكل خدمة) — تُنظَّف تلقائياً
CREATE TABLE IF NOT EXISTS rate_limits (
  k   TEXT PRIMARY KEY,
  n   INTEGER NOT NULL,
  exp INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_exp ON rate_limits (exp);

-- ملاحظات الباحث على كل مرجع في مكتبته
ALTER TABLE favorites ADD COLUMN note TEXT NOT NULL DEFAULT '';
