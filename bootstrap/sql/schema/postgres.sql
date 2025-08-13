CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: to_tz_timestamp(text); Type: FUNCTION; Schema: public; Owner: openmetadata_user
--

CREATE FUNCTION public.to_tz_timestamp(text) RETURNS timestamp with time zone
    LANGUAGE sql IMMUTABLE
    AS $_$
select to_timestamp($1, '%Y-%m-%dT%T.%fZ')::timestamptz;
$_$;


ALTER FUNCTION public.to_tz_timestamp(text) OWNER TO openmetadata_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: DATABASE_CHANGE_LOG; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public."DATABASE_CHANGE_LOG" (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);


ALTER TABLE public."DATABASE_CHANGE_LOG" OWNER TO openmetadata_user;

--
-- Name: automations_workflow; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.automations_workflow (
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


ALTER TABLE public.automations_workflow OWNER TO openmetadata_user;

--
-- Name: bot_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.bot_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.bot_entity OWNER TO openmetadata_user;

--
-- Name: change_event; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.change_event (
    eventtype character varying(36) GENERATED ALWAYS AS ((json ->> 'eventType'::text)) STORED NOT NULL,
    entitytype character varying(36) GENERATED ALWAYS AS ((json ->> 'entityType'::text)) STORED NOT NULL,
    username character varying(256) GENERATED ALWAYS AS ((json ->> 'userName'::text)) STORED NOT NULL,
    eventtime bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    json jsonb NOT NULL
);


ALTER TABLE public.change_event OWNER TO openmetadata_user;

--
-- Name: chart_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.chart_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.chart_entity OWNER TO openmetadata_user;

--
-- Name: classification; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.classification (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.classification OWNER TO openmetadata_user;

--
-- Name: dashboard_data_model_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.dashboard_data_model_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.dashboard_data_model_entity OWNER TO openmetadata_user;

--
-- Name: dashboard_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.dashboard_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.dashboard_entity OWNER TO openmetadata_user;

--
-- Name: dashboard_service_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.dashboard_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.dashboard_service_entity OWNER TO openmetadata_user;

--
-- Name: data_insight_chart; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.data_insight_chart (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    dataindextype character varying(256) GENERATED ALWAYS AS ((json ->> 'dataIndexType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL
);


ALTER TABLE public.data_insight_chart OWNER TO openmetadata_user;

--
-- Name: data_product_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.data_product_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL
);


ALTER TABLE public.data_product_entity OWNER TO openmetadata_user;

--
-- Name: database_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.database_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.database_entity OWNER TO openmetadata_user;

--
-- Name: database_schema_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.database_schema_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.database_schema_entity OWNER TO openmetadata_user;

--
-- Name: dbservice_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.dbservice_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.dbservice_entity OWNER TO openmetadata_user;

--
-- Name: domain_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.domain_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL
);


ALTER TABLE public.domain_entity OWNER TO openmetadata_user;

--
-- Name: entity_extension; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.entity_extension (
    id character varying(36) NOT NULL,
    extension character varying(256) NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL
);


ALTER TABLE public.entity_extension OWNER TO openmetadata_user;

--
-- Name: entity_extension_time_series; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.entity_extension_time_series (
    extension character varying(256) NOT NULL,
    jsonschema character varying(256) NOT NULL,
    json jsonb NOT NULL,
    "timestamp" bigint GENERATED ALWAYS AS (((json ->> 'timestamp'::text))::bigint) STORED NOT NULL,
    entityfqnhash character varying(768) NOT NULL
);


ALTER TABLE public.entity_extension_time_series OWNER TO openmetadata_user;

--
-- Name: entity_relationship; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.entity_relationship (
    fromid character varying(36) NOT NULL,
    toid character varying(36) NOT NULL,
    fromentity character varying(256) NOT NULL,
    toentity character varying(256) NOT NULL,
    relation smallint NOT NULL,
    jsonschema character varying(256),
    json jsonb,
    deleted boolean DEFAULT false NOT NULL
);


ALTER TABLE public.entity_relationship OWNER TO openmetadata_user;

--
-- Name: entity_usage; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.entity_usage (
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


ALTER TABLE public.entity_usage OWNER TO openmetadata_user;

--
-- Name: event_subscription_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.event_subscription_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.event_subscription_entity OWNER TO openmetadata_user;

--
-- Name: field_relationship; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.field_relationship (
    fromfqn character varying(2096) NOT NULL,
    tofqn character varying(2096) NOT NULL,
    fromtype character varying(256) NOT NULL,
    totype character varying(256) NOT NULL,
    relation smallint NOT NULL,
    jsonschema character varying(256),
    json jsonb,
    fromfqnhash character varying(382) NOT NULL,
    tofqnhash character varying(382) NOT NULL
);


ALTER TABLE public.field_relationship OWNER TO openmetadata_user;

--
-- Name: glossary_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.glossary_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.glossary_entity OWNER TO openmetadata_user;

--
-- Name: glossary_term_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.glossary_term_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.glossary_term_entity OWNER TO openmetadata_user;

--
-- Name: ingestion_pipeline_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.ingestion_pipeline_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json json NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    "timestamp" bigint,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.ingestion_pipeline_entity OWNER TO openmetadata_user;

--
-- Name: kpi_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.kpi_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.kpi_entity OWNER TO openmetadata_user;

--
-- Name: messaging_service_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.messaging_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.messaging_service_entity OWNER TO openmetadata_user;

--
-- Name: metadata_service_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.metadata_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.metadata_service_entity OWNER TO openmetadata_user;

--
-- Name: metric_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.metric_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.metric_entity OWNER TO openmetadata_user;

--
-- Name: ml_model_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.ml_model_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.ml_model_entity OWNER TO openmetadata_user;

--
-- Name: mlmodel_service_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.mlmodel_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.mlmodel_service_entity OWNER TO openmetadata_user;

--
-- Name: openmetadata_settings; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.openmetadata_settings (
    id integer NOT NULL,
    configtype character varying(36) NOT NULL,
    json jsonb NOT NULL
);


ALTER TABLE public.openmetadata_settings OWNER TO openmetadata_user;

--
-- Name: openmetadata_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: openmetadata_user
--

CREATE SEQUENCE public.openmetadata_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.openmetadata_settings_id_seq OWNER TO openmetadata_user;

--
-- Name: openmetadata_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: openmetadata_user
--

ALTER SEQUENCE public.openmetadata_settings_id_seq OWNED BY public.openmetadata_settings.id;


--
-- Name: pipeline_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.pipeline_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.pipeline_entity OWNER TO openmetadata_user;

--
-- Name: pipeline_service_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.pipeline_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.pipeline_service_entity OWNER TO openmetadata_user;

--
-- Name: policy_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.policy_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.policy_entity OWNER TO openmetadata_user;

--
-- Name: query_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.query_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.query_entity OWNER TO openmetadata_user;

--
-- Name: report_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.report_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.report_entity OWNER TO openmetadata_user;

--
-- Name: role_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.role_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.role_entity OWNER TO openmetadata_user;

--
-- Name: search_index_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.search_index_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(256) NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);


ALTER TABLE public.search_index_entity OWNER TO openmetadata_user;

--
-- Name: search_service_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.search_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED
);


ALTER TABLE public.search_service_entity OWNER TO openmetadata_user;

--
-- Name: server_change_log; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.server_change_log (
    installed_rank integer NOT NULL,
    version character varying(256) NOT NULL,
    migrationfilename character varying(256) NOT NULL,
    checksum character varying(256) NOT NULL,
    installed_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.server_change_log OWNER TO openmetadata_user;

--
-- Name: server_change_log_installed_rank_seq; Type: SEQUENCE; Schema: public; Owner: openmetadata_user
--

CREATE SEQUENCE public.server_change_log_installed_rank_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.server_change_log_installed_rank_seq OWNER TO openmetadata_user;

--
-- Name: server_change_log_installed_rank_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: openmetadata_user
--

ALTER SEQUENCE public.server_change_log_installed_rank_seq OWNED BY public.server_change_log.installed_rank;


--
-- Name: server_migration_sql_logs; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.server_migration_sql_logs (
    version character varying(256) NOT NULL,
    sqlstatement character varying(10000) NOT NULL,
    checksum character varying(256) NOT NULL,
    executedat timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.server_migration_sql_logs OWNER TO openmetadata_user;

--
-- Name: storage_container_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.storage_container_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.storage_container_entity OWNER TO openmetadata_user;

--
-- Name: storage_service_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.storage_service_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    servicetype character varying(256) GENERATED ALWAYS AS ((json ->> 'serviceType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.storage_service_entity OWNER TO openmetadata_user;

--
-- Name: table_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.table_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.table_entity OWNER TO openmetadata_user;

--
-- Name: tag; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.tag (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.tag OWNER TO openmetadata_user;

--
-- Name: tag_usage; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.tag_usage (
    source smallint NOT NULL,
    tagfqn character varying(256) NOT NULL,
    labeltype smallint NOT NULL,
    state smallint NOT NULL,
    tagfqnhash character varying(382),
    targetfqnhash character varying(382)
);


ALTER TABLE public.tag_usage OWNER TO openmetadata_user;

--
-- Name: task_sequence; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.task_sequence (
    id integer NOT NULL,
    dummy character varying(1)
);


ALTER TABLE public.task_sequence OWNER TO openmetadata_user;

--
-- Name: task_sequence_id_seq; Type: SEQUENCE; Schema: public; Owner: openmetadata_user
--

CREATE SEQUENCE public.task_sequence_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.task_sequence_id_seq OWNER TO openmetadata_user;

--
-- Name: task_sequence_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: openmetadata_user
--

ALTER SEQUENCE public.task_sequence_id_seq OWNED BY public.task_sequence.id;


--
-- Name: team_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.team_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    teamtype character varying(64) GENERATED ALWAYS AS ((json ->> 'teamType'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.team_entity OWNER TO openmetadata_user;

--
-- Name: test_case; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.test_case (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    entityfqn character varying(712) GENERATED ALWAYS AS ((json ->> 'entityFQN'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    fqnhash character varying(768) NOT NULL
);


ALTER TABLE public.test_case OWNER TO openmetadata_user;

--
-- Name: test_connection_definition; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.test_connection_definition (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fullyqualifiedname character varying(256) GENERATED ALWAYS AS ((json ->> 'fullyQualifiedName'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.test_connection_definition OWNER TO openmetadata_user;

--
-- Name: test_definition; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.test_definition (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    entitytype character varying(36) GENERATED ALWAYS AS ((json ->> 'entityType'::text)) STORED NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    supported_data_types jsonb GENERATED ALWAYS AS ((json -> 'supportedDataTypes'::text)) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.test_definition OWNER TO openmetadata_user;

--
-- Name: test_suite; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.test_suite (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(256) NOT NULL
);


ALTER TABLE public.test_suite OWNER TO openmetadata_user;

--
-- Name: thread_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.thread_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    entityid character varying(36) GENERATED ALWAYS AS ((json ->> 'entityId'::text)) STORED NOT NULL,
    entitylink character varying(256) GENERATED ALWAYS AS ((json ->> 'about'::text)) STORED NOT NULL,
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
    announcementend bigint GENERATED ALWAYS AS (((json #> '{announcement,endTime}'::text[]))::bigint) STORED
);


ALTER TABLE public.thread_entity OWNER TO openmetadata_user;

--
-- Name: topic_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.topic_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(256) NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL
);


ALTER TABLE public.topic_entity OWNER TO openmetadata_user;

--
-- Name: type_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.type_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    category character varying(256) GENERATED ALWAYS AS ((json ->> 'category'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.type_entity OWNER TO openmetadata_user;

--
-- Name: user_entity; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.user_entity (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    email character varying(256) GENERATED ALWAYS AS ((json ->> 'email'::text)) STORED NOT NULL,
    deactivated character varying(8) GENERATED ALWAYS AS ((json ->> 'deactivated'::text)) STORED,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    namehash character varying(256) NOT NULL
);


ALTER TABLE public.user_entity OWNER TO openmetadata_user;

--
-- Name: user_tokens; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.user_tokens (
    token character varying(36) GENERATED ALWAYS AS ((json ->> 'token'::text)) STORED NOT NULL,
    userid character varying(36) GENERATED ALWAYS AS ((json ->> 'userId'::text)) STORED NOT NULL,
    tokentype character varying(50) GENERATED ALWAYS AS ((json ->> 'tokenType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    expirydate bigint GENERATED ALWAYS AS (((json ->> 'expiryDate'::text))::bigint) STORED
);


ALTER TABLE public.user_tokens OWNER TO openmetadata_user;

--
-- Name: web_analytic_event; Type: TABLE; Schema: public; Owner: openmetadata_user
--

CREATE TABLE public.web_analytic_event (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    name character varying(256) GENERATED ALWAYS AS ((json ->> 'name'::text)) STORED NOT NULL,
    eventtype character varying(256) GENERATED ALWAYS AS ((json ->> 'eventType'::text)) STORED NOT NULL,
    json jsonb NOT NULL,
    updatedat bigint GENERATED ALWAYS AS (((json ->> 'updatedAt'::text))::bigint) STORED NOT NULL,
    updatedby character varying(256) GENERATED ALWAYS AS ((json ->> 'updatedBy'::text)) STORED NOT NULL,
    deleted boolean GENERATED ALWAYS AS (((json ->> 'deleted'::text))::boolean) STORED,
    fqnhash character varying(768) NOT NULL
);


ALTER TABLE public.web_analytic_event OWNER TO openmetadata_user;

--
-- Name: openmetadata_settings id; Type: DEFAULT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.openmetadata_settings ALTER COLUMN id SET DEFAULT nextval('public.openmetadata_settings_id_seq'::regclass);


--
-- Name: server_change_log installed_rank; Type: DEFAULT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.server_change_log ALTER COLUMN installed_rank SET DEFAULT nextval('public.server_change_log_installed_rank_seq'::regclass);


--
-- Name: task_sequence id; Type: DEFAULT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.task_sequence ALTER COLUMN id SET DEFAULT nextval('public.task_sequence_id_seq'::regclass);


--
-- Name: DATABASE_CHANGE_LOG DATABASE_CHANGE_LOG_pk; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public."DATABASE_CHANGE_LOG"
    ADD CONSTRAINT "DATABASE_CHANGE_LOG_pk" PRIMARY KEY (installed_rank);


--
-- Name: automations_workflow automations_workflow_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.automations_workflow
    ADD CONSTRAINT automations_workflow_namehash_key UNIQUE (namehash);


--
-- Name: automations_workflow automations_workflow_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.automations_workflow
    ADD CONSTRAINT automations_workflow_pkey PRIMARY KEY (id);


--
-- Name: bot_entity bot_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.bot_entity
    ADD CONSTRAINT bot_entity_namehash_key UNIQUE (namehash);


--
-- Name: bot_entity bot_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.bot_entity
    ADD CONSTRAINT bot_entity_pkey PRIMARY KEY (id);


--
-- Name: chart_entity chart_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.chart_entity
    ADD CONSTRAINT chart_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: chart_entity chart_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.chart_entity
    ADD CONSTRAINT chart_entity_pkey PRIMARY KEY (id);


--
-- Name: classification classification_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.classification
    ADD CONSTRAINT classification_namehash_key UNIQUE (namehash);


--
-- Name: dashboard_data_model_entity dashboard_data_model_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.dashboard_data_model_entity
    ADD CONSTRAINT dashboard_data_model_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: dashboard_data_model_entity dashboard_data_model_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.dashboard_data_model_entity
    ADD CONSTRAINT dashboard_data_model_entity_pkey PRIMARY KEY (id);


--
-- Name: dashboard_entity dashboard_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.dashboard_entity
    ADD CONSTRAINT dashboard_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: dashboard_entity dashboard_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.dashboard_entity
    ADD CONSTRAINT dashboard_entity_pkey PRIMARY KEY (id);


--
-- Name: dashboard_service_entity dashboard_service_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.dashboard_service_entity
    ADD CONSTRAINT dashboard_service_entity_namehash_key UNIQUE (namehash);


--
-- Name: dashboard_service_entity dashboard_service_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.dashboard_service_entity
    ADD CONSTRAINT dashboard_service_entity_pkey PRIMARY KEY (id);


--
-- Name: data_insight_chart data_insight_chart_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.data_insight_chart
    ADD CONSTRAINT data_insight_chart_fqnhash_key UNIQUE (fqnhash);


--
-- Name: data_insight_chart data_insight_chart_name_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.data_insight_chart
    ADD CONSTRAINT data_insight_chart_name_key UNIQUE (name);


--
-- Name: data_product_entity data_product_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.data_product_entity
    ADD CONSTRAINT data_product_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: data_product_entity data_product_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.data_product_entity
    ADD CONSTRAINT data_product_entity_pkey PRIMARY KEY (id);


--
-- Name: database_entity database_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.database_entity
    ADD CONSTRAINT database_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: database_entity database_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.database_entity
    ADD CONSTRAINT database_entity_pkey PRIMARY KEY (id);


--
-- Name: database_schema_entity database_schema_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.database_schema_entity
    ADD CONSTRAINT database_schema_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: database_schema_entity database_schema_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.database_schema_entity
    ADD CONSTRAINT database_schema_entity_pkey PRIMARY KEY (id);


--
-- Name: dbservice_entity dbservice_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.dbservice_entity
    ADD CONSTRAINT dbservice_entity_namehash_key UNIQUE (namehash);


--
-- Name: dbservice_entity dbservice_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.dbservice_entity
    ADD CONSTRAINT dbservice_entity_pkey PRIMARY KEY (id);


--
-- Name: domain_entity domain_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.domain_entity
    ADD CONSTRAINT domain_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: domain_entity domain_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.domain_entity
    ADD CONSTRAINT domain_entity_pkey PRIMARY KEY (id);


--
-- Name: entity_extension entity_extension_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.entity_extension
    ADD CONSTRAINT entity_extension_pkey PRIMARY KEY (id, extension);


--
-- Name: entity_relationship entity_relationship_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.entity_relationship
    ADD CONSTRAINT entity_relationship_pkey PRIMARY KEY (fromid, toid, relation);


--
-- Name: entity_usage entity_usage_usagedate_id_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.entity_usage
    ADD CONSTRAINT entity_usage_usagedate_id_key UNIQUE (usagedate, id);


--
-- Name: event_subscription_entity event_subscription_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.event_subscription_entity
    ADD CONSTRAINT event_subscription_entity_namehash_key UNIQUE (namehash);


--
-- Name: event_subscription_entity event_subscription_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.event_subscription_entity
    ADD CONSTRAINT event_subscription_entity_pkey PRIMARY KEY (id);


--
-- Name: field_relationship field_relationship_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.field_relationship
    ADD CONSTRAINT field_relationship_pkey PRIMARY KEY (fromfqnhash, tofqnhash, relation);


--
-- Name: glossary_entity glossary_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.glossary_entity
    ADD CONSTRAINT glossary_entity_namehash_key UNIQUE (namehash);


--
-- Name: glossary_entity glossary_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.glossary_entity
    ADD CONSTRAINT glossary_entity_pkey PRIMARY KEY (id);


--
-- Name: glossary_term_entity glossary_term_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.glossary_term_entity
    ADD CONSTRAINT glossary_term_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: glossary_term_entity glossary_term_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.glossary_term_entity
    ADD CONSTRAINT glossary_term_entity_pkey PRIMARY KEY (id);


--
-- Name: ingestion_pipeline_entity ingestion_pipeline_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.ingestion_pipeline_entity
    ADD CONSTRAINT ingestion_pipeline_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: ingestion_pipeline_entity ingestion_pipeline_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.ingestion_pipeline_entity
    ADD CONSTRAINT ingestion_pipeline_entity_pkey PRIMARY KEY (id);


--
-- Name: kpi_entity kpi_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.kpi_entity
    ADD CONSTRAINT kpi_entity_namehash_key UNIQUE (namehash);


--
-- Name: kpi_entity kpi_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.kpi_entity
    ADD CONSTRAINT kpi_entity_pkey PRIMARY KEY (id);


--
-- Name: messaging_service_entity messaging_service_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.messaging_service_entity
    ADD CONSTRAINT messaging_service_entity_namehash_key UNIQUE (namehash);


--
-- Name: messaging_service_entity messaging_service_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.messaging_service_entity
    ADD CONSTRAINT messaging_service_entity_pkey PRIMARY KEY (id);


--
-- Name: metadata_service_entity metadata_service_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.metadata_service_entity
    ADD CONSTRAINT metadata_service_entity_namehash_key UNIQUE (namehash);


--
-- Name: metadata_service_entity metadata_service_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.metadata_service_entity
    ADD CONSTRAINT metadata_service_entity_pkey PRIMARY KEY (id);


--
-- Name: metric_entity metric_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.metric_entity
    ADD CONSTRAINT metric_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: metric_entity metric_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.metric_entity
    ADD CONSTRAINT metric_entity_pkey PRIMARY KEY (id);


--
-- Name: ml_model_entity ml_model_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.ml_model_entity
    ADD CONSTRAINT ml_model_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: ml_model_entity ml_model_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.ml_model_entity
    ADD CONSTRAINT ml_model_entity_pkey PRIMARY KEY (id);


--
-- Name: mlmodel_service_entity mlmodel_service_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.mlmodel_service_entity
    ADD CONSTRAINT mlmodel_service_entity_namehash_key UNIQUE (namehash);


--
-- Name: mlmodel_service_entity mlmodel_service_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.mlmodel_service_entity
    ADD CONSTRAINT mlmodel_service_entity_pkey PRIMARY KEY (id);


--
-- Name: openmetadata_settings openmetadata_settings_configtype_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.openmetadata_settings
    ADD CONSTRAINT openmetadata_settings_configtype_key UNIQUE (configtype);


--
-- Name: openmetadata_settings openmetadata_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.openmetadata_settings
    ADD CONSTRAINT openmetadata_settings_pkey PRIMARY KEY (id, configtype);


--
-- Name: pipeline_entity pipeline_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.pipeline_entity
    ADD CONSTRAINT pipeline_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: pipeline_entity pipeline_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.pipeline_entity
    ADD CONSTRAINT pipeline_entity_pkey PRIMARY KEY (id);


--
-- Name: pipeline_service_entity pipeline_service_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.pipeline_service_entity
    ADD CONSTRAINT pipeline_service_entity_namehash_key UNIQUE (namehash);


--
-- Name: pipeline_service_entity pipeline_service_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.pipeline_service_entity
    ADD CONSTRAINT pipeline_service_entity_pkey PRIMARY KEY (id);


--
-- Name: policy_entity policy_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.policy_entity
    ADD CONSTRAINT policy_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: policy_entity policy_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.policy_entity
    ADD CONSTRAINT policy_entity_pkey PRIMARY KEY (id);


--
-- Name: query_entity query_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.query_entity
    ADD CONSTRAINT query_entity_namehash_key UNIQUE (namehash);


--
-- Name: query_entity query_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.query_entity
    ADD CONSTRAINT query_entity_pkey PRIMARY KEY (id);


--
-- Name: report_entity report_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.report_entity
    ADD CONSTRAINT report_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: report_entity report_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.report_entity
    ADD CONSTRAINT report_entity_pkey PRIMARY KEY (id);


--
-- Name: role_entity role_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.role_entity
    ADD CONSTRAINT role_entity_namehash_key UNIQUE (namehash);


--
-- Name: role_entity role_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.role_entity
    ADD CONSTRAINT role_entity_pkey PRIMARY KEY (id);


--
-- Name: search_index_entity search_index_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.search_index_entity
    ADD CONSTRAINT search_index_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: search_index_entity search_index_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.search_index_entity
    ADD CONSTRAINT search_index_entity_pkey PRIMARY KEY (id);


--
-- Name: search_service_entity search_service_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.search_service_entity
    ADD CONSTRAINT search_service_entity_namehash_key UNIQUE (namehash);


--
-- Name: search_service_entity search_service_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.search_service_entity
    ADD CONSTRAINT search_service_entity_pkey PRIMARY KEY (id);


--
-- Name: server_change_log server_change_log_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.server_change_log
    ADD CONSTRAINT server_change_log_pkey PRIMARY KEY (version);


--
-- Name: server_migration_sql_logs server_migration_sql_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.server_migration_sql_logs
    ADD CONSTRAINT server_migration_sql_logs_pkey PRIMARY KEY (checksum);


--
-- Name: storage_container_entity storage_container_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.storage_container_entity
    ADD CONSTRAINT storage_container_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: storage_container_entity storage_container_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.storage_container_entity
    ADD CONSTRAINT storage_container_entity_pkey PRIMARY KEY (id);


--
-- Name: storage_service_entity storage_service_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.storage_service_entity
    ADD CONSTRAINT storage_service_entity_namehash_key UNIQUE (namehash);


--
-- Name: storage_service_entity storage_service_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.storage_service_entity
    ADD CONSTRAINT storage_service_entity_pkey PRIMARY KEY (id);


--
-- Name: table_entity table_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.table_entity
    ADD CONSTRAINT table_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: table_entity table_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.table_entity
    ADD CONSTRAINT table_entity_pkey PRIMARY KEY (id);


--
-- Name: tag tag_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.tag
    ADD CONSTRAINT tag_fqnhash_key UNIQUE (fqnhash);


--
-- Name: tag_usage tag_usage_source_tagfqnhash_targetfqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.tag_usage
    ADD CONSTRAINT tag_usage_source_tagfqnhash_targetfqnhash_key UNIQUE (source, tagfqnhash, targetfqnhash);


--
-- Name: thread_entity task_id_constraint; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.thread_entity
    ADD CONSTRAINT task_id_constraint UNIQUE (taskid);


--
-- Name: task_sequence task_sequence_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.task_sequence
    ADD CONSTRAINT task_sequence_pkey PRIMARY KEY (id);


--
-- Name: team_entity team_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.team_entity
    ADD CONSTRAINT team_entity_namehash_key UNIQUE (namehash);


--
-- Name: team_entity team_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.team_entity
    ADD CONSTRAINT team_entity_pkey PRIMARY KEY (id);


--
-- Name: test_case test_case_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.test_case
    ADD CONSTRAINT test_case_fqnhash_key UNIQUE (fqnhash);


--
-- Name: test_connection_definition test_connection_definition_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.test_connection_definition
    ADD CONSTRAINT test_connection_definition_namehash_key UNIQUE (namehash);


--
-- Name: test_definition test_definition_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.test_definition
    ADD CONSTRAINT test_definition_namehash_key UNIQUE (namehash);


--
-- Name: test_suite test_suite_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.test_suite
    ADD CONSTRAINT test_suite_namehash_key UNIQUE (fqnhash);


--
-- Name: thread_entity thread_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.thread_entity
    ADD CONSTRAINT thread_entity_pkey PRIMARY KEY (id);


--
-- Name: topic_entity topic_entity_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.topic_entity
    ADD CONSTRAINT topic_entity_fqnhash_key UNIQUE (fqnhash);


--
-- Name: topic_entity topic_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.topic_entity
    ADD CONSTRAINT topic_entity_pkey PRIMARY KEY (id);


--
-- Name: type_entity type_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.type_entity
    ADD CONSTRAINT type_entity_namehash_key UNIQUE (namehash);


--
-- Name: type_entity type_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.type_entity
    ADD CONSTRAINT type_entity_pkey PRIMARY KEY (id);


--
-- Name: user_entity user_entity_email_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT user_entity_email_key UNIQUE (email);


--
-- Name: user_entity user_entity_namehash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT user_entity_namehash_key UNIQUE (namehash);


--
-- Name: user_entity user_entity_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.user_entity
    ADD CONSTRAINT user_entity_pkey PRIMARY KEY (id);


--
-- Name: user_tokens user_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.user_tokens
    ADD CONSTRAINT user_tokens_pkey PRIMARY KEY (token);


--
-- Name: web_analytic_event web_analytic_event_fqnhash_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.web_analytic_event
    ADD CONSTRAINT web_analytic_event_fqnhash_key UNIQUE (fqnhash);


--
-- Name: web_analytic_event web_analytic_event_name_key; Type: CONSTRAINT; Schema: public; Owner: openmetadata_user
--

ALTER TABLE ONLY public.web_analytic_event
    ADD CONSTRAINT web_analytic_event_name_key UNIQUE (name);


--
-- Name: DATABASE_CHANGE_LOG_s_idx; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX "DATABASE_CHANGE_LOG_s_idx" ON public."DATABASE_CHANGE_LOG" USING btree (success);


--
-- Name: change_event_entity_type_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX change_event_entity_type_index ON public.change_event USING btree (entitytype);


--
-- Name: change_event_event_time_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX change_event_event_time_index ON public.change_event USING btree (eventtime);


--
-- Name: change_event_event_type_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX change_event_event_type_index ON public.change_event USING btree (eventtype);


--
-- Name: entity_relationship_from_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX entity_relationship_from_index ON public.entity_relationship USING btree (fromid, relation);


--
-- Name: entity_relationship_to_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX entity_relationship_to_index ON public.entity_relationship USING btree (toid, relation);


--
-- Name: field_relationship_from_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX field_relationship_from_index ON public.field_relationship USING btree (fromfqnhash, relation);


--
-- Name: field_relationship_to_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX field_relationship_to_index ON public.field_relationship USING btree (tofqnhash, relation);


--
-- Name: name_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX name_index ON public.web_analytic_event USING btree (name);


--
-- Name: thread_entity_created_by_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX thread_entity_created_by_index ON public.thread_entity USING btree (createdby);


--
-- Name: thread_entity_task_assignees_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX thread_entity_task_assignees_index ON public.thread_entity USING btree (taskassignees);


--
-- Name: thread_entity_task_status_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX thread_entity_task_status_index ON public.thread_entity USING btree (taskstatus);


--
-- Name: thread_entity_type_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX thread_entity_type_index ON public.thread_entity USING btree (type);


--
-- Name: thread_entity_updated_at_index; Type: INDEX; Schema: public; Owner: openmetadata_user
--

CREATE INDEX thread_entity_updated_at_index ON public.thread_entity USING btree (updatedat);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT ALL ON SCHEMA public TO openmetadata_user;


--
-- PostgreSQL database dump complete
--

