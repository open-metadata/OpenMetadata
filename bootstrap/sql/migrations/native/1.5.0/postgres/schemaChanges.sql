-- Update openlineageConnection field
UPDATE pipeline_service_entity
SET json = jsonb_set(json, '{connection,config,"openlineageConnection"}', (json->'connection'->'config')::jsonb, true)
WHERE servicetype = 'OpenLineage';

-- Remove old config entries
UPDATE pipeline_service_entity
SET json = json #- '{connection,config,topicName}'
                 #- '{connection,config,brokersUrl}'
                 #- '{connection,config,poolTimeout}'
                 #- '{connection,config,SSLCALocation}'
                 #- '{connection,config,SSLKeyLocation}'
                 #- '{connection,config,sessionTimeout}'
                 #- '{connection,config,consumerOffsets}'
                 #- '{connection,config,securityProtocol}'
                 #- '{connection,config,consumerGroupName}'
                 #- '{connection,config,SSLCertificateLocation}'
                 #- '{connection,config,openlineageConnection,cleanFinalizedRuns}'
WHERE servicetype = 'OpenLineage';


CREATE TABLE IF NOT EXISTS openlineage_events (
    id character varying(36) GENERATED ALWAYS AS ((json ->> 'id'::text)) STORED NOT NULL,
    eventtype  character varying(15) GENERATED ALWAYS AS ((json ->> 'eventtype'::text)) STORED NOT NULL,
    runid character varying(36) GENERATED ALWAYS AS ((json ->> 'runid'::text)) STORED NOT NULL,
    recieved_at timestamp without time zone DEFAULT now() NOT NULL,
    processed_at timestamp without time zone ,
    json jsonb NOT NULL
);
