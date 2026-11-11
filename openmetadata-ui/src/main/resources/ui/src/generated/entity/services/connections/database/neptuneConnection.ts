/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
/**
 * Amazon Neptune property graph or RDF connection configuration
 */
export interface NeptuneConnection {
    /**
     * AWS credentials used to sign (SigV4) requests to Neptune. Leave the keys blank to use the
     * standard AWS credential provider chain, e.g. an IAM role. The identity needs
     * `neptune-db:ReadDataViaQuery`; RDF also needs `neptune-db:GetGraphSummary`.
     * Property-graph schema computation additionally needs `neptune-db:WriteDataViaQuery`.
     */
    awsConfig: AWSCredentials;
    /**
     * For property graphs, when Neptune has no computed schema, start `CALL
     * neptune.graph.pg_schema.compute()` and wait for it to finish. This requires
     * `neptune-db:WriteDataViaQuery`. Ignored for RDF, which uses the read-only graph summary
     * API.
     */
    computeSchemaIfMissing?: boolean;
    /**
     * Optional name to give to the database in OpenMetadata. If left blank, `default` is used.
     */
    databaseName?: string;
    /**
     * Choose the Neptune graph model. Existing configurations default to openCypher property
     * graphs.
     */
    graphModel?: GraphModel;
    /**
     * Neptune cluster or instance endpoint, e.g.
     * `my-cluster.cluster-abc.us-east-1.neptune.amazonaws.com:8182`. The port can be omitted to
     * use 8182.
     */
    hostPort: string;
    /**
     * Also ingest edge labels as tables in the `relationships` schema, with their properties as
     * columns.
     */
    includeRelationships?: boolean;
    /**
     * Regex to only include/exclude node and edge properties (columns) that match the pattern.
     */
    propertyFilterPattern?: FilterPattern;
    /**
     * Maximum number of RDF classes to ingest as tables. Classes are selected deterministically
     * by IRI; truncation is reported in the ingestion status.
     */
    rdfMaxClasses?: number;
    /**
     * Maximum number of predicates to ingest as columns for each RDF class. Truncation is
     * reported in the ingestion status.
     */
    rdfMaxPredicatesPerClass?: number;
    /**
     * Per-query timeout for the bounded SPARQL class-discovery queries. Neptune requires this
     * to be lower than the neptune_query_timeout database parameter.
     */
    rdfQueryTimeoutSeconds?: number;
    /**
     * Maximum number of subjects sampled per RDF class when discovering predicates and value
     * types.
     */
    rdfSampleSize?: number;
    /**
     * Maximum time to wait for Neptune to finish computing the property graph schema before
     * failing.
     */
    schemaComputeTimeoutSeconds?: number;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?:        FilterPattern;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: NeptuneType;
}

/**
 * AWS credentials used to sign (SigV4) requests to Neptune. Leave the keys blank to use the
 * standard AWS credential provider chain, e.g. an IAM role. The identity needs
 * `neptune-db:ReadDataViaQuery`; RDF also needs `neptune-db:GetGraphSummary`.
 * Property-graph schema computation additionally needs `neptune-db:WriteDataViaQuery`.
 *
 * AWS credentials configs.
 */
export interface AWSCredentials {
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Required Field in case of Assume
     * Role
     */
    assumeRoleArn?: string;
    /**
     * An identifier for the assumed role session. Use the role session name to uniquely
     * identify a session when the same role is assumed by different principals or for different
     * reasons. Required Field in case of Assume Role
     */
    assumeRoleSessionName?: string;
    /**
     * The Amazon Resource Name (ARN) of the role to assume. Optional Field in case of Assume
     * Role
     */
    assumeRoleSourceIdentity?: string;
    /**
     * AWS Access key ID.
     */
    awsAccessKeyId?: string;
    /**
     * AWS Region
     */
    awsRegion: string;
    /**
     * AWS Secret Access Key.
     */
    awsSecretAccessKey?: string;
    /**
     * AWS Session Token.
     */
    awsSessionToken?: string;
    /**
     * Enable AWS IAM authentication. When enabled, uses the default credential provider chain
     * (environment variables, instance profile, etc.). Defaults to false for backward
     * compatibility.
     */
    enabled?: boolean;
    /**
     * EndPoint URL for the AWS
     */
    endPointURL?: string;
    /**
     * The name of a profile to use with the boto session.
     */
    profileName?: string;
}

/**
 * Choose the Neptune graph model. Existing configurations default to openCypher property
 * graphs.
 *
 * Neptune graph model and query language.
 */
export enum GraphModel {
    PropertyGraph = "propertyGraph",
    RDF = "rdf",
}

/**
 * Regex to only include/exclude node and edge properties (columns) that match the pattern.
 *
 * Regex to only fetch entities that matches the pattern.
 *
 * Regex to only include/exclude schemas that matches the pattern.
 *
 * Regex to only include/exclude tables that matches the pattern.
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
 * Service type.
 */
export enum NeptuneType {
    Neptune = "Neptune",
}
