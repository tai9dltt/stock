-- Vietstock's PeriodEnd for yearly reports is unreliable (2023 was stored as
-- ending 2024-12-31). A yearly period ends 12 months after it begins, which
-- also covers fiscal years such as July–June.
UPDATE periods
SET period_end = DATE_SUB(DATE_ADD(period_begin, INTERVAL 1 YEAR), INTERVAL 1 DAY)
WHERE quarter = 0 AND period_begin IS NOT NULL;
