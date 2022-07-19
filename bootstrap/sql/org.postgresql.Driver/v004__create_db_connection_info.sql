
ALTER TABLE user_entity
    ADD isAdmin BOOLEAN GENERATED ALWAYS AS ((json ->> 'isAdmin')::boolean) STORED,
    ADD isBot BOOLEAN GENERATED ALWAYS AS ((json ->> 'isBot')::boolean) STORED;
