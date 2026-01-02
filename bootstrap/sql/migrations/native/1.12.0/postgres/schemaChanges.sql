-- Create Learning Resource Entity Table
CREATE TABLE IF NOT EXISTS learning_resource_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(3072) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnhash)
);
