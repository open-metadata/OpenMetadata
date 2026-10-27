-- An FQN hash is one 32-char md5 per level joined by dots, so anything eight or more levels deep
-- (263+ chars) overflowed these varchar(256) columns: tasks on deep entities could not be created,
-- moving a glossary term with tasks to that depth failed, and eighth-level subdomains could not be
-- created. 768 is what the table and container FQN hash columns use.
ALTER TABLE task_entity ALTER COLUMN aboutfqnhash TYPE character varying(768);
ALTER TABLE domain_entity ALTER COLUMN fqnhash TYPE character varying(768);
