/**
 * QuestDB Connection Config
 */
export interface QuestdbConnection {
    /**
     * Choose Auth Config Type.
     */
    authType:             AuthConfigurationType;
    connectionArguments?: { [key: string]: any };
    connectionOptions?:   { [key: string]: string };
    /**
     * Regex to only include/exclude databases that matches the pattern.
     */
    databaseFilterPattern?: FilterPattern;
    /**
     * Optional display name for the QuestDB database in OpenMetadata. QuestDB exposes a single
     * physical database (qdb); this value is used only for display and FQN building. Defaults
     * to qdb.
     */
    databaseName?: string;
    /**
     * Database schema of the data source (defaults to public). Optional; if set, restricts the
     * test-connection step and metadata reading to a single schema.
     */
    databaseSchema?: string;
    /**
     * Host and port of the QuestDB service (default PostgreSQL wire protocol port is 8812).
     */
    hostPort: string;
    /**
     * Regex to only include/exclude schemas that matches the pattern.
     */
    schemaFilterPattern?: FilterPattern;
    /**
     * SQLAlchemy driver scheme options.
     */
    scheme?:                     QuestDBScheme;
    supportsDBTExtraction?:      boolean;
    supportsMetadataExtraction?: boolean;
    /**
     * Regex to only include/exclude tables that matches the pattern.
     */
    tableFilterPattern?: FilterPattern;
    /**
     * Service Type
     */
    type?: QuestDBType;
    /**
     * Username to connect to QuestDB.
     */
    username: string;
}

/**
 * Choose Auth Config Type.
 *
 * Common Database Connection Config
 */
export interface AuthConfigurationType {
    /**
     * Password to connect to source.
     */
    password?: string;
}

/**
 * Regex to only include/exclude databases that matches the pattern.
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
 * SQLAlchemy driver scheme options.
 */
export enum QuestDBScheme {
    PostgresqlPsycopg2 = "postgresql+psycopg2",
}

/**
 * Service Type
 *
 * Service type.
 */
export enum QuestDBType {
    QuestDB = "QuestDB",
}
