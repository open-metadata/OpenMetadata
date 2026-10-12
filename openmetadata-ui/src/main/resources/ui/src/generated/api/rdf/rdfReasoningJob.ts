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
 * Durable state of a reasoning job in the RDF store. Execution state, the answer of a
 * check, and the freshness of a published snapshot are separate: a SUCCEEDED check can
 * answer INCOMPLETE, and a SUCCEEDED refresh can publish a snapshot that is already STALE.
 */
export interface RDFReasoningJob {
    /**
     * Cancellation was requested. The state stays RUNNING until execution has stopped.
     */
    cancelRequested?: boolean;
    completedAt?:     number;
    /**
     * Job identifier.
     */
    id:        string;
    input:     Input;
    operation: Operation;
    outcome?:  Outcome;
    problem?:  Problem;
    progress?: Progress;
    /**
     * Idempotency key of the request that created the job.
     */
    requestId: string;
    /**
     * Snapshot a SUCCEEDED refresh published.
     */
    snapshotId?: string;
    startedAt?:  number;
    state:       State;
    submittedAt: number;
}

/**
 * What a job reasoned over and what computed it.
 */
export interface Input {
    /**
     * Engine builds that computed the result.
     */
    engines?: Engine[];
    /**
     * OpenMetadata's digest of the selected ontology input. Opaque to the store, which only
     * records it.
     */
    ontologyDigest?: string;
    /**
     * Root ontology of the import closure a check or explanation reasoned over. Absent for a
     * refresh, which covers every selected closure.
     */
    ontologyIri?:      string;
    ontologySelection: OntologySelection;
    /**
     * OpenMetadata's digest of the governance rule bundle. Opaque to the store, which only
     * records it.
     */
    ruleBundleDigest?: string;
    sourceRevision:    SourceRevision;
}

/**
 * A reasoning engine and the profile it answers.
 */
export interface Engine {
    /**
     * Engine name, such as HermiT, ELK or governance-rules.
     */
    name: string;
    /**
     * Fragment the engine answers, such as OWL 2 DL, OWL 2 EL or CONSTRUCT rules.
     */
    profile?: string;
    /**
     * Exact engine build.
     */
    version: string;
}

/**
 * Which ontology axioms take part. APPROVED is the production set and the only one a
 * refresh accepts. CANDIDATE adds draft axioms, to check a change before it is approved.
 */
export enum OntologySelection {
    Approved = "APPROVED",
    Candidate = "CANDIDATE",
}

/**
 * The serving graph a job reads: its dataset generation, and the highest live write
 * acknowledged before the job was submitted. The store captures after submission, so a job
 * sees at least those writes and possibly later ones; the revision is a conservative label.
 */
export interface SourceRevision {
    /**
     * Identity of the serving dataset, assigned when it was promoted. Promoting a dataset under
     * a reused physical name always assigns a new generation.
     */
    datasetGeneration: string;
    /**
     * Highest acknowledged live-write queue ID.
     */
    liveWriteWatermark: number;
}

/**
 * REFRESH recomputes the deductions from asserted input and publishes them as a new
 * snapshot. CHECK answers one typed question about an import closure. EXPLAIN justifies one
 * statement.
 */
export enum Operation {
    Check = "CHECK",
    Explain = "EXPLAIN",
    Refresh = "REFRESH",
}

/**
 * Answer of a check or explanation, as the entailment of one axiom: SUBSUMPTION checks
 * classExpression subClassOf superClassExpression, ENTAILMENT and EXPLAIN check the
 * statement, SATISFIABILITY checks classExpression subClassOf owl:Nothing (ENTAILED means
 * unsatisfiable), and a consistent closure answers CONSISTENCY with NOT_ENTAILED.
 * NOT_ENTAILED means a complete check found no entailment; it does not prove the negation.
 * INCONSISTENT means the closure has no model, so the answer carries no information.
 * INCOMPLETE means a problem stopped the check before it could answer.
 */
export enum Outcome {
    Entailed = "ENTAILED",
    Incomplete = "INCOMPLETE",
    Inconsistent = "INCONSISTENT",
    NotEntailed = "NOT_ENTAILED",
}

/**
 * Why a job FAILED, or why a check answered INCOMPLETE.
 */
export interface Problem {
    code:    ProblemCode;
    message: string;
    /**
     * The step that hit the problem, such as capture, classify, rules or publish.
     */
    step?: string;
    /**
     * What the problem concerns: the ontology IRI for an import-closure problem, the limit's
     * name in capabilities for LIMIT_EXCEEDED, or the rule's name for RULE_FAILED.
     */
    subject?: string;
}

/**
 * INVALID_REQUEST: the request failed validation. NOT_READY: reasoning is disabled or
 * cannot run safely. GENERATION_MISMATCH: the requested dataset generation no longer
 * serves. SUPERSEDED: a refresh with a later source revision has already published.
 * MISSING_IMPORT, PROFILE_VIOLATION and INCONSISTENT_ONTOLOGY: an import closure is missing
 * an import, is not OWL 2 DL, or has no model. LIMIT_EXCEEDED: a configured limit was
 * reached. MEMORY_BUDGET_EXHAUSTED: the worker ran out of heap. WORKER_LOST: the worker
 * exited without a result. RULE_FAILED: a governance rule failed to evaluate. INTERNAL: any
 * other error.
 */
export enum ProblemCode {
    GenerationMismatch = "GENERATION_MISMATCH",
    InconsistentOntology = "INCONSISTENT_ONTOLOGY",
    Internal = "INTERNAL",
    InvalidRequest = "INVALID_REQUEST",
    LimitExceeded = "LIMIT_EXCEEDED",
    MemoryBudgetExhausted = "MEMORY_BUDGET_EXHAUSTED",
    MissingImport = "MISSING_IMPORT",
    NotReady = "NOT_READY",
    ProfileViolation = "PROFILE_VIOLATION",
    RuleFailed = "RULE_FAILED",
    Superseded = "SUPERSEDED",
    WorkerLost = "WORKER_LOST",
}

/**
 * Coarse progress for display, not a time estimate.
 */
export interface Progress {
    completedSteps?: number;
    step?:           string;
    totalSteps?:     number;
}

/**
 * Execution state. A refresh SUCCEEDED once its snapshot is published; a check or
 * explanation once it has an outcome. CANCELLED is reported only after execution has
 * stopped. INTERRUPTED means the store restarted while the job was unfinished and discarded
 * its unpublished work.
 */
export enum State {
    Cancelled = "CANCELLED",
    Failed = "FAILED",
    Interrupted = "INTERRUPTED",
    Queued = "QUEUED",
    Running = "RUNNING",
    Succeeded = "SUCCEEDED",
}
