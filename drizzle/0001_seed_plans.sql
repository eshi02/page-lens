-- Seed the three plan rows. Idempotent: re-running this migration on
-- an existing database is a no-op for unchanged rows, but updates the
-- name/price/features if we change them here.
--
-- After creating products in your Dodo Payments dashboard, set
-- dodo_product_id on the pro and agency rows (e.g. via Drizzle Studio
-- or a quick SQL UPDATE). Free has no product — quota gates it.

INSERT INTO "plans" ("slug", "name", "monthly_audit_quota", "price_cents", "dodo_product_id", "features")
VALUES
  ('free',   'Free',   3,   0,    NULL, '["3 audits per 30 days","Standard CRO heuristics","Saved audit history"]'::jsonb),
  ('pro',    'Pro',    15, 3000, NULL, '["15 audits per day","Full audit history","PDF report exports","Compare 2 pages side-by-side","Priority AI quota"]'::jsonb),
  ('agency', 'Agency', -1,  9900, NULL, '["Unlimited audits","Everything in Pro","Brand voice profiles","API access","Team seats (coming soon)"]'::jsonb)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthly_audit_quota" = EXCLUDED."monthly_audit_quota",
  "price_cents" = EXCLUDED."price_cents",
  "features" = EXCLUDED."features";
