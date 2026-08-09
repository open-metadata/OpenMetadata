-- Consolidated OpenMetadata migration baseline (PostgreSQL)
-- Covers: flyway v000-v015 + native 1.1.0-1.13.4 (everything strictly below 2.0.0)
-- Generated from git revision: b07117a765466d3fd12c3179ac800bc734de0a5f
-- Regenerate with: scripts/generate_migration_baseline.sh
-- FROZEN: never edit by hand; schema changes go into bootstrap/sql/migrations/native/2.1.0+.


CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.to_tz_timestamp(text) RETURNS timestamp with time zone
    LANGUAGE sql IMMUTABLE
    AS $_$
select to_timestamp($1, '%Y-%m-%dT%T.%fZ')::timestamptz;
$_$;

CREATE TABLE IF NOT EXISTS public.agent_execution_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    agentid character varying(36) GENERATED ALWAYS AS ((json ->> 'agentId'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_application_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);

CREATE TABLE IF NOT EXISTS public.ai_governance_policy_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);

CREATE TABLE IF NOT EXISTS public.api_collection_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.api_endpoint_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.api_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.apps_data_store (
    identifier character varying(256) NOT NULL,
    type character varying(256) NOT NULL,
    json json NOT NULL
);

CREATE TABLE IF NOT EXISTS public.apps_extension_time_series (
    appid character varying(36) GENERATED ALWAYS AS ((json ->> 'appId'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    extension character varying(255) NOT NULL,
    appname character varying(256) GENERATED ALWAYS AS ((json ->> 'appName'::text)) STORED NOT NULL
);

CREATE TABLE IF NOT EXISTS public.apps_marketplace (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);

CREATE TABLE IF NOT EXISTS public.audit_log_event (
    id bigint NOT NULL,
    change_event_id uuid NOT NULL,
    event_ts bigint NOT NULL,
    event_type character varying(32) NOT NULL,
    user_name character varying(256),
    actor_type character varying(32) DEFAULT 'USER'::character varying,
    impersonated_by character varying(256) DEFAULT NULL::character varying,
    service_name character varying(256) DEFAULT NULL::character varying,
    entity_type character varying(128),
    entity_id uuid,
    entity_fqn character varying(768),
    entity_fqn_hash character varying(768),
    event_json text NOT NULL,
    created_at bigint DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint,
    search_text text
);

CREATE SEQUENCE IF NOT EXISTS public.audit_log_event_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.audit_log_event_id_seq OWNED BY public.audit_log_event.id;

CREATE TABLE IF NOT EXISTS public.automations_workflow (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    workflowtype character varying(256) GENERATED ALWAYS AS ((json ->> 'workflowType'::text)) STORED NOT NULL,
    status character varying(256) GENERATED ALWAYS AS ((json ->> 'status'::text)) STORED,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.background_jobs (
    id bigint NOT NULL,
    jobtype character varying(256) NOT NULL,
    methodname character varying(256) NOT NULL,
    jobargs jsonb NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    createdby character varying(256) NOT NULL,
    createdat bigint DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint NOT NULL,
    updatedat bigint DEFAULT ((EXTRACT(epoch FROM now()) * (1000)::numeric))::bigint NOT NULL,
    runat bigint
);

CREATE SEQUENCE IF NOT EXISTS public.background_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.background_jobs_id_seq OWNED BY public.background_jobs.id;

CREATE TABLE IF NOT EXISTS public.bot_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.change_event (
    eventtype character varying(36) GENERATED ALWAYS AS ((json ->> 'eventType'::text)) STORED NOT NULL,
    entitytype character varying(36) GENERATED ALWAYS AS ((json ->> 'entityType'::text)) STORED NOT NULL,
    username character varying(256) GENERATED ALWAYS AS ((json ->> 'userName'::text)) STORED NOT NULL,
    eventtime bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    json jsonb NOT NULL,
    "offset" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.change_event_consumers (
    id character varying(36) NOT NULL,
    extension character varying(256) NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS public.change_event_offset_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.change_event_offset_seq OWNED BY public.change_event."offset";

CREATE TABLE IF NOT EXISTS public.chart_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.classification (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.consumers_dlq (
    id character varying(36) NOT NULL,
    extension character varying(256) NOT NULL,
    json jsonb NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    source character varying(255)
);

CREATE TABLE IF NOT EXISTS public.dashboard_data_model_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.dashboard_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.dashboard_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.data_contract_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.data_insight_chart (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    dataindextype character varying(256) GENERATED ALWAYS AS ((json ->> 'dataIndexType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.data_product_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.data_quality_data_time_series (
    entityfqnhash character varying(768),
    extension character varying(256) NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json json NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    incidentid character varying(36),
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED,
    CONSTRAINT data_quality_data_time_series_timestamp_check CHECK (("timestamp" > 0))
);

CREATE TABLE IF NOT EXISTS public.database_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.database_schema_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.dbservice_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.di_chart_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fullyqualifiedname character varying(256) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    fqnhash character varying(768) DEFAULT NULL::character varying,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);

CREATE TABLE IF NOT EXISTS public.directory_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    fullyqualifiedname character varying(768) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.doc_store (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    entitytype character varying(256) GENERATED ALWAYS AS ((json ->> 'entityType'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL
);

CREATE TABLE IF NOT EXISTS public.domain_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.drive_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.entity_deletion_lock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entityid uuid NOT NULL,
    entitytype character varying(256) NOT NULL,
    entityfqn character varying(2048) NOT NULL,
    locktype character varying(50) NOT NULL,
    lockedby character varying(256) NOT NULL,
    lockedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expectedcompletion timestamp without time zone,
    deletionscope character varying(50),
    metadata jsonb
);

CREATE TABLE IF NOT EXISTS public.entity_extension (
    id character varying(36) NOT NULL,
    extension character varying(256) NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED
);

CREATE TABLE IF NOT EXISTS public.entity_extension_time_series (
    extension character varying(256) NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    entityfqnhash character varying(768) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.entity_relationship (
    fromid character varying(36) NOT NULL,
    toid character varying(36) NOT NULL,
    fromentity character varying(256) NOT NULL,
    toentity character varying(256) NOT NULL,
    relation smallint NOT NULL,
    jsonschema character varying(256),
    json jsonb,
    deleted boolean DEFAULT false NOT NULL,
    relationtype character varying(64) DEFAULT ''::character varying NOT NULL
);

CREATE TABLE IF NOT EXISTS public.entity_usage (
    id character varying(36) NOT NULL,
    entitytype character varying(20) NOT NULL,
    usagedate date,
    count1 integer,
    count7 integer,
    count30 integer,
    percentile1 integer,
    percentile7 integer,
    percentile30 integer
);

CREATE TABLE IF NOT EXISTS public.event_subscription_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.field_relationship (
    fromfqn character varying(2096) NOT NULL,
    tofqn character varying(2096) NOT NULL,
    fromtype character varying(256) NOT NULL,
    totype character varying(256) NOT NULL,
    relation smallint NOT NULL,
    jsonschema character varying(256),
    json jsonb,
    fromfqnhash character varying(768) NOT NULL,
    tofqnhash character varying(768) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.file_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    fullyqualifiedname character varying(768) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED NOT NULL,
    filetype character varying(256) GENERATED ALWAYS AS ((json ->> 'fileType'::text)) STORED,
    directoryfqn character varying(768) GENERATED ALWAYS AS (((json -> 'directory'::text) ->> 'fullyQualifiedName'::text)) STORED,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.glossary_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.glossary_term_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    displayname character varying(256) GENERATED ALWAYS AS ((json ->> 'displayName'::text)) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED,
    entitystatus character varying(32) GENERATED ALWAYS AS ((json ->> 'entityStatus'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.index_mapping_versions (
    entitytype character varying(256) NOT NULL,
    mappinghash character varying(32) NOT NULL,
    mappingjson jsonb NOT NULL,
    version character varying(36) NOT NULL,
    updatedat bigint NOT NULL,
    updatedby character varying(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ingestion_pipeline_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json json NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    "timestamp" bigint,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    apptype character varying(256) GENERATED ALWAYS AS (((((json -> 'sourceConfig'::text) -> 'config'::text) -> 'appConfig'::text) ->> 'type'::text)) STORED,
    pipelinetype character varying(256) GENERATED ALWAYS AS ((json ->> 'pipelineType'::text)) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.installed_apps (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);

CREATE TABLE IF NOT EXISTS public.intake_form_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    entitytype character varying(64) GENERATED ALWAYS AS ((json ->> 'entityType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);

CREATE TABLE IF NOT EXISTS public.kpi_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.learning_resource_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(3072) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);

CREATE TABLE IF NOT EXISTS public.llm_model_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);

CREATE TABLE IF NOT EXISTS public.llm_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mcp_execution_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    serverid character varying(36) GENERATED ALWAYS AS ((json ->> 'serverId'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mcp_pending_auth_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    auth_request_id character varying(64) NOT NULL,
    client_id character varying(255) NOT NULL,
    code_challenge character varying(255) NOT NULL,
    code_challenge_method character varying(10) DEFAULT 'S256'::character varying NOT NULL,
    redirect_uri text NOT NULL,
    mcp_state text,
    scopes jsonb,
    pac4j_state character varying(64),
    pac4j_nonce character varying(255),
    pac4j_code_verifier character varying(255),
    expires_at bigint NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS public.mcp_server_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);

CREATE TABLE IF NOT EXISTS public.mcp_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.messaging_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.metadata_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.metric_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    customunitofmeasurement character varying(256) GENERATED ALWAYS AS (((json ->> 'customUnitOfMeasurement'::text))::character varying(256)) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.ml_model_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.mlmodel_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.notification_template_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    provider character varying(32) GENERATED ALWAYS AS ((json ->> 'provider'::text)) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.oauth_access_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash character varying(255) NOT NULL,
    access_token_encrypted text NOT NULL,
    client_id character varying(255) NOT NULL,
    user_name character varying(255) NOT NULL,
    scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    expires_at bigint NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT oauth_access_tokens_expires_check CHECK ((expires_at > 0))
);

CREATE TABLE IF NOT EXISTS public.oauth_authorization_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(512) NOT NULL,
    client_id character varying(255) NOT NULL,
    user_name character varying(255) NOT NULL,
    code_challenge character varying(255),
    code_challenge_method character varying(10),
    redirect_uri text NOT NULL,
    scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    expires_at bigint NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT oauth_authorization_codes_challenge_method_check CHECK (((code_challenge_method IS NULL) OR ((code_challenge_method)::text = 'S256'::text))),
    CONSTRAINT oauth_authorization_codes_expires_check CHECK ((expires_at > 0))
);

CREATE TABLE IF NOT EXISTS public.oauth_clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying(255) NOT NULL,
    client_secret_encrypted text,
    client_name character varying(255),
    redirect_uris jsonb DEFAULT '[]'::jsonb NOT NULL,
    grant_types jsonb DEFAULT '["authorization_code", "refresh_token"]'::jsonb NOT NULL,
    token_endpoint_auth_method character varying(50) DEFAULT 'client_secret_post'::character varying NOT NULL,
    scopes jsonb DEFAULT '["read", "write"]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT oauth_clients_client_id_check CHECK ((char_length((client_id)::text) > 0))
);

CREATE TABLE IF NOT EXISTS public.oauth_refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token_hash character varying(255) NOT NULL,
    refresh_token_encrypted text NOT NULL,
    client_id character varying(255) NOT NULL,
    user_name character varying(255) NOT NULL,
    scopes jsonb DEFAULT '[]'::jsonb NOT NULL,
    expires_at bigint NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT oauth_refresh_tokens_expires_check CHECK ((expires_at > 0))
);

CREATE TABLE IF NOT EXISTS public.openmetadata_settings (
    id integer NOT NULL,
    configtype character varying(36) NOT NULL,
    json jsonb NOT NULL
);

CREATE SEQUENCE IF NOT EXISTS public.openmetadata_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.openmetadata_settings_id_seq OWNED BY public.openmetadata_settings.id;

CREATE TABLE IF NOT EXISTS public.persona_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.pipeline_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.pipeline_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.policy_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.profiler_data_time_series (
    entityfqnhash character varying(768),
    extension character varying(256) NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json json NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    operation character varying(256) GENERATED ALWAYS AS (((json -> 'profileData'::text) ->> 'operation'::text)) STORED,
    CONSTRAINT profiler_data_time_series_timestamp_check CHECK (("timestamp" > 0))
);

CREATE TABLE IF NOT EXISTS public.prompt_template_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);

CREATE TABLE IF NOT EXISTS public.qrtz_blob_triggers (
    sched_name character varying(120) NOT NULL,
    trigger_name character varying(200) NOT NULL,
    trigger_group character varying(200) NOT NULL,
    blob_data bytea
);

CREATE TABLE IF NOT EXISTS public.qrtz_calendars (
    sched_name character varying(120) NOT NULL,
    calendar_name character varying(200) NOT NULL,
    calendar bytea NOT NULL
);

CREATE TABLE IF NOT EXISTS public.qrtz_cron_triggers (
    sched_name character varying(120) NOT NULL,
    trigger_name character varying(200) NOT NULL,
    trigger_group character varying(200) NOT NULL,
    cron_expression character varying(120) NOT NULL,
    time_zone_id character varying(80)
);

CREATE TABLE IF NOT EXISTS public.qrtz_fired_triggers (
    sched_name character varying(120) NOT NULL,
    entry_id character varying(95) NOT NULL,
    trigger_name character varying(200) NOT NULL,
    trigger_group character varying(200) NOT NULL,
    instance_name character varying(200) NOT NULL,
    fired_time bigint NOT NULL,
    sched_time bigint NOT NULL,
    priority integer NOT NULL,
    state character varying(16) NOT NULL,
    job_name character varying(200),
    job_group character varying(200),
    is_nonconcurrent boolean,
    requests_recovery boolean
);

CREATE TABLE IF NOT EXISTS public.qrtz_job_details (
    sched_name character varying(120) NOT NULL,
    job_name character varying(200) NOT NULL,
    job_group character varying(200) NOT NULL,
    description character varying(250),
    job_class_name character varying(250) NOT NULL,
    is_durable boolean NOT NULL,
    is_nonconcurrent boolean NOT NULL,
    is_update_data boolean NOT NULL,
    requests_recovery boolean NOT NULL,
    job_data bytea
);

CREATE TABLE IF NOT EXISTS public.qrtz_locks (
    sched_name character varying(120) NOT NULL,
    lock_name character varying(40) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.qrtz_paused_trigger_grps (
    sched_name character varying(120) NOT NULL,
    trigger_group character varying(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.qrtz_scheduler_state (
    sched_name character varying(120) NOT NULL,
    instance_name character varying(200) NOT NULL,
    last_checkin_time bigint NOT NULL,
    checkin_interval bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.qrtz_simple_triggers (
    sched_name character varying(120) NOT NULL,
    trigger_name character varying(200) NOT NULL,
    trigger_group character varying(200) NOT NULL,
    repeat_count bigint NOT NULL,
    repeat_interval bigint NOT NULL,
    times_triggered bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.qrtz_simprop_triggers (
    sched_name character varying(120) NOT NULL,
    trigger_name character varying(200) NOT NULL,
    trigger_group character varying(200) NOT NULL,
    str_prop_1 character varying(512),
    str_prop_2 character varying(512),
    str_prop_3 character varying(512),
    int_prop_1 integer,
    int_prop_2 integer,
    long_prop_1 bigint,
    long_prop_2 bigint,
    dec_prop_1 numeric(13,4),
    dec_prop_2 numeric(13,4),
    bool_prop_1 boolean,
    bool_prop_2 boolean
);

CREATE TABLE IF NOT EXISTS public.qrtz_triggers (
    sched_name character varying(120) NOT NULL,
    trigger_name character varying(200) NOT NULL,
    trigger_group character varying(200) NOT NULL,
    job_name character varying(200) NOT NULL,
    job_group character varying(200) NOT NULL,
    description character varying(250),
    next_fire_time bigint,
    prev_fire_time bigint,
    priority integer,
    trigger_state character varying(16) NOT NULL,
    trigger_type character varying(8) NOT NULL,
    start_time bigint NOT NULL,
    end_time bigint,
    calendar_name character varying(200),
    misfire_instr smallint,
    job_data bytea
);

CREATE TABLE IF NOT EXISTS public.query_cost_time_series (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    cost real GENERATED ALWAYS AS (((json ->> 'cost'::text))::real) STORED NOT NULL,
    count double precision GENERATED ALWAYS AS (((json ->> 'count'::text))::double precision) STORED NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL,
    entityfqnhash character varying(768) DEFAULT NULL::character varying COLLATE pg_catalog."C"
);

CREATE TABLE IF NOT EXISTS public.query_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    checksum character varying(32) GENERATED ALWAYS AS ((json ->> 'checksum'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.rdf_index_job (
    id character varying(36) NOT NULL,
    status character varying(32) NOT NULL,
    jobconfiguration jsonb NOT NULL,
    totalrecords bigint DEFAULT 0 NOT NULL,
    processedrecords bigint DEFAULT 0 NOT NULL,
    successrecords bigint DEFAULT 0 NOT NULL,
    failedrecords bigint DEFAULT 0 NOT NULL,
    stats jsonb,
    createdby character varying(256) NOT NULL,
    createdat bigint NOT NULL,
    startedat bigint,
    completedat bigint,
    updatedat bigint NOT NULL,
    errormessage text
);

CREATE TABLE IF NOT EXISTS public.rdf_index_partition (
    id character varying(36) NOT NULL,
    jobid character varying(36) NOT NULL,
    entitytype character varying(128) NOT NULL,
    partitionindex integer NOT NULL,
    rangestart bigint NOT NULL,
    rangeend bigint NOT NULL,
    estimatedcount bigint NOT NULL,
    workunits bigint NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    status character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    processingcursor bigint DEFAULT 0 NOT NULL,
    processedcount bigint DEFAULT 0 NOT NULL,
    successcount bigint DEFAULT 0 NOT NULL,
    failedcount bigint DEFAULT 0 NOT NULL,
    assignedserver character varying(255),
    claimedat bigint,
    startedat bigint,
    completedat bigint,
    lastupdateat bigint,
    lasterror text,
    retrycount integer DEFAULT 0 NOT NULL,
    claimableat bigint DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rdf_index_server_stats (
    id character varying(36) NOT NULL,
    jobid character varying(36) NOT NULL,
    serverid character varying(256) NOT NULL,
    entitytype character varying(128) NOT NULL,
    processedrecords bigint DEFAULT 0,
    successrecords bigint DEFAULT 0,
    failedrecords bigint DEFAULT 0,
    partitionscompleted integer DEFAULT 0,
    partitionsfailed integer DEFAULT 0,
    lastupdatedat bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rdf_reindex_lock (
    lockkey character varying(64) NOT NULL,
    jobid character varying(36) NOT NULL,
    serverid character varying(255) NOT NULL,
    acquiredat bigint NOT NULL,
    lastheartbeat bigint NOT NULL,
    expiresat bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.recognizer_feedback_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    entitylink character varying(512) GENERATED ALWAYS AS ((json ->> 'entityLink'::text)) STORED NOT NULL,
    tagfqn character varying(256) GENERATED ALWAYS AS ((json ->> 'tagFQN'::text)) STORED NOT NULL,
    feedbacktype character varying(50) GENERATED ALWAYS AS ((json ->> 'feedbackType'::text)) STORED NOT NULL,
    status character varying(20) GENERATED ALWAYS AS ((json ->> 'status'::text)) STORED,
    createdby character varying(256) GENERATED ALWAYS AS ((json ->> 'createdBy'::text)) STORED NOT NULL,
    createdat bigint GENERATED ALWAYS AS (((json ->> 'createdAt'::text))::bigint) STORED NOT NULL,
    json jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.report_data_time_series (
    entityfqnhash character varying(768),
    extension character varying(256) NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    CONSTRAINT report_data_time_series_timestamp_check CHECK (("timestamp" > 0))
);

CREATE TABLE IF NOT EXISTS public.report_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.role_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.search_index_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.search_index_failures (
    id character varying(36) NOT NULL,
    jobid character varying(36) NOT NULL,
    serverid character varying(256) NOT NULL,
    entitytype character varying(256) NOT NULL,
    entityid character varying(36),
    entityfqn character varying(1024),
    failurestage character varying(32) NOT NULL,
    errormessage text,
    stacktrace text,
    "timestamp" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.search_index_job (
    id character varying(36) NOT NULL,
    status character varying(32) NOT NULL,
    jobconfiguration jsonb NOT NULL,
    targetindexprefix character varying(255),
    stagedindexmapping jsonb,
    totalrecords bigint DEFAULT 0 NOT NULL,
    processedrecords bigint DEFAULT 0 NOT NULL,
    successrecords bigint DEFAULT 0 NOT NULL,
    failedrecords bigint DEFAULT 0 NOT NULL,
    stats jsonb,
    createdby character varying(256) NOT NULL,
    createdat bigint NOT NULL,
    startedat bigint,
    completedat bigint,
    updatedat bigint NOT NULL,
    errormessage text,
    registrationdeadline bigint,
    registeredservercount integer
);

CREATE TABLE IF NOT EXISTS public.search_index_partition (
    id character varying(36) NOT NULL,
    jobid character varying(36) NOT NULL,
    entitytype character varying(128) NOT NULL,
    partitionindex integer NOT NULL,
    rangestart bigint NOT NULL,
    rangeend bigint NOT NULL,
    estimatedcount bigint NOT NULL,
    workunits bigint NOT NULL,
    priority integer DEFAULT 50 NOT NULL,
    status character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    processingcursor bigint DEFAULT 0 NOT NULL,
    processedcount bigint DEFAULT 0 NOT NULL,
    successcount bigint DEFAULT 0 NOT NULL,
    failedcount bigint DEFAULT 0 NOT NULL,
    assignedserver character varying(255),
    claimedat bigint,
    startedat bigint,
    completedat bigint,
    lastupdateat bigint,
    lasterror text,
    retrycount integer DEFAULT 0 NOT NULL,
    claimableat bigint DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.search_index_retry_queue (
    entityid character varying(36) DEFAULT ''::character varying NOT NULL,
    entityfqn character varying(1024) DEFAULT ''::character varying NOT NULL,
    failurereason text,
    status character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    entitytype character varying(256) DEFAULT ''::character varying NOT NULL,
    retrycount integer DEFAULT 0 NOT NULL,
    claimedat timestamp without time zone
);

CREATE TABLE IF NOT EXISTS public.search_index_server_stats (
    id character varying(36) NOT NULL,
    jobid character varying(36) NOT NULL,
    serverid character varying(256) NOT NULL,
    readersuccess bigint DEFAULT 0,
    readerfailed bigint DEFAULT 0,
    readerwarnings bigint DEFAULT 0,
    sinksuccess bigint DEFAULT 0,
    sinkfailed bigint DEFAULT 0,
    partitionscompleted integer DEFAULT 0,
    partitionsfailed integer DEFAULT 0,
    lastupdatedat bigint NOT NULL,
    processsuccess bigint DEFAULT 0,
    processfailed bigint DEFAULT 0,
    vectorsuccess bigint DEFAULT 0,
    vectorfailed bigint DEFAULT 0,
    vectorwarnings bigint DEFAULT 0,
    entitytype character varying(128) DEFAULT 'unknown'::character varying NOT NULL,
    readertimems bigint DEFAULT 0 NOT NULL,
    processtimems bigint DEFAULT 0 NOT NULL,
    sinktimems bigint DEFAULT 0 NOT NULL,
    vectortimems bigint DEFAULT 0 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.search_reindex_lock (
    lockkey character varying(64) NOT NULL,
    jobid character varying(36) NOT NULL,
    serverid character varying(255) NOT NULL,
    acquiredat bigint NOT NULL,
    lastheartbeat bigint NOT NULL,
    expiresat bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.search_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.security_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE SEQUENCE IF NOT EXISTS public.server_change_log_installed_rank_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS public.spreadsheet_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    fullyqualifiedname character varying(768) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED NOT NULL,
    directoryfqn character varying(768) GENERATED ALWAYS AS (((json -> 'directory'::text) ->> 'fullyQualifiedName'::text)) STORED,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.storage_container_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.storage_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.stored_procedure_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    databaseschemahash character varying(768) GENERATED ALWAYS AS (rtrim(((((split_part((fqnhash)::text, '.'::text, 1) || '.'::text) || split_part((fqnhash)::text, '.'::text, 2)) || '.'::text) || split_part((fqnhash)::text, '.'::text, 3)), '.'::text)) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.successful_sent_change_events (
    change_event_id character varying(36) NOT NULL,
    event_subscription_id character varying(36) NOT NULL,
    json jsonb NOT NULL,
    "timestamp" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.suggestions (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    entitylink character varying(256) GENERATED ALWAYS AS ((json ->> 'entityLink'::text)) STORED NOT NULL,
    suggestiontype character varying(36) GENERATED ALWAYS AS ((json ->> 'type'::text)) STORED NOT NULL,
    json json NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    status character varying(256) GENERATED ALWAYS AS ((json ->> 'status'::text)) STORED NOT NULL
);

CREATE TABLE IF NOT EXISTS public.table_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    databaseschemahash character varying(768) GENERATED ALWAYS AS (rtrim(((((split_part((fqnhash)::text, '.'::text, 1) || '.'::text) || split_part((fqnhash)::text, '.'::text, 2)) || '.'::text) || split_part((fqnhash)::text, '.'::text, 3)), '.'::text)) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.tag (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    classificationhash text GENERATED ALWAYS AS (split_part((fqnhash)::text, '.'::text, 1)) STORED
);

CREATE TABLE IF NOT EXISTS public.tag_usage (
    source smallint NOT NULL,
    tagfqn character varying(512) NOT NULL,
    labeltype smallint NOT NULL,
    state smallint NOT NULL,
    tagfqnhash character varying(768),
    targetfqnhash character varying(768),
    reason text,
    targetfqnhash_lower text GENERATED ALWAYS AS (lower((targetfqnhash)::text)) STORED,
    appliedat timestamp without time zone DEFAULT now(),
    appliedby character varying(64) DEFAULT 'admin'::character varying,
    metadata json,
    tagfqn_lower text GENERATED ALWAYS AS (lower((tagfqn)::text)) STORED
)
WITH (autovacuum_vacuum_scale_factor='0.05', autovacuum_analyze_scale_factor='0.02', autovacuum_vacuum_threshold='50', autovacuum_analyze_threshold='50', fillfactor='90');
ALTER TABLE ONLY public.tag_usage ALTER COLUMN source SET STATISTICS 100;
ALTER TABLE ONLY public.tag_usage ALTER COLUMN tagfqn SET STATISTICS 500;
ALTER TABLE ONLY public.tag_usage ALTER COLUMN targetfqnhash SET STATISTICS 1000;
ALTER TABLE ONLY public.tag_usage ALTER COLUMN targetfqnhash_lower SET STATISTICS 1000;
ALTER TABLE ONLY public.tag_usage ALTER COLUMN tagfqn_lower SET STATISTICS 500;

CREATE TABLE IF NOT EXISTS public.task_sequence (
    id integer NOT NULL,
    dummy character varying(1)
);

CREATE SEQUENCE IF NOT EXISTS public.task_sequence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.task_sequence_id_seq OWNED BY public.task_sequence.id;

CREATE TABLE IF NOT EXISTS public.team_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    teamtype character varying(64) GENERATED ALWAYS AS ((json ->> 'teamType'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.test_case (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    entityfqn character varying(712) GENERATED ALWAYS AS ((json ->> 'entityFQN'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    name character varying(512) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    entitylink character varying(512) GENERATED ALWAYS AS ((json ->> 'entityLink'::text)) STORED NOT NULL,
    status character varying(56) GENERATED ALWAYS AS ((json ->> 'testCaseStatus'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.test_case_dimension_results_time_series (
    entityfqnhash character varying(768) NOT NULL COLLATE pg_catalog."C",
    extension character varying(256) DEFAULT 'testCase.dimensionResult'::character varying NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL,
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    testcaseresultid character varying(36) GENERATED ALWAYS AS ((json ->> 'testCaseResultId'::text)) STORED NOT NULL,
    dimensionkey character varying(512) GENERATED ALWAYS AS ((json ->> 'dimensionKey'::text)) STORED NOT NULL,
    dimensionname character varying(256) GENERATED ALWAYS AS (split_part((json ->> 'dimensionKey'::text), '='::text, 1)) STORED,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    testcasestatus character varying(36) GENERATED ALWAYS AS ((json ->> 'testCaseStatus'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.test_case_resolution_status_time_series (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    stateid character varying(36) GENERATED ALWAYS AS ((json ->> 'stateId'::text)) STORED NOT NULL,
    assignee character varying(256) GENERATED ALWAYS AS (
CASE
    WHEN (((json -> 'testCaseResolutionStatusDetails'::text) IS NOT NULL) AND (((json -> 'testCaseResolutionStatusDetails'::text) -> 'assignee'::text) IS NOT NULL) AND ((((json -> 'testCaseResolutionStatusDetails'::text) -> 'assignee'::text) ->> 'name'::text) IS NOT NULL)) THEN (((json -> 'testCaseResolutionStatusDetails'::text) -> 'assignee'::text) ->> 'name'::text)
    ELSE NULL::text
END) STORED,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    testcaseresolutionstatustype character varying(36) GENERATED ALWAYS AS ((json ->> 'testCaseResolutionStatusType'::text)) STORED NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL,
    entityfqnhash character varying(768) DEFAULT NULL::character varying COLLATE pg_catalog."C"
);

CREATE TABLE IF NOT EXISTS public.test_connection_definition (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fullyqualifiedname character varying(256) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);

CREATE TABLE IF NOT EXISTS public.test_definition (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(512) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    entitytype character varying(36) GENERATED ALWAYS AS ((json ->> 'entityType'::text)) STORED NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    supported_data_types jsonb GENERATED ALWAYS AS ((json -> 'supportedDataTypes'::text)) STORED,
    namehash character varying(256) NOT NULL,
    enabled boolean GENERATED ALWAYS AS (COALESCE(((json ->> 'enabled'::text))::boolean, true)) STORED
);

CREATE TABLE IF NOT EXISTS public.test_suite (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.thread_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    entitylink character varying(3072) GENERATED ALWAYS AS ((json ->> 'about'::text)) STORED NOT NULL,
    assignedto character varying(256) GENERATED ALWAYS AS ((json ->> 'addressedTo'::text)) STORED,
    json jsonb NOT NULL,
    createdat bigint GENERATED ALWAYS AS (((json ->> 'threadTs'::text))::bigint) STORED NOT NULL,
    createdby character varying(256) GENERATED ALWAYS AS ((json ->> 'createdBy'::text)) STORED NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    resolved boolean GENERATED ALWAYS AS (((json ->> 'resolved'::text))::boolean) STORED,
    type character varying(64) GENERATED ALWAYS AS ((json ->> 'type'::text)) STORED NOT NULL,
    taskid integer GENERATED ALWAYS AS (((json #> '{task,id}'::text[]))::integer) STORED,
    taskstatus character varying(64) GENERATED ALWAYS AS ((json #>> '{task,status}'::text[])) STORED,
    taskassignees jsonb GENERATED ALWAYS AS ((json #> '{task,assignees}'::text[])) STORED,
    announcementstart bigint GENERATED ALWAYS AS (((json #> '{announcement,startTime}'::text[]))::bigint) STORED,
    announcementend bigint GENERATED ALWAYS AS (((json #> '{announcement,endTime}'::text[]))::bigint) STORED,
    hash_id character varying(32) GENERATED ALWAYS AS (md5((json ->> 'id'::text))) STORED,
    testcaseresolutionstatusid text GENERATED ALWAYS AS (((json -> 'task'::text) ->> 'testCaseResolutionStatusId'::text)) STORED,
    taskassigneesids text GENERATED ALWAYS AS (TRIM(BOTH '[]'::text FROM (jsonb_path_query_array(json, '$."task"."assignees"[*]."id"'::jsonpath))::text)) STORED,
    entityid character varying(36) GENERATED ALWAYS AS (((json -> 'entityRef'::text) ->> 'id'::text)) STORED,
    entitytype character varying(36) GENERATED ALWAYS AS (((json -> 'entityRef'::text) ->> 'type'::text)) STORED,
    domains text GENERATED ALWAYS AS (
CASE
    WHEN (((json -> 'domains'::text) IS NULL) OR (jsonb_array_length((json -> 'domains'::text)) = 0)) THEN NULL::text
    ELSE (json ->> 'domains'::text)
END) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.topic_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.type_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    category character varying(256) GENERATED ALWAYS AS ((json ->> 'category'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.user_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    email character varying(256) GENERATED ALWAYS AS ((json ->> 'email'::text)) STORED NOT NULL,
    deactivated character varying(8) GENERATED ALWAYS AS ((json ->> 'deactivated'::text)) STORED,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL,
    isbot boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED NOT NULL,
    lastlogintime bigint GENERATED ALWAYS AS (((json ->> 'lastLoginTime'::text))::bigint) STORED,
    lastactivitytime bigint GENERATED ALWAYS AS (((json ->> 'lastActivityTime'::text))::bigint) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.user_tokens (
    token character varying(36) GENERATED ALWAYS AS ((json ->> 'token'::text)) STORED NOT NULL,
    userid character varying(36) GENERATED ALWAYS AS ((json ->> 'userId'::text)) STORED NOT NULL,
    tokentype character varying(50) GENERATED ALWAYS AS ((json ->> 'tokenType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    expirydate bigint GENERATED ALWAYS AS (((json ->> 'expiryDate'::text))::bigint) STORED
);

CREATE TABLE IF NOT EXISTS public.web_analytic_event (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    eventtype character varying(256) GENERATED ALWAYS AS ((json ->> 'eventType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workflow_definition_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL COLLATE pg_catalog."C",
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED NOT NULL,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.workflow_instance_state_time_series (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    workflowinstanceid character varying(36) GENERATED ALWAYS AS ((json ->> 'workflowInstanceId'::text)) STORED NOT NULL,
    workflowinstanceexecutionid character varying(36) GENERATED ALWAYS AS ((json ->> 'workflowInstanceExecutionId'::text)) STORED NOT NULL,
    workflowdefinitionid character varying(36) GENERATED ALWAYS AS ((json ->> 'workflowDefinitionId'::text)) STORED NOT NULL,
    stage character varying(256) GENERATED ALWAYS AS (((json -> 'stage'::text) ->> 'name'::text)) STORED NOT NULL,
    stagestartedat bigint GENERATED ALWAYS AS ((((json -> 'stage'::text) ->> 'startedAt'::text))::bigint) STORED NOT NULL,
    stageendedat bigint GENERATED ALWAYS AS ((((json -> 'stage'::text) ->> 'endedAt'::text))::bigint) STORED,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL,
    entityfqnhash character varying(768) DEFAULT NULL::character varying COLLATE pg_catalog."C",
    status character varying(20) GENERATED ALWAYS AS ((json ->> 'status'::text)) STORED,
    exceptionstacktrace text GENERATED ALWAYS AS ((json ->> 'exception'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.workflow_instance_time_series (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    workflowdefinitionid character varying(36) GENERATED ALWAYS AS ((json ->> 'workflowDefinitionId'::text)) STORED NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    startedat bigint GENERATED ALWAYS AS (((json ->> 'startedAt'::text))::bigint) STORED NOT NULL,
    endedat bigint GENERATED ALWAYS AS (((json ->> 'endedAt'::text))::bigint) STORED,
    entityfqnhash character varying(768) DEFAULT NULL::character varying COLLATE pg_catalog."C",
    status character varying(20) GENERATED ALWAYS AS ((json ->> 'status'::text)) STORED,
    exceptionstacktrace text GENERATED ALWAYS AS ((json ->> 'exception'::text)) STORED,
    entitylink text GENERATED ALWAYS AS (((json -> 'variables'::text) ->> 'global_relatedEntity'::text)) STORED
);

CREATE TABLE IF NOT EXISTS public.worksheet_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL,
    fullyqualifiedname character varying(768) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED NOT NULL,
    spreadsheetfqn character varying(768) GENERATED ALWAYS AS (((json -> 'spreadsheet'::text) ->> 'fullyQualifiedName'::text)) STORED,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    impersonatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'impersonatedBy'::text)) STORED
);

ALTER TABLE ONLY public.audit_log_event ALTER COLUMN id SET DEFAULT nextval('public.audit_log_event_id_seq'::regclass);

ALTER TABLE ONLY public.background_jobs ALTER COLUMN id SET DEFAULT nextval('public.background_jobs_id_seq'::regclass);

ALTER TABLE ONLY public.change_event ALTER COLUMN "offset" SET DEFAULT nextval('public.change_event_offset_seq'::regclass);

ALTER TABLE ONLY public.openmetadata_settings ALTER COLUMN id SET DEFAULT nextval('public.openmetadata_settings_id_seq'::regclass);

ALTER TABLE ONLY public.task_sequence ALTER COLUMN id SET DEFAULT nextval('public.task_sequence_id_seq'::regclass);

ALTER TABLE ONLY public.agent_execution_entity
    ADD CONSTRAINT agent_execution_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_application_entity
    ADD CONSTRAINT ai_application_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.ai_application_entity
    ADD CONSTRAINT ai_application_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_governance_policy_entity
    ADD CONSTRAINT ai_governance_policy_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.ai_governance_policy_entity
    ADD CONSTRAINT ai_governance_policy_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_collection_entity
    ADD CONSTRAINT api_collection_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.api_collection_entity
    ADD CONSTRAINT api_collection_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_endpoint_entity
    ADD CONSTRAINT api_endpoint_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.api_endpoint_entity
    ADD CONSTRAINT api_endpoint_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.api_service_entity
    ADD CONSTRAINT api_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.api_service_entity
    ADD CONSTRAINT api_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.apps_marketplace
    ADD CONSTRAINT apps_marketplace_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.apps_marketplace
    ADD CONSTRAINT apps_marketplace_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_log_event
    ADD CONSTRAINT audit_log_event_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.automations_workflow
    ADD CONSTRAINT automations_workflow_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.automations_workflow
    ADD CONSTRAINT automations_workflow_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.background_jobs
    ADD CONSTRAINT background_jobs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.bot_entity
    ADD CONSTRAINT bot_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.bot_entity
    ADD CONSTRAINT bot_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.change_event_consumers
    ADD CONSTRAINT change_event_consumers_id_extension_key UNIQUE (id, extension);

ALTER TABLE ONLY public.change_event
    ADD CONSTRAINT change_event_pkey PRIMARY KEY ("offset");

ALTER TABLE ONLY public.chart_entity
    ADD CONSTRAINT chart_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.chart_entity
    ADD CONSTRAINT chart_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.classification
    ADD CONSTRAINT classification_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.consumers_dlq
    ADD CONSTRAINT consumers_dlq_id_extension_key UNIQUE (id, extension);

ALTER TABLE ONLY public.dashboard_data_model_entity
    ADD CONSTRAINT dashboard_data_model_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.dashboard_data_model_entity
    ADD CONSTRAINT dashboard_data_model_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dashboard_entity
    ADD CONSTRAINT dashboard_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.dashboard_entity
    ADD CONSTRAINT dashboard_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dashboard_service_entity
    ADD CONSTRAINT dashboard_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.dashboard_service_entity
    ADD CONSTRAINT dashboard_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.data_contract_entity
    ADD CONSTRAINT data_contract_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.data_contract_entity
    ADD CONSTRAINT data_contract_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.data_insight_chart
    ADD CONSTRAINT data_insight_chart_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.data_insight_chart
    ADD CONSTRAINT data_insight_chart_name_key UNIQUE (name);

ALTER TABLE ONLY public.data_product_entity
    ADD CONSTRAINT data_product_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.data_product_entity
    ADD CONSTRAINT data_product_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.data_quality_data_time_series
    ADD CONSTRAINT data_quality_data_time_series_unique_hash_extension_ts UNIQUE (entityfqnhash, extension, "timestamp");

ALTER TABLE ONLY public.database_entity
    ADD CONSTRAINT database_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.database_entity
    ADD CONSTRAINT database_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.database_schema_entity
    ADD CONSTRAINT database_schema_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.database_schema_entity
    ADD CONSTRAINT database_schema_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.dbservice_entity
    ADD CONSTRAINT dbservice_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.dbservice_entity
    ADD CONSTRAINT dbservice_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.di_chart_entity
    ADD CONSTRAINT di_chart_entity_name_key UNIQUE (name);

ALTER TABLE ONLY public.directory_entity
    ADD CONSTRAINT directory_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.directory_entity
    ADD CONSTRAINT directory_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.doc_store
    ADD CONSTRAINT doc_store_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.doc_store
    ADD CONSTRAINT doc_store_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.domain_entity
    ADD CONSTRAINT domain_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.domain_entity
    ADD CONSTRAINT domain_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.drive_service_entity
    ADD CONSTRAINT drive_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.drive_service_entity
    ADD CONSTRAINT drive_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.entity_deletion_lock
    ADD CONSTRAINT entity_deletion_lock_entityid_entitytype_key UNIQUE (entityid, entitytype);

ALTER TABLE ONLY public.entity_deletion_lock
    ADD CONSTRAINT entity_deletion_lock_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.entity_extension
    ADD CONSTRAINT entity_extension_pkey PRIMARY KEY (id, extension);

ALTER TABLE ONLY public.entity_extension_time_series
    ADD CONSTRAINT entity_extension_time_series_constraint UNIQUE (entityfqnhash, extension, "timestamp");

ALTER TABLE ONLY public.entity_relationship
    ADD CONSTRAINT entity_relationship_pkey PRIMARY KEY (fromid, toid, relation, relationtype);

ALTER TABLE ONLY public.apps_data_store
    ADD CONSTRAINT entity_relationship_pky PRIMARY KEY (identifier, type);

ALTER TABLE ONLY public.entity_usage
    ADD CONSTRAINT entity_usage_id_usagedate_key UNIQUE (id, usagedate);

ALTER TABLE ONLY public.event_subscription_entity
    ADD CONSTRAINT event_subscription_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.event_subscription_entity
    ADD CONSTRAINT event_subscription_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.field_relationship
    ADD CONSTRAINT field_relationship_pkey PRIMARY KEY (fromfqnhash, tofqnhash, relation);

ALTER TABLE ONLY public.file_entity
    ADD CONSTRAINT file_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.file_entity
    ADD CONSTRAINT file_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.glossary_entity
    ADD CONSTRAINT glossary_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.glossary_entity
    ADD CONSTRAINT glossary_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.glossary_term_entity
    ADD CONSTRAINT glossary_term_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.glossary_term_entity
    ADD CONSTRAINT glossary_term_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.data_quality_data_time_series
    ADD CONSTRAINT id_unique UNIQUE (id);

ALTER TABLE ONLY public.index_mapping_versions
    ADD CONSTRAINT index_mapping_versions_pkey PRIMARY KEY (entitytype);

ALTER TABLE ONLY public.ingestion_pipeline_entity
    ADD CONSTRAINT ingestion_pipeline_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.ingestion_pipeline_entity
    ADD CONSTRAINT ingestion_pipeline_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.installed_apps
    ADD CONSTRAINT installed_apps_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.installed_apps
    ADD CONSTRAINT installed_apps_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.intake_form_entity
    ADD CONSTRAINT intake_form_entity_entitytype_key UNIQUE (entitytype);

ALTER TABLE ONLY public.intake_form_entity
    ADD CONSTRAINT intake_form_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.intake_form_entity
    ADD CONSTRAINT intake_form_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.kpi_entity
    ADD CONSTRAINT kpi_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.kpi_entity
    ADD CONSTRAINT kpi_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.learning_resource_entity
    ADD CONSTRAINT learning_resource_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.learning_resource_entity
    ADD CONSTRAINT learning_resource_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.llm_model_entity
    ADD CONSTRAINT llm_model_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.llm_model_entity
    ADD CONSTRAINT llm_model_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.llm_service_entity
    ADD CONSTRAINT llm_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.llm_service_entity
    ADD CONSTRAINT llm_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mcp_execution_entity
    ADD CONSTRAINT mcp_execution_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mcp_pending_auth_requests
    ADD CONSTRAINT mcp_pending_auth_requests_auth_request_id_key UNIQUE (auth_request_id);

ALTER TABLE ONLY public.mcp_pending_auth_requests
    ADD CONSTRAINT mcp_pending_auth_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mcp_server_entity
    ADD CONSTRAINT mcp_server_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.mcp_server_entity
    ADD CONSTRAINT mcp_server_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mcp_service_entity
    ADD CONSTRAINT mcp_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.mcp_service_entity
    ADD CONSTRAINT mcp_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.messaging_service_entity
    ADD CONSTRAINT messaging_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.messaging_service_entity
    ADD CONSTRAINT messaging_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.metadata_service_entity
    ADD CONSTRAINT metadata_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.metadata_service_entity
    ADD CONSTRAINT metadata_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.metric_entity
    ADD CONSTRAINT metric_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.metric_entity
    ADD CONSTRAINT metric_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ml_model_entity
    ADD CONSTRAINT ml_model_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.ml_model_entity
    ADD CONSTRAINT ml_model_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.mlmodel_service_entity
    ADD CONSTRAINT mlmodel_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.mlmodel_service_entity
    ADD CONSTRAINT mlmodel_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notification_template_entity
    ADD CONSTRAINT notification_template_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.notification_template_entity
    ADD CONSTRAINT notification_template_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.oauth_authorization_codes
    ADD CONSTRAINT oauth_authorization_codes_code_key UNIQUE (code);

ALTER TABLE ONLY public.oauth_authorization_codes
    ADD CONSTRAINT oauth_authorization_codes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.oauth_clients
    ADD CONSTRAINT oauth_clients_client_id_key UNIQUE (client_id);

ALTER TABLE ONLY public.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY public.openmetadata_settings
    ADD CONSTRAINT openmetadata_settings_configtype_key UNIQUE (configtype);

ALTER TABLE ONLY public.openmetadata_settings
    ADD CONSTRAINT openmetadata_settings_pkey PRIMARY KEY (id, configtype);

ALTER TABLE ONLY public.persona_entity
    ADD CONSTRAINT persona_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.persona_entity
    ADD CONSTRAINT persona_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pipeline_entity
    ADD CONSTRAINT pipeline_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.pipeline_entity
    ADD CONSTRAINT pipeline_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pipeline_service_entity
    ADD CONSTRAINT pipeline_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.pipeline_service_entity
    ADD CONSTRAINT pipeline_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.policy_entity
    ADD CONSTRAINT policy_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.policy_entity
    ADD CONSTRAINT policy_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiler_data_time_series
    ADD CONSTRAINT profiler_data_time_series_unique_hash_extension_ts UNIQUE (entityfqnhash, extension, operation, "timestamp");

ALTER TABLE ONLY public.prompt_template_entity
    ADD CONSTRAINT prompt_template_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.prompt_template_entity
    ADD CONSTRAINT prompt_template_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.qrtz_blob_triggers
    ADD CONSTRAINT qrtz_blob_triggers_pkey PRIMARY KEY (sched_name, trigger_name, trigger_group);

ALTER TABLE ONLY public.qrtz_calendars
    ADD CONSTRAINT qrtz_calendars_pkey PRIMARY KEY (sched_name, calendar_name);

ALTER TABLE ONLY public.qrtz_cron_triggers
    ADD CONSTRAINT qrtz_cron_triggers_pkey PRIMARY KEY (sched_name, trigger_name, trigger_group);

ALTER TABLE ONLY public.qrtz_fired_triggers
    ADD CONSTRAINT qrtz_fired_triggers_pkey PRIMARY KEY (sched_name, entry_id);

ALTER TABLE ONLY public.qrtz_job_details
    ADD CONSTRAINT qrtz_job_details_pkey PRIMARY KEY (sched_name, job_name, job_group);

ALTER TABLE ONLY public.qrtz_locks
    ADD CONSTRAINT qrtz_locks_pkey PRIMARY KEY (sched_name, lock_name);

ALTER TABLE ONLY public.qrtz_paused_trigger_grps
    ADD CONSTRAINT qrtz_paused_trigger_grps_pkey PRIMARY KEY (sched_name, trigger_group);

ALTER TABLE ONLY public.qrtz_scheduler_state
    ADD CONSTRAINT qrtz_scheduler_state_pkey PRIMARY KEY (sched_name, instance_name);

ALTER TABLE ONLY public.qrtz_simple_triggers
    ADD CONSTRAINT qrtz_simple_triggers_pkey PRIMARY KEY (sched_name, trigger_name, trigger_group);

ALTER TABLE ONLY public.qrtz_simprop_triggers
    ADD CONSTRAINT qrtz_simprop_triggers_pkey PRIMARY KEY (sched_name, trigger_name, trigger_group);

ALTER TABLE ONLY public.qrtz_triggers
    ADD CONSTRAINT qrtz_triggers_pkey PRIMARY KEY (sched_name, trigger_name, trigger_group);

ALTER TABLE ONLY public.query_cost_time_series
    ADD CONSTRAINT query_cost_unique_constraint UNIQUE ("timestamp", entityfqnhash);

ALTER TABLE ONLY public.query_entity
    ADD CONSTRAINT query_entity_namehash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.query_entity
    ADD CONSTRAINT query_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rdf_index_job
    ADD CONSTRAINT rdf_index_job_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rdf_index_partition
    ADD CONSTRAINT rdf_index_partition_jobid_entitytype_partitionindex_key UNIQUE (jobid, entitytype, partitionindex);

ALTER TABLE ONLY public.rdf_index_partition
    ADD CONSTRAINT rdf_index_partition_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rdf_index_server_stats
    ADD CONSTRAINT rdf_index_server_stats_jobid_serverid_entitytype_key UNIQUE (jobid, serverid, entitytype);

ALTER TABLE ONLY public.rdf_index_server_stats
    ADD CONSTRAINT rdf_index_server_stats_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rdf_reindex_lock
    ADD CONSTRAINT rdf_reindex_lock_pkey PRIMARY KEY (lockkey);

ALTER TABLE ONLY public.recognizer_feedback_entity
    ADD CONSTRAINT recognizer_feedback_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.report_entity
    ADD CONSTRAINT report_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.report_entity
    ADD CONSTRAINT report_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.role_entity
    ADD CONSTRAINT role_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.role_entity
    ADD CONSTRAINT role_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.search_index_entity
    ADD CONSTRAINT search_index_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.search_index_entity
    ADD CONSTRAINT search_index_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.search_index_failures
    ADD CONSTRAINT search_index_failures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.search_index_job
    ADD CONSTRAINT search_index_job_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.search_index_partition
    ADD CONSTRAINT search_index_partition_jobid_entitytype_partitionindex_key UNIQUE (jobid, entitytype, partitionindex);

ALTER TABLE ONLY public.search_index_partition
    ADD CONSTRAINT search_index_partition_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.search_index_retry_queue
    ADD CONSTRAINT search_index_retry_queue_pkey PRIMARY KEY (entityid, entityfqn);

ALTER TABLE ONLY public.search_index_server_stats
    ADD CONSTRAINT search_index_server_stats_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.search_reindex_lock
    ADD CONSTRAINT search_reindex_lock_pkey PRIMARY KEY (lockkey);

ALTER TABLE ONLY public.search_service_entity
    ADD CONSTRAINT search_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.search_service_entity
    ADD CONSTRAINT search_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.security_service_entity
    ADD CONSTRAINT security_service_entity_name_key UNIQUE (name);

ALTER TABLE ONLY public.security_service_entity
    ADD CONSTRAINT security_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.spreadsheet_entity
    ADD CONSTRAINT spreadsheet_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.spreadsheet_entity
    ADD CONSTRAINT spreadsheet_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.storage_container_entity
    ADD CONSTRAINT storage_container_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.storage_container_entity
    ADD CONSTRAINT storage_container_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.storage_service_entity
    ADD CONSTRAINT storage_service_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.storage_service_entity
    ADD CONSTRAINT storage_service_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stored_procedure_entity
    ADD CONSTRAINT stored_procedure_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.stored_procedure_entity
    ADD CONSTRAINT stored_procedure_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.successful_sent_change_events
    ADD CONSTRAINT successful_sent_change_events_pkey PRIMARY KEY (change_event_id, event_subscription_id);

ALTER TABLE ONLY public.suggestions
    ADD CONSTRAINT suggestions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.table_entity
    ADD CONSTRAINT table_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.table_entity
    ADD CONSTRAINT table_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_pk PRIMARY KEY (id);

ALTER TABLE ONLY public.tag_usage
    ADD CONSTRAINT tag_usage_source_tagfqnhash_targetfqnhash_key UNIQUE (source, tagfqnhash, targetfqnhash);

ALTER TABLE ONLY public.thread_entity
    ADD CONSTRAINT task_id_constraint UNIQUE (taskid);

ALTER TABLE ONLY public.task_sequence
    ADD CONSTRAINT task_sequence_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.team_entity
    ADD CONSTRAINT team_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.team_entity
    ADD CONSTRAINT team_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.test_case_dimension_results_time_series
    ADD CONSTRAINT test_case_dimension_results_unique_constraint UNIQUE (entityfqnhash, dimensionkey, "timestamp");

ALTER TABLE ONLY public.test_case
    ADD CONSTRAINT test_case_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.test_case_resolution_status_time_series
    ADD CONSTRAINT test_case_resolution_status_unique_constraint UNIQUE (id, "timestamp", entityfqnhash);

ALTER TABLE ONLY public.test_connection_definition
    ADD CONSTRAINT test_connection_definition_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.test_definition
    ADD CONSTRAINT test_definition_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.test_suite
    ADD CONSTRAINT test_suite_namehash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.thread_entity
    ADD CONSTRAINT thread_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.topic_entity
    ADD CONSTRAINT topic_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.topic_entity
    ADD CONSTRAINT topic_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.type_entity
    ADD CONSTRAINT type_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.type_entity
    ADD CONSTRAINT type_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT unique_fqnhash UNIQUE (fqnhash);

ALTER TABLE ONLY public.query_entity
    ADD CONSTRAINT unique_query_checksum UNIQUE (checksum);

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT user_entity_email_key UNIQUE (email);

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT user_entity_name_key UNIQUE (name);

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT user_entity_namehash_key UNIQUE (namehash);

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT user_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_tokens
    ADD CONSTRAINT user_tokens_pkey PRIMARY KEY (token);

ALTER TABLE ONLY public.web_analytic_event
    ADD CONSTRAINT web_analytic_event_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.web_analytic_event
    ADD CONSTRAINT web_analytic_event_name_key UNIQUE (name);

ALTER TABLE ONLY public.workflow_definition_entity
    ADD CONSTRAINT workflow_definition_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.workflow_definition_entity
    ADD CONSTRAINT workflow_definition_entity_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workflow_instance_state_time_series
    ADD CONSTRAINT workflow_instance_state_time_series_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workflow_instance_state_time_series
    ADD CONSTRAINT workflow_instance_state_time_series_unique_constraint UNIQUE (id, entityfqnhash);

ALTER TABLE ONLY public.workflow_instance_time_series
    ADD CONSTRAINT workflow_instance_time_series_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workflow_instance_time_series
    ADD CONSTRAINT workflow_instance_time_series_unique_constraint UNIQUE (id, entityfqnhash);

ALTER TABLE ONLY public.worksheet_entity
    ADD CONSTRAINT worksheet_entity_fqnhash_key UNIQUE (fqnhash);

ALTER TABLE ONLY public.worksheet_entity
    ADD CONSTRAINT worksheet_entity_pkey PRIMARY KEY (id);

CREATE INDEX IF NOT EXISTS agent_execution_agent_index ON public.agent_execution_entity USING btree (agentid);

CREATE INDEX IF NOT EXISTS agent_execution_timestamp_index ON public.agent_execution_entity USING btree ("timestamp");

CREATE INDEX IF NOT EXISTS ai_application_deleted_index ON public.ai_application_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS ai_application_name_index ON public.ai_application_entity USING btree (name);

CREATE INDEX IF NOT EXISTS ai_governance_policy_deleted_index ON public.ai_governance_policy_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS ai_governance_policy_name_index ON public.ai_governance_policy_entity USING btree (name);

CREATE INDEX IF NOT EXISTS api_collection_entity_name_index ON public.api_collection_entity USING btree (name);

CREATE INDEX IF NOT EXISTS api_endpoint_entity_name_index ON public.api_endpoint_entity USING btree (name);

CREATE INDEX IF NOT EXISTS api_service_entity_name_index ON public.api_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS apps_extension_time_series_extension ON public.apps_extension_time_series USING btree (extension);

CREATE INDEX IF NOT EXISTS apps_extension_time_series_index ON public.apps_extension_time_series USING btree (appid);

CREATE INDEX IF NOT EXISTS apps_extension_time_series_timestamp ON public.apps_extension_time_series USING btree ("timestamp");

CREATE INDEX IF NOT EXISTS background_jobs_run_at_index ON public.background_jobs USING btree (runat);

CREATE INDEX IF NOT EXISTS change_event_entity_type_index ON public.change_event USING btree (entitytype);

CREATE INDEX IF NOT EXISTS change_event_event_time_index ON public.change_event USING btree (eventtime);

CREATE INDEX IF NOT EXISTS change_event_event_type_index ON public.change_event USING btree (eventtype);

CREATE INDEX IF NOT EXISTS created_at_index ON public.thread_entity USING btree (createdat);

CREATE INDEX IF NOT EXISTS data_contract_entity_name_index ON public.data_contract_entity USING btree (name);

CREATE INDEX IF NOT EXISTS data_quality_data_time_series_combined_id_ts ON public.data_quality_data_time_series USING btree (extension, "timestamp");

CREATE INDEX IF NOT EXISTS data_quality_data_time_series_id_index ON public.data_quality_data_time_series USING btree (id);

CREATE INDEX IF NOT EXISTS data_quality_data_time_series_incidentid ON public.data_quality_data_time_series USING btree (incidentid);

CREATE INDEX IF NOT EXISTS directory_entity_name_index ON public.directory_entity USING btree (name);

CREATE INDEX IF NOT EXISTS drive_service_entity_name_index ON public.drive_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS entity_relationship_from_index ON public.entity_relationship USING btree (fromid, relation);

CREATE INDEX IF NOT EXISTS entity_relationship_to_index ON public.entity_relationship USING btree (toid, relation);

CREATE INDEX IF NOT EXISTS entity_usage_percentile_idx ON public.entity_usage USING btree (usagedate, entitytype);

CREATE INDEX IF NOT EXISTS extension_index ON public.entity_extension USING btree (extension);

CREATE INDEX IF NOT EXISTS field_relationship_from_index ON public.field_relationship USING btree (fromfqnhash, relation);

CREATE INDEX IF NOT EXISTS field_relationship_to_index ON public.field_relationship USING btree (tofqnhash, relation);

CREATE INDEX IF NOT EXISTS file_entity_name_index ON public.file_entity USING btree (name);

CREATE INDEX IF NOT EXISTS from_entity_type_index ON public.entity_relationship USING btree (fromid, fromentity);

CREATE INDEX IF NOT EXISTS gin_tag_usage_targetfqn_trgm ON public.tag_usage USING gin (targetfqnhash public.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_api_collection_entity_deleted_name_id ON public.api_collection_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_api_collection_entity_fqnhash_pattern ON public.api_collection_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_api_collection_entity_updated_at_id ON public.api_collection_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_api_endpoint_entity_deleted_name_id ON public.api_endpoint_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_api_endpoint_entity_fqnhash_pattern ON public.api_endpoint_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_api_endpoint_entity_updated_at_id ON public.api_endpoint_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_api_service_entity_deleted_name ON public.api_service_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_api_service_entity_updated_at_id ON public.api_service_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_apps_extension_composite ON public.apps_extension_time_series USING btree (appid, extension, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_type_ts ON public.audit_log_event USING btree (actor_type, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log_event USING btree (created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_log_event_change_event_id ON public.audit_log_event USING btree (change_event_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_entity_hash_ts ON public.audit_log_event USING btree (entity_fqn_hash, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_ts ON public.audit_log_event USING btree (event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_user_ts ON public.audit_log_event USING btree (user_name, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_search_text ON public.audit_log_event USING gin (to_tsvector('english'::regconfig, COALESCE(search_text, ''::text)));

CREATE INDEX IF NOT EXISTS idx_audit_log_service_name_ts ON public.audit_log_event USING btree (service_name, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_bot_entity_deleted_name ON public.bot_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_chart_entity_deleted ON public.chart_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_chart_entity_deleted_name_id ON public.chart_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_chart_entity_fqnhash_pattern ON public.chart_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_chart_entity_updated_at_id ON public.chart_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_classification_updated_at_id ON public.classification USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_consumers_dlq_source ON public.consumers_dlq USING btree (source);

CREATE INDEX IF NOT EXISTS idx_consumers_dlq_timestamp_desc ON public.consumers_dlq USING btree ("timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_createdby ON public.background_jobs USING btree (createdby);

CREATE INDEX IF NOT EXISTS idx_dashboard_data_model_entity_deleted_name_id ON public.dashboard_data_model_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_dashboard_data_model_entity_fqnhash_pattern ON public.dashboard_data_model_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_dashboard_data_model_entity_updated_at_id ON public.dashboard_data_model_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_entity_deleted ON public.dashboard_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_dashboard_entity_deleted_name_id ON public.dashboard_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_dashboard_entity_fqnhash_pattern ON public.dashboard_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_dashboard_entity_updated_at_id ON public.dashboard_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_service_entity_deleted_name ON public.dashboard_service_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_dashboard_service_entity_updated_at_id ON public.dashboard_service_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_data_contract_entity_deleted_name_id ON public.data_contract_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_data_product_entity_updated_at_id ON public.data_product_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_data_quality_data_ts_keyset ON public.data_quality_data_time_series USING btree ("timestamp", entityfqnhash);

CREATE INDEX IF NOT EXISTS idx_database_entity_deleted ON public.database_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_database_entity_deleted_name_id ON public.database_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_database_entity_fqnhash_pattern ON public.database_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_database_entity_updated_at_id ON public.database_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_database_schema_entity_deleted ON public.database_schema_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_database_schema_entity_deleted_name_id ON public.database_schema_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_database_schema_entity_fqnhash_pattern ON public.database_schema_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_database_schema_entity_updated_at_id ON public.database_schema_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_dbservice_entity_deleted_name ON public.dbservice_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_dbservice_entity_updated_at_id ON public.dbservice_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_deletion_lock_fqn ON public.entity_deletion_lock USING btree (entityfqn);

CREATE INDEX IF NOT EXISTS idx_deletion_lock_time ON public.entity_deletion_lock USING btree (lockedat);

CREATE INDEX IF NOT EXISTS idx_directory_deleted ON public.directory_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_directory_entity_fqnhash_pattern ON public.directory_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_directory_fqn ON public.directory_entity USING btree (fullyqualifiedname);

CREATE INDEX IF NOT EXISTS idx_directory_name ON public.directory_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_directory_service ON public.directory_entity USING btree ((((json -> 'service'::text) ->> 'id'::text)));

CREATE INDEX IF NOT EXISTS idx_domain_entity_updated_at_id ON public.domain_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_drive_service_name ON public.drive_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_entity_extension_ts_keyset ON public.entity_extension_time_series USING btree ("timestamp", entityfqnhash);

CREATE INDEX IF NOT EXISTS idx_entity_extension_updated_at_id ON public.entity_extension USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_entity_rel_cascade ON public.entity_relationship USING btree (fromid, relation, toentity, toid) WHERE (relation = ANY (ARRAY[0, 8]));

CREATE INDEX IF NOT EXISTS idx_entity_rel_from_delete ON public.entity_relationship USING btree (fromid, fromentity, toid, toentity, relation);

CREATE INDEX IF NOT EXISTS idx_entity_rel_to_delete ON public.entity_relationship USING btree (toid, toentity, fromid, fromentity, relation);

CREATE INDEX IF NOT EXISTS idx_entity_relationship_bidirectional ON public.entity_relationship USING btree (fromid, toid, relation) WHERE (deleted = false);

CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_deleted ON public.entity_relationship USING btree (fromid, fromentity, relation) INCLUDE (toid, toentity, relation) WHERE (deleted = false);

CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_relation ON public.entity_relationship USING btree (fromid, relation);

CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_type_relation ON public.entity_relationship USING btree (fromid, fromentity, relation);

CREATE INDEX IF NOT EXISTS idx_entity_relationship_from_typed ON public.entity_relationship USING btree (toid, toentity, relation, fromentity) INCLUDE (fromentity, toentity) WHERE (deleted = false);

CREATE INDEX IF NOT EXISTS idx_entity_relationship_fromentity_fromid_relation ON public.entity_relationship USING btree (fromentity, fromid, relation);

CREATE INDEX IF NOT EXISTS idx_entity_relationship_to_deleted ON public.entity_relationship USING btree (toid, toentity, relation) INCLUDE (fromid, fromentity, relation) WHERE (deleted = false);

CREATE INDEX IF NOT EXISTS idx_entity_relationship_to_relation ON public.entity_relationship USING btree (toid, relation);

CREATE INDEX IF NOT EXISTS idx_entity_relationship_to_type_relation ON public.entity_relationship USING btree (toid, toentity, relation);

CREATE INDEX IF NOT EXISTS idx_entity_timestamp_desc ON public.data_quality_data_time_series USING btree (entityfqnhash, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_er_fromentity_fromid_toentity_relation ON public.entity_relationship USING btree (fromentity, fromid, toentity, relation);

CREATE INDEX IF NOT EXISTS idx_er_fromentity_toentity ON public.entity_relationship USING btree (fromentity, toentity);

CREATE INDEX IF NOT EXISTS idx_er_fromentity_toentity_relation_toid ON public.entity_relationship USING btree (fromentity, toentity, relation, toid);

CREATE INDEX IF NOT EXISTS idx_er_relation_fromentity_toid ON public.entity_relationship USING btree (relation, fromentity, toid);

CREATE INDEX IF NOT EXISTS idx_er_toentity_toid_relation ON public.entity_relationship USING btree (toentity, toid, relation);

CREATE INDEX IF NOT EXISTS idx_event_subscription_id ON public.successful_sent_change_events USING btree (event_subscription_id);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON public.recognizer_feedback_entity USING btree (createdat);

CREATE INDEX IF NOT EXISTS idx_feedback_entity ON public.recognizer_feedback_entity USING btree (entitylink);

CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.recognizer_feedback_entity USING btree (status);

CREATE INDEX IF NOT EXISTS idx_feedback_tag ON public.recognizer_feedback_entity USING btree (tagfqn);

CREATE INDEX IF NOT EXISTS idx_field_relationship_from ON public.field_relationship USING btree (fromtype, fromfqnhash, totype, relation);

CREATE INDEX IF NOT EXISTS idx_field_relationship_to ON public.field_relationship USING btree (fromtype, tofqnhash, totype, relation);

CREATE INDEX IF NOT EXISTS idx_file_deleted ON public.file_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_file_directory ON public.file_entity USING btree ((((json -> 'directory'::text) ->> 'id'::text)));

CREATE INDEX IF NOT EXISTS idx_file_directory_fqn ON public.file_entity USING btree (directoryfqn);

CREATE INDEX IF NOT EXISTS idx_file_entity_fqnhash_pattern ON public.file_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_file_filetype ON public.file_entity USING btree (filetype);

CREATE INDEX IF NOT EXISTS idx_file_fqn ON public.file_entity USING btree (fullyqualifiedname);

CREATE INDEX IF NOT EXISTS idx_file_name ON public.file_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_glossary_entity_deleted ON public.glossary_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_glossary_entity_deleted_name ON public.glossary_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_glossary_entity_updated_at_id ON public.glossary_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_glossary_term_displayname ON public.glossary_term_entity USING btree (displayname);

CREATE INDEX IF NOT EXISTS idx_glossary_term_entity_deleted ON public.glossary_term_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_glossary_term_entity_deleted_name_id ON public.glossary_term_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_glossary_term_entity_fqnhash_pattern ON public.glossary_term_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_glossary_term_entity_status ON public.glossary_term_entity USING btree (entitystatus);

CREATE INDEX IF NOT EXISTS idx_glossary_term_entity_updated_at_id ON public.glossary_term_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_index_mapping_versions_updatedat ON public.index_mapping_versions USING btree (updatedat);

CREATE INDEX IF NOT EXISTS idx_index_mapping_versions_version ON public.index_mapping_versions USING btree (version);

CREATE INDEX IF NOT EXISTS idx_ingestion_pipeline_entity_deleted_name_id ON public.ingestion_pipeline_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_ingestion_pipeline_entity_fqnhash_pattern ON public.ingestion_pipeline_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_ingestion_pipeline_entity_updated_at_id ON public.ingestion_pipeline_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_isbot ON public.user_entity USING btree (isbot);

CREATE INDEX IF NOT EXISTS idx_jobtype ON public.background_jobs USING btree (jobtype);

CREATE INDEX IF NOT EXISTS idx_kpi_entity_deleted_name ON public.kpi_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_mcp_pending_auth_expires ON public.mcp_pending_auth_requests USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_mcp_pending_auth_pac4j_state ON public.mcp_pending_auth_requests USING btree (pac4j_state);

CREATE INDEX IF NOT EXISTS idx_mcp_pending_auth_request_id ON public.mcp_pending_auth_requests USING btree (auth_request_id);

CREATE INDEX IF NOT EXISTS idx_messaging_service_entity_deleted_name ON public.messaging_service_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_messaging_service_entity_updated_at_id ON public.messaging_service_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_messaging_service_name_entity ON public.messaging_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_metadata_service_entity_deleted_name ON public.metadata_service_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_metadata_service_entity_updated_at_id ON public.metadata_service_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_metadata_service_name_entity ON public.metadata_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_metric_custom_unit ON public.metric_entity USING btree (customunitofmeasurement);

CREATE INDEX IF NOT EXISTS idx_metric_entity_deleted_name_id ON public.metric_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_metric_entity_fqnhash_pattern ON public.metric_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_metric_name_entity ON public.metric_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_ml_model_entity_deleted ON public.ml_model_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_ml_model_entity_deleted_name_id ON public.ml_model_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_ml_model_entity_fqnhash_pattern ON public.ml_model_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_ml_model_entity_updated_at_id ON public.ml_model_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_ml_model_name_entity ON public.ml_model_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_ml_model_service_name_entity ON public.mlmodel_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_mlmodel_service_entity_deleted_name ON public.mlmodel_service_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_mlmodel_service_entity_updated_at_id ON public.mlmodel_service_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_name_automations_workflow ON public.automations_workflow USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_bot_entity ON public.bot_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_chart_entity ON public.chart_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_classification_entity ON public.classification USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_dashboard_data_model_entity ON public.dashboard_data_model_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_dashboard_entity ON public.dashboard_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_dashboard_insight_chart ON public.data_insight_chart USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_dashboard_service_entity ON public.dashboard_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_data_product_entity ON public.data_product_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_data_search_index_entity ON public.search_index_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_data_search_service_entity ON public.search_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_data_stored_procedure_entity ON public.stored_procedure_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_database_entity ON public.database_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_database_schema_entity ON public.database_schema_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_db_service_entity ON public.dbservice_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_domain_entity ON public.domain_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_event_subscription_entity ON public.event_subscription_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_glossary_entity ON public.glossary_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_glossary_term_entity ON public.glossary_term_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_ingestion_pipeline_entity ON public.ingestion_pipeline_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_kpi_entity ON public.kpi_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_policy_entity ON public.policy_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_query_entity ON public.query_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_report_entity ON public.report_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_role_entity ON public.role_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_storage_container_entity ON public.storage_container_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_storage_service_entity ON public.storage_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_table_entity ON public.table_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_tag_entity ON public.tag USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_team_entity ON public.team_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_test_case ON public.test_case USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_test_connection_definition ON public.test_connection_definition USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_test_definition ON public.test_definition USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_test_suite ON public.test_suite USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_topic_entity ON public.topic_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_type_entity ON public.type_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_user_entity ON public.user_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_name_web_analytic_event ON public.web_analytic_event USING btree (name);

CREATE INDEX IF NOT EXISTS idx_notification_template_name ON public.notification_template_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_notification_template_provider ON public.notification_template_entity USING btree (provider);

CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_client_id ON public.oauth_access_tokens USING btree (client_id);

CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_expires_at ON public.oauth_access_tokens USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_access_tokens_hash ON public.oauth_access_tokens USING btree (token_hash);

CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_client_id ON public.oauth_authorization_codes USING btree (client_id);

CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_code ON public.oauth_authorization_codes USING btree (code);

CREATE INDEX IF NOT EXISTS idx_oauth_authz_codes_expires_at ON public.oauth_authorization_codes USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON public.oauth_clients USING btree (client_id);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_client_id ON public.oauth_refresh_tokens USING btree (client_id);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_expires_at ON public.oauth_refresh_tokens USING btree (expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_hash ON public.oauth_refresh_tokens USING btree (token_hash);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_revoked ON public.oauth_refresh_tokens USING btree (revoked);

CREATE INDEX IF NOT EXISTS idx_offset_event_time ON public.change_event USING btree ("offset", eventtime);

CREATE INDEX IF NOT EXISTS idx_partition_assigned_server ON public.search_index_partition USING btree (jobid, assignedserver);

CREATE INDEX IF NOT EXISTS idx_partition_claimable ON public.search_index_partition USING btree (jobid, status, claimableat);

CREATE INDEX IF NOT EXISTS idx_partition_claimed ON public.search_index_partition USING btree (claimedat);

CREATE INDEX IF NOT EXISTS idx_partition_job ON public.search_index_partition USING btree (jobid);

CREATE INDEX IF NOT EXISTS idx_partition_status_priority ON public.search_index_partition USING btree (status, priority DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_entity_deleted ON public.pipeline_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_pipeline_entity_deleted_name_id ON public.pipeline_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_pipeline_entity_updated_at_id ON public.pipeline_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_name_entity ON public.pipeline_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_pipeline_service_entity_deleted_name ON public.pipeline_service_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_pipeline_service_entity_updated_at_id ON public.pipeline_service_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_pipeline_service_name_entity ON public.pipeline_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_policy_entity_deleted_name_id ON public.policy_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_policy_entity_fqnhash_pattern ON public.policy_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_qrtz_ft_inst_job_req_rcvry ON public.qrtz_fired_triggers USING btree (sched_name, instance_name, requests_recovery);

CREATE INDEX IF NOT EXISTS idx_qrtz_ft_j_g ON public.qrtz_fired_triggers USING btree (sched_name, job_name, job_group);

CREATE INDEX IF NOT EXISTS idx_qrtz_ft_jg ON public.qrtz_fired_triggers USING btree (sched_name, job_group);

CREATE INDEX IF NOT EXISTS idx_qrtz_ft_t_g ON public.qrtz_fired_triggers USING btree (sched_name, trigger_name, trigger_group);

CREATE INDEX IF NOT EXISTS idx_qrtz_ft_tg ON public.qrtz_fired_triggers USING btree (sched_name, trigger_group);

CREATE INDEX IF NOT EXISTS idx_qrtz_ft_trig_inst_name ON public.qrtz_fired_triggers USING btree (sched_name, instance_name);

CREATE INDEX IF NOT EXISTS idx_qrtz_j_grp ON public.qrtz_job_details USING btree (sched_name, job_group);

CREATE INDEX IF NOT EXISTS idx_qrtz_j_req_recovery ON public.qrtz_job_details USING btree (sched_name, requests_recovery);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_c ON public.qrtz_triggers USING btree (sched_name, calendar_name);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_g ON public.qrtz_triggers USING btree (sched_name, trigger_group);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_j ON public.qrtz_triggers USING btree (sched_name, job_name, job_group);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_jg ON public.qrtz_triggers USING btree (sched_name, job_group);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_n_g_state ON public.qrtz_triggers USING btree (sched_name, trigger_group, trigger_state);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_n_state ON public.qrtz_triggers USING btree (sched_name, trigger_name, trigger_group, trigger_state);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_next_fire_time ON public.qrtz_triggers USING btree (sched_name, next_fire_time);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_nft_misfire ON public.qrtz_triggers USING btree (sched_name, misfire_instr, next_fire_time);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_nft_st ON public.qrtz_triggers USING btree (sched_name, trigger_state, next_fire_time);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_nft_st_misfire ON public.qrtz_triggers USING btree (sched_name, misfire_instr, next_fire_time, trigger_state);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_nft_st_misfire_grp ON public.qrtz_triggers USING btree (sched_name, misfire_instr, next_fire_time, trigger_group, trigger_state);

CREATE INDEX IF NOT EXISTS idx_qrtz_t_state ON public.qrtz_triggers USING btree (sched_name, trigger_state);

CREATE INDEX IF NOT EXISTS idx_query_cost_ts_keyset ON public.query_cost_time_series USING btree ("timestamp", entityfqnhash);

CREATE INDEX IF NOT EXISTS idx_query_entity_fqnhash_pattern ON public.query_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_rdf_index_job_created ON public.rdf_index_job USING btree (createdat DESC);

CREATE INDEX IF NOT EXISTS idx_rdf_index_job_status ON public.rdf_index_job USING btree (status);

CREATE INDEX IF NOT EXISTS idx_rdf_index_server_stats_job_id ON public.rdf_index_server_stats USING btree (jobid);

CREATE INDEX IF NOT EXISTS idx_rdf_partition_assigned_server ON public.rdf_index_partition USING btree (jobid, assignedserver);

CREATE INDEX IF NOT EXISTS idx_rdf_partition_claimable ON public.rdf_index_partition USING btree (jobid, status, claimableat);

CREATE INDEX IF NOT EXISTS idx_rdf_partition_job ON public.rdf_index_partition USING btree (jobid);

CREATE INDEX IF NOT EXISTS idx_rdf_partition_status_priority ON public.rdf_index_partition USING btree (status, priority DESC);

CREATE INDEX IF NOT EXISTS idx_report_data_ts_keyset ON public.report_data_time_series USING btree ("timestamp", entityfqnhash);

CREATE INDEX IF NOT EXISTS idx_report_entity_deleted_name_id ON public.report_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_report_entity_fqnhash_pattern ON public.report_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_role_entity_deleted_name ON public.role_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_search_index_entity_deleted_name_id ON public.search_index_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_search_index_entity_fqnhash_pattern ON public.search_index_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_search_index_entity_updated_at_id ON public.search_index_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_search_index_failures_entity_type ON public.search_index_failures USING btree (entitytype);

CREATE INDEX IF NOT EXISTS idx_search_index_failures_job_id ON public.search_index_failures USING btree (jobid);

CREATE INDEX IF NOT EXISTS idx_search_index_failures_server_id ON public.search_index_failures USING btree (serverid);

CREATE INDEX IF NOT EXISTS idx_search_index_failures_timestamp ON public.search_index_failures USING btree ("timestamp");

CREATE INDEX IF NOT EXISTS idx_search_index_job_created ON public.search_index_job USING btree (createdat DESC);

CREATE INDEX IF NOT EXISTS idx_search_index_job_status ON public.search_index_job USING btree (status);

CREATE INDEX IF NOT EXISTS idx_search_index_retry_queue_claimed ON public.search_index_retry_queue USING btree (claimedat);

CREATE INDEX IF NOT EXISTS idx_search_index_retry_queue_status ON public.search_index_retry_queue USING btree (status);

CREATE INDEX IF NOT EXISTS idx_search_index_server_stats_job_id ON public.search_index_server_stats USING btree (jobid);

CREATE UNIQUE INDEX IF NOT EXISTS idx_search_index_server_stats_job_server_entity ON public.search_index_server_stats USING btree (jobid, serverid, entitytype);

CREATE INDEX IF NOT EXISTS idx_search_service_entity_deleted_name ON public.search_service_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_search_service_entity_updated_at_id ON public.search_service_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_deleted ON public.spreadsheet_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_directory ON public.spreadsheet_entity USING btree ((((json -> 'directory'::text) ->> 'id'::text)));

CREATE INDEX IF NOT EXISTS idx_spreadsheet_directory_fqn ON public.spreadsheet_entity USING btree (directoryfqn);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_entity_fqnhash_pattern ON public.spreadsheet_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_fqn ON public.spreadsheet_entity USING btree (fullyqualifiedname);

CREATE INDEX IF NOT EXISTS idx_spreadsheet_name ON public.spreadsheet_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_status ON public.background_jobs USING btree (status);

CREATE INDEX IF NOT EXISTS idx_status_createdat ON public.background_jobs USING btree (status, createdat);

CREATE INDEX IF NOT EXISTS idx_storage_container_entity_deleted_name_id ON public.storage_container_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_storage_container_entity_fqnhash_pattern ON public.storage_container_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_storage_container_entity_updated_at_id ON public.storage_container_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_storage_service_entity_deleted_name ON public.storage_service_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_storage_service_entity_updated_at_id ON public.storage_service_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_stored_procedure_entity_updated_at_id ON public.stored_procedure_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_stored_procedure_schema_listing ON public.stored_procedure_entity USING btree (deleted, databaseschemahash, name, id);

CREATE INDEX IF NOT EXISTS idx_successful_events_subscription_timestamp ON public.successful_sent_change_events USING btree (event_subscription_id, "timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_successful_events_timestamp_desc ON public.successful_sent_change_events USING btree ("timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_table_entity_deleted ON public.table_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_table_entity_deleted_fqnhash ON public.table_entity USING btree (deleted, fqnhash);

CREATE INDEX IF NOT EXISTS idx_table_entity_fqnhash_pattern ON public.table_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_table_entity_name_id ON public.table_entity USING btree (name, id);

CREATE INDEX IF NOT EXISTS idx_table_entity_schema_listing ON public.table_entity USING btree (deleted, databaseschemahash, name, id);

CREATE INDEX IF NOT EXISTS idx_table_entity_updated_at_id ON public.table_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_tag_classification_deleted ON public.tag USING btree (classificationhash, deleted);

CREATE INDEX IF NOT EXISTS idx_tag_classification_hash_deleted ON public.tag USING btree (classificationhash, deleted);

CREATE INDEX IF NOT EXISTS idx_tag_updated_at_id ON public.tag USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_tag_usage_join_source ON public.tag_usage USING btree (tagfqnhash, source) INCLUDE (targetfqnhash, tagfqn, labeltype, state);

CREATE INDEX IF NOT EXISTS idx_tag_usage_source_target ON public.tag_usage USING btree (source, targetfqnhash);

CREATE INDEX IF NOT EXISTS idx_tag_usage_tag_fqn_hash ON public.tag_usage USING btree (tagfqnhash);

CREATE INDEX IF NOT EXISTS idx_tag_usage_tagfqn_lower_pattern ON public.tag_usage USING btree (tagfqn_lower text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_tag_usage_tagfqn_prefix_covering ON public.tag_usage USING btree (source, tagfqn_lower text_pattern_ops) INCLUDE (targetfqnhash, labeltype, state);

CREATE INDEX IF NOT EXISTS idx_tag_usage_target_exact ON public.tag_usage USING btree (source, targetfqnhash, state) INCLUDE (tagfqn, labeltype);

CREATE INDEX IF NOT EXISTS idx_tag_usage_target_fqn_hash ON public.tag_usage USING btree (targetfqnhash);

CREATE INDEX IF NOT EXISTS idx_tag_usage_target_prefix_covering ON public.tag_usage USING btree (source, targetfqnhash_lower text_pattern_ops) INCLUDE (tagfqn, labeltype, state);

CREATE INDEX IF NOT EXISTS idx_tag_usage_target_source ON public.tag_usage USING btree (targetfqnhash, source, tagfqn);

CREATE INDEX IF NOT EXISTS idx_tag_usage_targetfqnhash_lower_pattern ON public.tag_usage USING btree (targetfqnhash_lower text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_task_assignees_ids_fulltext ON public.thread_entity USING gin (to_tsvector('simple'::regconfig, taskassigneesids));

CREATE INDEX IF NOT EXISTS idx_team_entity_deleted ON public.team_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_team_entity_deleted_name ON public.team_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_team_entity_updated_at_id ON public.team_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_test_case_fqnhash_pattern ON public.test_case USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_test_case_resolution_status_ts_keyset ON public.test_case_resolution_status_time_series USING btree ("timestamp", entityfqnhash);

CREATE INDEX IF NOT EXISTS idx_test_case_updated_at_id ON public.test_case USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_test_definition_enabled ON public.test_definition USING btree (enabled);

CREATE INDEX IF NOT EXISTS idx_test_suite_updated_at_id ON public.test_suite USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_testcaseresolutionstatusid ON public.thread_entity USING btree (testcaseresolutionstatusid);

CREATE INDEX IF NOT EXISTS idx_thread_entity_createdby_type ON public.thread_entity USING btree (createdby, type);

CREATE INDEX IF NOT EXISTS idx_thread_entity_entityid ON public.thread_entity USING btree (entityid);

CREATE INDEX IF NOT EXISTS idx_thread_entity_hash_id ON public.thread_entity USING btree (hash_id);

CREATE INDEX IF NOT EXISTS idx_thread_entity_id_type_status ON public.thread_entity USING btree (id, type, taskstatus);

CREATE INDEX IF NOT EXISTS idx_thread_entity_type_announcementdates ON public.thread_entity USING btree (type, announcementstart, announcementend);

CREATE INDEX IF NOT EXISTS idx_thread_entity_type_taskstatus_createdat ON public.thread_entity USING btree (type, taskstatus, createdat DESC);

CREATE INDEX IF NOT EXISTS idx_thread_type_resolved_createdat ON public.thread_entity USING btree (type, resolved, createdat DESC);

CREATE INDEX IF NOT EXISTS idx_timestamp_desc ON public.data_quality_data_time_series USING btree ("timestamp" DESC);

CREATE INDEX IF NOT EXISTS idx_topic_entity_deleted ON public.topic_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_topic_entity_deleted_name_id ON public.topic_entity USING btree (deleted, name, id);

CREATE INDEX IF NOT EXISTS idx_topic_entity_fqnhash_pattern ON public.topic_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_topic_entity_updated_at_id ON public.topic_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_type_task_status ON public.thread_entity USING btree (type, taskstatus);

CREATE INDEX IF NOT EXISTS idx_updatedat ON public.background_jobs USING btree (updatedat);

CREATE INDEX IF NOT EXISTS idx_user_entity_deleted ON public.user_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_user_entity_deleted_name ON public.user_entity USING btree (deleted, name);

CREATE INDEX IF NOT EXISTS idx_user_entity_last_activity_deleted ON public.user_entity USING btree (lastactivitytime, deleted);

CREATE INDEX IF NOT EXISTS idx_user_entity_last_activity_time ON public.user_entity USING btree (lastactivitytime);

CREATE INDEX IF NOT EXISTS idx_user_entity_last_login_deleted ON public.user_entity USING btree (lastlogintime, deleted);

CREATE INDEX IF NOT EXISTS idx_user_entity_last_login_time ON public.user_entity USING btree (lastlogintime);

CREATE INDEX IF NOT EXISTS idx_user_entity_updated_at_id ON public.user_entity USING btree (updatedat DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_worksheet_deleted ON public.worksheet_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS idx_worksheet_entity_fqnhash_pattern ON public.worksheet_entity USING btree (fqnhash text_pattern_ops);

CREATE INDEX IF NOT EXISTS idx_worksheet_fqn ON public.worksheet_entity USING btree (fullyqualifiedname);

CREATE INDEX IF NOT EXISTS idx_worksheet_name ON public.worksheet_entity USING btree (name);

CREATE INDEX IF NOT EXISTS idx_worksheet_spreadsheet ON public.worksheet_entity USING btree ((((json -> 'spreadsheet'::text) ->> 'id'::text)));

CREATE INDEX IF NOT EXISTS idx_worksheet_spreadsheet_fqn ON public.worksheet_entity USING btree (spreadsheetfqn);

CREATE INDEX IF NOT EXISTS index_apps_marketplace_deleted ON public.apps_marketplace USING btree (namehash, deleted);

CREATE INDEX IF NOT EXISTS index_classification_deleted ON public.classification USING btree (namehash, deleted);

CREATE INDEX IF NOT EXISTS index_data_insight_chart_deleted ON public.data_insight_chart USING btree (fqnhash, deleted);

CREATE INDEX IF NOT EXISTS index_installed_apps_deleted ON public.installed_apps USING btree (namehash, deleted);

CREATE INDEX IF NOT EXISTS index_suggestions_status ON public.suggestions USING btree (status);

CREATE INDEX IF NOT EXISTS index_suggestions_type ON public.suggestions USING btree (suggestiontype);

CREATE INDEX IF NOT EXISTS index_tag_deleted ON public.tag USING btree (fqnhash, deleted);

CREATE INDEX IF NOT EXISTS index_test_case_deleted ON public.test_case USING btree (fqnhash, deleted);

CREATE INDEX IF NOT EXISTS index_test_suite_deleted ON public.test_suite USING btree (fqnhash, deleted);

CREATE INDEX IF NOT EXISTS index_web_analytic_event_deleted ON public.web_analytic_event USING btree (fqnhash, deleted);

CREATE INDEX IF NOT EXISTS llm_model_deleted_index ON public.llm_model_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS llm_model_name_index ON public.llm_model_entity USING btree (name);

CREATE INDEX IF NOT EXISTS llm_service_deleted_index ON public.llm_service_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS llm_service_name_index ON public.llm_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS llm_service_type_index ON public.llm_service_entity USING btree (servicetype);

CREATE INDEX IF NOT EXISTS mcp_execution_server_index ON public.mcp_execution_entity USING btree (serverid);

CREATE INDEX IF NOT EXISTS mcp_execution_timestamp_index ON public.mcp_execution_entity USING btree ("timestamp");

CREATE INDEX IF NOT EXISTS mcp_server_deleted_index ON public.mcp_server_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS mcp_server_name_index ON public.mcp_server_entity USING btree (name);

CREATE INDEX IF NOT EXISTS mcp_service_deleted_index ON public.mcp_service_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS mcp_service_name_index ON public.mcp_service_entity USING btree (name);

CREATE INDEX IF NOT EXISTS mcp_service_type_index ON public.mcp_service_entity USING btree (servicetype);

CREATE INDEX IF NOT EXISTS name_index ON public.web_analytic_event USING btree (name);

CREATE INDEX IF NOT EXISTS page_name_index ON public.doc_store USING btree (name);

CREATE INDEX IF NOT EXISTS persona_name_index ON public.persona_entity USING btree (name);

CREATE INDEX IF NOT EXISTS profiler_data_time_series_combined_id_ts ON public.profiler_data_time_series USING btree (extension, "timestamp");

CREATE INDEX IF NOT EXISTS prompt_template_deleted_index ON public.prompt_template_entity USING btree (deleted);

CREATE INDEX IF NOT EXISTS prompt_template_name_index ON public.prompt_template_entity USING btree (name);

CREATE INDEX IF NOT EXISTS query_cost_time_series_id ON public.query_cost_time_series USING btree (id);

CREATE INDEX IF NOT EXISTS query_cost_time_series_id_timestamp ON public.test_case_resolution_status_time_series USING btree (id, "timestamp");

CREATE INDEX IF NOT EXISTS report_data_time_series_point_ts ON public.report_data_time_series USING btree ("timestamp");

CREATE INDEX IF NOT EXISTS spreadsheet_entity_name_index ON public.spreadsheet_entity USING btree (name);

CREATE INDEX IF NOT EXISTS test_case_dimension_results_dimension_name ON public.test_case_dimension_results_time_series USING btree (entityfqnhash, dimensionname, "timestamp");

CREATE INDEX IF NOT EXISTS test_case_dimension_results_main ON public.test_case_dimension_results_time_series USING btree (entityfqnhash, "timestamp", dimensionkey);

CREATE INDEX IF NOT EXISTS test_case_dimension_results_result_id ON public.test_case_dimension_results_time_series USING btree (testcaseresultid);

CREATE INDEX IF NOT EXISTS test_case_dimension_results_ts ON public.test_case_dimension_results_time_series USING btree ("timestamp");

CREATE INDEX IF NOT EXISTS test_case_resolution_status_time_series_id ON public.test_case_resolution_status_time_series USING btree (id);

CREATE INDEX IF NOT EXISTS test_case_resolution_status_time_series_id_status_type ON public.test_case_resolution_status_time_series USING btree (id, testcaseresolutionstatustype);

CREATE INDEX IF NOT EXISTS test_case_resolution_status_time_series_status_type ON public.test_case_resolution_status_time_series USING btree (testcaseresolutionstatustype);

CREATE INDEX IF NOT EXISTS thread_entity_created_by_index ON public.thread_entity USING btree (createdby);

CREATE INDEX IF NOT EXISTS thread_entity_task_assignees_index ON public.thread_entity USING btree (taskassignees);

CREATE INDEX IF NOT EXISTS thread_entity_task_status_index ON public.thread_entity USING btree (taskstatus);

CREATE INDEX IF NOT EXISTS thread_entity_type_index ON public.thread_entity USING btree (type);

CREATE INDEX IF NOT EXISTS thread_entity_updated_at_index ON public.thread_entity USING btree (updatedat);

CREATE INDEX IF NOT EXISTS thread_type_resolved_updatedat_index ON public.thread_entity USING btree (type, resolved, updatedat);

CREATE INDEX IF NOT EXISTS to_entity_type_index ON public.entity_relationship USING btree (toid, toentity);

CREATE INDEX IF NOT EXISTS workflow_instance_state_time_series_timestamp ON public.workflow_instance_state_time_series USING btree ("timestamp");

CREATE INDEX IF NOT EXISTS workflow_instance_state_time_series_workflowdefinitionid_idx ON public.workflow_instance_state_time_series USING btree (workflowdefinitionid);

CREATE INDEX IF NOT EXISTS workflow_instance_state_time_series_workflowinstanceid_idx ON public.workflow_instance_state_time_series USING btree (workflowinstanceid);

CREATE INDEX IF NOT EXISTS workflow_instance_time_series_timestamp ON public.workflow_instance_time_series USING btree ("timestamp");

CREATE INDEX IF NOT EXISTS worksheet_entity_name_index ON public.worksheet_entity USING btree (name);

ALTER TABLE ONLY public.search_index_partition
    ADD CONSTRAINT fk_partition_job FOREIGN KEY (jobid) REFERENCES public.search_index_job(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rdf_index_partition
    ADD CONSTRAINT fk_rdf_partition_job FOREIGN KEY (jobid) REFERENCES public.rdf_index_job(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.oauth_access_tokens
    ADD CONSTRAINT oauth_access_tokens_fk_client FOREIGN KEY (client_id) REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.oauth_authorization_codes
    ADD CONSTRAINT oauth_authorization_codes_fk_client FOREIGN KEY (client_id) REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.oauth_refresh_tokens
    ADD CONSTRAINT oauth_refresh_tokens_fk_client FOREIGN KEY (client_id) REFERENCES public.oauth_clients(client_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.qrtz_blob_triggers
    ADD CONSTRAINT qrtz_blob_triggers_sched_name_trigger_name_trigger_group_fkey FOREIGN KEY (sched_name, trigger_name, trigger_group) REFERENCES public.qrtz_triggers(sched_name, trigger_name, trigger_group);

ALTER TABLE ONLY public.qrtz_cron_triggers
    ADD CONSTRAINT qrtz_cron_triggers_sched_name_trigger_name_trigger_group_fkey FOREIGN KEY (sched_name, trigger_name, trigger_group) REFERENCES public.qrtz_triggers(sched_name, trigger_name, trigger_group);

ALTER TABLE ONLY public.qrtz_simple_triggers
    ADD CONSTRAINT qrtz_simple_triggers_sched_name_trigger_name_trigger_group_fkey FOREIGN KEY (sched_name, trigger_name, trigger_group) REFERENCES public.qrtz_triggers(sched_name, trigger_name, trigger_group);

ALTER TABLE ONLY public.qrtz_simprop_triggers
    ADD CONSTRAINT qrtz_simprop_triggers_sched_name_trigger_name_trigger_grou_fkey FOREIGN KEY (sched_name, trigger_name, trigger_group) REFERENCES public.qrtz_triggers(sched_name, trigger_name, trigger_group);

ALTER TABLE ONLY public.qrtz_triggers
    ADD CONSTRAINT qrtz_triggers_sched_name_job_name_job_group_fkey FOREIGN KEY (sched_name, job_name, job_group) REFERENCES public.qrtz_job_details(sched_name, job_name, job_group);


INSERT INTO task_sequence (dummy) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM task_sequence);
