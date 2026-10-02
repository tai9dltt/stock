-- Past years were marked as forecast when the crawl window only covered some of
-- their quarters (e.g. 2021 with only Q3, Q4). A year that already has Q4 data is
-- finished, so reset it to actual.

UPDATE periods y
JOIN periods q4
  ON q4.company_id = y.company_id
 AND q4.year = y.year
 AND q4.quarter = 4
 AND q4.source = 'quarter'
SET y.is_forecast = FALSE
WHERE y.quarter = 0
  AND y.source = 'year'
  AND y.is_forecast = TRUE
  AND y.year < YEAR(CURDATE());
