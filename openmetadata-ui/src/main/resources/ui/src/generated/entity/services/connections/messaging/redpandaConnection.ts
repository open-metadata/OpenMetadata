/**
 * Redpanda Connection Config
 */
export interface RedpandaConnection {
    /**
     * Admin API SSL Config. Configuration for enabling SSL for the Redpanda Admin API
     * connection.
     */
    adminApiSSL?: Config;
    /**
     * basic.auth.user.info schema registry config property, Client HTTP credentials in the form
     * of username:password.
     */
    basicAuthUserInfo?: string;
    /**
     * Redpanda bootstrap servers. add them in comma separated values ex: host1:9092,host2:9092
     */
    bootstrapServers: string;
    /**
     * Confluent Redpanda Consumer Config
     */
    consumerConfig?: { [key: string]: any };
    /**
     * Consumer Config SSL Config. Configuration for enabling SSL for the Consumer Config
     * connection.
     */
    consumerConfigSSL?: Config;
    /**
     * URL of the Redpanda Admin API (typically port 9644). Required for extracting data
     * transform lineage. E.g., http://localhost:9644
     */
    redpandaAdminApiUrl?: string;
    /**
     * sasl.mechanism Consumer Config property
     */
    saslMechanism?: SaslMechanismType;
    /**
     * sasl.password consumer config property
     */
    saslPassword?: string;
    /**
     * sasl.username consumer config property
     */
    saslUsername?: string;
    /**
     * Confluent Redpanda Schema Registry Config.
     */
    schemaRegistryConfig?: { [key: string]: any };
    /**
     * Schema Registry SSL Config. Configuration for enabling SSL for the Schema Registry
     * connection.
     */
    schemaRegistrySSL?: Config;
    /**
     * Schema Registry Topic Suffix Name. The suffix to be appended to the topic name to get
     * topic schema from registry.
     */
    schemaRegistryTopicSuffixName?: string;
    /**
     * Confluent Redpanda Schema Registry URL.
     */
    schemaRegistryURL?: string;
    /**
     * security.protocol consumer config property
     */
    securityProtocol?:           SecurityProtocol;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only fetch topics that matches the pattern.
     */
    topicFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: RedpandaType;
}

/**
 * Admin API SSL Config. Configuration for enabling SSL for the Redpanda Admin API
 * connection.
 *
 * Client SSL configuration
 *
 * Consumer Config SSL Config. Configuration for enabling SSL for the Consumer Config
 * connection.
 *
 * Schema Registry SSL Config. Configuration for enabling SSL for the Schema Registry
 * connection.
 *
 * OpenMetadata Client configured to validate SSL certificates.
 */
export interface Config {
    /**
     * The CA certificate used for SSL validation.
     */
    caCertificate?: string;
    /**
     * The SSL certificate used for client authentication.
     */
    sslCertificate?: string;
    /**
     * The private key associated with the SSL certificate.
     */
    sslKey?: string;
}

/**
 * sasl.mechanism Consumer Config property
 *
 * SASL Mechanism consumer config property
 */
export enum SaslMechanismType {
    Gssapi = "GSSAPI",
    Oauthbearer = "OAUTHBEARER",
    Plain = "PLAIN",
    ScramSHA256 = "SCRAM-SHA-256",
    ScramSHA512 = "SCRAM-SHA-512",
}

/**
 * security.protocol consumer config property
 */
export enum SecurityProtocol {
    Plaintext = "PLAINTEXT",
    SSL = "SSL",
    SaslPlaintext = "SASL_PLAINTEXT",
    SaslSSL = "SASL_SSL",
}

/**
 * Regex to only fetch topics that matches the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 */
export interface FilterPattern {
    /**
     * List of strings/regex patterns to match and exclude only database entities that match.
     */
    excludes?: string[];
    /**
     * List of strings/regex patterns to match and include only database entities that match.
     */
    includes?: string[];
}

/**
 * Service Type
 *
 * Redpanda service type
 */
export enum RedpandaType {
    Redpanda = "Redpanda",
}
