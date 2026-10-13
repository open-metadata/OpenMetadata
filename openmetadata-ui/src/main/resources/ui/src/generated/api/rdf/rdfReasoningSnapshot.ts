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
 * An immutable result of a reasoning refresh in the RDF store: the deductions computed from
 * one capture of the asserted input. Inferred answers always come from one snapshot, never
 * from live assertions mixed with older conclusions.
 */
export interface RDFReasoningSnapshot {
    /**
     * How the snapshot's input compares with the serving graph, ontologies and rules now.
     * OpenMetadata sets it when it serves an answer. The store leaves it out: it cannot see
     * live writes that are enqueued but not yet applied.
     */
    freshness?: Freshness;
    /**
     * Snapshot identifier.
     */
    id:    string;
    input: Input;
    /**
     * The refresh job that published the snapshot.
     */
    jobId: string;
    /**
     * When the snapshot became readable.
     */
    publishedAt: number;
}

/**
 * How the snapshot's input compares with the serving graph, ontologies and rules now.
 * OpenMetadata sets it when it serves an answer. The store leaves it out: it cannot see
 * live writes that are enqueued but not yet applied.
 *
 * UNKNOWN while projection health is degraded, for example after a dead-lettered write or a
 * write outside the queue that could not be recorded: the graph may be missing writes, and
 * a refresh cannot repair it. Otherwise CURRENT when the dataset generation still serves,
 * the source revision covers every enqueued live write (writes outside the queue take a
 * queue ID too), and the ontology and rule digests match; STALE when any of these no longer
 * holds. Independent of job state: a SUCCEEDED refresh can publish a snapshot that is
 * already STALE.
 */
export enum Freshness {
    Current = "CURRENT",
    Stale = "STALE",
    Unknown = "UNKNOWN",
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
