/**
 * Paginated failures from the most recent RDF indexing run.
 */
export interface RDFReindexFailuresResponse {
    data:   RDFIndexFailure[];
    limit:  number;
    offset: number;
    total:  number;
}

export interface RDFIndexFailure {
    entityFqn?:    string;
    entityId?:     string;
    entityType:    string;
    errorMessage?: string;
    failureStage:  string;
    id:            string;
    jobId:         string;
    serverId?:     string;
    stackTrace?:   string;
    timestamp:     number;
}
