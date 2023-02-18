-- Unique constraint for user email address
ALTER TABLE user_entity
ADD UNIQUE (email);
