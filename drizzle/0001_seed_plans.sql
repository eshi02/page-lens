-- Seed the three plan rows. Idempotent: re-running this migration on
-- an existing database is a no-op for unchanged rows, but updates the
-- name/price/features if we change them here.

INSERT INTO "plans" ("slug", "name", "monthly_audit_quota", "price_cents", "stripe_price_id", "features")
VALUES
  ('free',   'Free',   3,   0,    NULL, '["3 audits per 30 days","Standard CRO heuristics","Saved audit history"]'::jsonb),
  ('pro',    'Pro',    -1,  3000, NULL, '["Unlimited audits","Saved audit history","PDF export","Priority Gemini quota"]'::jsonb),
  ('agency', 'Agency', -1,  9900, NULL, '["Everything in Pro","Brand voice profiles","API access","Team seats (coming soon)"]'::jsonb)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthly_audit_quota" = EXCLUDED."monthly_audit_quota",
  "price_cents" = EXCLUDED."price_cents",
  "features" = EXCLUDED."features";
