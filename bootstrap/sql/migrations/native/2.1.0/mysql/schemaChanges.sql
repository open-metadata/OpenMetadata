-- Perf: UsageDAO.computePercentile runs four correlated COUNT(*) subqueries that each
-- filter entity_usage on (entityType, usageDate). The only existing index is
-- UNIQUE (id, usageDate), which is unusable for that predicate, so every run full-scans
-- the table once per subquery. A composite (entityType, usageDate) index turns the
-- percentile subqueries into range scans.
CREATE INDEX idx_entity_usage_entitytype_usagedate ON entity_usage (entityType, usageDate);
