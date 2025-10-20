-- Post-data migration script for 1.10.3 - Glossary Performance Optimization
-- This file contains data updates that need to run after schema changes in schemaChanges.sql

-- Verify generated columns are properly populated
-- Generated columns are automatically computed, but we can verify they work correctly
SELECT
    COUNT(*) as total_terms,
    COUNT(glossary_fqn) as terms_with_glossary_fqn,
    COUNT(status) as terms_with_status,
    COUNT(parent_fqn) as terms_with_parent_fqn
FROM glossary_term_entity
WHERE deleted = 0;

-- The generated columns (glossary_fqn, status, parent_fqn) are automatically
-- populated from the JSON fields and will be maintained by MySQL automatically