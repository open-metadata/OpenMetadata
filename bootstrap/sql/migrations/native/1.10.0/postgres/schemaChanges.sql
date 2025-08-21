-- Increase Flowable ACTIVITY_ID_ column size to support longer user-defined workflow node names
-- This is safe as we're only increasing VARCHAR size, not changing data type or constraints
-- Flowable 7.0.1 doesn't have hard-coded assumptions about this field size

-- ACT_RU_EVENT_SUBSCR is the main bottleneck with 64 char limit
ALTER TABLE ACT_RU_EVENT_SUBSCR ALTER COLUMN ACTIVITY_ID_ TYPE varchar(255);

-- For consistency, also update other tables that might reference activity IDs
-- Note: ACT_RU_EXECUTION already has ACT_ID_ varchar(255), so it's fine

-- History tables might also need updating if you're using them
-- ALTER TABLE ACT_HI_ACTINST ALTER COLUMN ACT_ID_ TYPE varchar(255);
-- ALTER TABLE ACT_HI_DETAIL ALTER COLUMN ACT_INST_ID_ TYPE varchar(255);

-- Note: Always backup your database before running this migration
-- This change is forward-compatible but may need consideration during Flowable upgrades