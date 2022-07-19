
ALTER TABLE user_entity
    ADD isAdmin BOOLEAN GENERATED ALWAYS AS (json -> '$.isAdmin'),
    ADD isBot BOOLEAN GENERATED ALWAYS AS (json -> '$.isBot');
