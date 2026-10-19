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
 * Admission and execution limits. A job that reaches one stops without publishing a partial
 * result, and a check answers INCOMPLETE. The store reports NOT_READY when a limit is unset.
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
 * READY admits jobs. NOT_READY means reasoning is enabled but cannot run safely, for
 * example because the memory budget does not fit the container limit; reasons say why.
 * DISABLED means reasoning is switched off.
 */
export enum Readiness {
    Disabled = "DISABLED",
    NotReady = "NOT_READY",
    Ready = "READY",
}
