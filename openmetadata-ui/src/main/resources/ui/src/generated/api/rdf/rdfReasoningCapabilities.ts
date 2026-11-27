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
 * What the RDF store's reasoning capability supports and whether it may run now.
 * OpenMetadata reads this before submitting work and never falls back to reasoning in its
 * own process.
 */
export interface RDFReasoningCapabilities {
    /**
     * OWL 2 constructs the engines answer with full semantics, by structural-specification name
     * such as ObjectSomeValuesFrom or TransitiveObjectProperty. A closure using anything else
     * is reported as incomplete, never approximated.
     */
    coverage?:     string[];
    engines?:      Engine[];
    limits?:       Limits;
    memoryBudget?: MemoryBudget;
    /**
     * What the store can perform, at most one entry per operation. An operation that is not
     * listed is NOT_IMPLEMENTED, and so is every operation when the list is absent. Readiness
     * says whether the store may admit work now; this says what work this build can do at all,
     * so OpenMetadata can tell a store that cannot yet perform an operation from one that
     * failed.
     */
    operations?: OperationSupport[];
    /**
     * Version of this reasoning protocol. OpenMetadata refuses versions it does not know.
     */
    protocolVersion: string;
    readiness:       Readiness;
    /**
     * Why reasoning is not ready, one sentence each.
     */
    reasons?: string[];
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
 * The admission and execution limits the store enforces; a limit it does not enforce is
 * absent. A job that reaches one stops without publishing a partial result, and a check
 * answers INCOMPLETE. Limits are mandatory per operation, not for readiness: the store
 * reports an operation AVAILABLE only when it enforces every limit that operation needs.
 * REFRESH, CHECK and EXPLAIN need maxQueuedJobs, maxJobSeconds, maxDiskBytes,
 * maxClosureAxioms, maxIndividuals, maxExpressionDepth and maxImports; REFRESH also needs
 * maxDerivedTriples and maxRulePasses; RESULTS and QUERY need maxResultRows, and QUERY also
 * needs maxQuerySeconds.
 */
export interface Limits {
    /**
     * Axioms in one ontology import closure.
     */
    maxClosureAxioms?: number;
    /**
     * Triples one refresh may derive.
     */
    maxDerivedTriples?: number;
    /**
     * Disk for job directories, working datasets and snapshots together.
     */
    maxDiskBytes?:       number;
    maxExpressionDepth?: number;
    /**
     * Ontologies in one import closure.
     */
    maxImports?:     number;
    maxIndividuals?: number;
    maxJobSeconds?:  number;
    /**
     * Deadline for one snapshot query.
     */
    maxQuerySeconds?: number;
    maxQueuedJobs?:   number;
    /**
     * Rows one snapshot query returns.
     */
    maxResultRows?: number;
    maxRulePasses?: number;
}

/**
 * The memory budget the store checks before admitting work: every JVM region is capped, and
 * the capped total plus a page-cache floor must fit under the container limit with the
 * safety margin.
 */
export interface MemoryBudget {
    /**
     * Container memory limit, or physical memory when unlimited.
     */
    containerLimitBytes: number;
    fusekiHeapBytes?:    number;
    fusekiOffHeapBytes?: number;
    /**
     * Page cache kept free for serving queries.
     */
    pageCacheFloorBytes?: number;
    /**
     * Limit the budget needs: (Fuseki heap + Fuseki off-heap + worker heap + worker off-heap +
     * page-cache floor) / (1 - margin).
     */
    requiredBytes: number;
    /**
     * Fraction of the container limit kept free, such as 0.1.
     */
    safetyMargin?:       number;
    workerHeapBytes?:    number;
    workerOffHeapBytes?: number;
}

/**
 * Whether the store can perform one operation.
 */
export interface OperationSupport {
    availability: Availability;
    operation:    Operation;
    /**
     * Why the operation is not available, one sentence.
     */
    reason?: string;
}

/**
 * AVAILABLE: this build implements the operation and enforces every limit it needs, so it
 * runs whenever readiness is READY. NOT_IMPLEMENTED: this build cannot perform the
 * operation; using it fails with the problem NOT_IMPLEMENTED, whatever the readiness, until
 * the store is upgraded.
 */
export enum Availability {
    Available = "AVAILABLE",
    NotImplemented = "NOT_IMPLEMENTED",
}

/**
 * An operation of the store's reasoning API. REFRESH, CHECK and EXPLAIN are the job
 * operations a request names. RESULTS reads the result of a finished check or explanation.
 * QUERY runs a bounded SELECT or ASK over a published snapshot.
 */
export enum Operation {
    Check = "CHECK",
    Explain = "EXPLAIN",
    Query = "QUERY",
    Refresh = "REFRESH",
    Results = "RESULTS",
}

/**
 * READY admits jobs. NOT_READY means reasoning is enabled but cannot run safely, for
 * example because the memory budget does not fit the container limit; reasons say why.
 * DISABLED means reasoning is switched off. Readiness does not say which operations this
 * build implements; operations does.
 */
export enum Readiness {
    Disabled = "DISABLED",
    NotReady = "NOT_READY",
    Ready = "READY",
}
