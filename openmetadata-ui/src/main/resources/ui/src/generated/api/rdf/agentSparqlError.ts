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
 * Stable machine-readable failure for the agent SPARQL endpoint. Messages never include
 * credentials or backend internals.
 */
export interface AgentSparqlError {
    code:    Code;
    message: string;
    /**
     * Server-generated identifier correlating this response with server logs.
     */
    requestId: string;
}

export enum Code {
    AuthenticationRequired = "AUTHENTICATION_REQUIRED",
    ExecutionCapacityExhausted = "EXECUTION_CAPACITY_EXHAUSTED",
    ExecutionTimeout = "EXECUTION_TIMEOUT",
    FederationNotAllowed = "FEDERATION_NOT_ALLOWED",
    GraphSelectionNotAllowed = "GRAPH_SELECTION_NOT_ALLOWED",
    ImpersonationNotAllowed = "IMPERSONATION_NOT_ALLOWED",
    ProjectionNotReady = "PROJECTION_NOT_READY",
    QueryFormNotAllowed = "QUERY_FORM_NOT_ALLOWED",
    QueryInvalid = "QUERY_INVALID",
    QueryLimitExceeded = "QUERY_LIMIT_EXCEEDED",
    RDFBackendFailure = "RDF_BACKEND_FAILURE",
    RDFQueryForbidden = "RDF_QUERY_FORBIDDEN",
    RDFRepositoryUnavailable = "RDF_REPOSITORY_UNAVAILABLE",
    ResultOutputLimitExceeded = "RESULT_OUTPUT_LIMIT_EXCEEDED",
}
