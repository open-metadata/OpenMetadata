/**
 * Query Runner Response
 */
export interface QueryRunnerResponse {
    /**
     * Duration of the query execution in seconds
     */
    duration?: number;
    /**
     * Detailed error log in case of failure
     */
    errorLog?: string;
    /**
     * The actual query that was executed (may be transpiled or modified from the original)
     */
    executedQuery?: string;
    /**
     * Error message in case of failure
     */
    message?: string;
    /**
     * S3 or GCS key path where the query results CSV is stored. Present when storage mode is
     * enabled; mutually exclusive with 'results'.
     */
    resultPath?: string;
    /**
     * Results of the query execution
     */
    results?: TableData;
    /**
     * Status of the query execution
     */
    status?: StatusType;
}

/**
 * Results of the query execution
 *
 * This schema defines the type to capture rows of sample data for a table.
 */
export interface TableData {
    /**
     * List of local column names (not fully qualified column names) of the table.
     */
    columns?: string[];
    /**
     * Data for multiple rows of the table.
     */
    rows?: Array<any[]>;
}

/**
 * Status of the query execution
 *
 * Enum defining possible Query Runner status
 */
export enum StatusType {
    Failed = "Failed",
    Running = "Running",
    Successful = "Successful",
}
