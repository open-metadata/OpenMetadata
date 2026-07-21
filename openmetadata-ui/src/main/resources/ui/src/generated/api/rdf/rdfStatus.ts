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
 * Authenticated RDF and Ontology Studio capability status.
 */
export interface RDFStatus {
    /**
     * Whether optional AI-assisted Ontology Studio routes may be rendered.
     */
    askCollateEnabled: boolean;
    /**
     * Configured base URI used for canonical RDF entity identifiers.
     */
    baseUri:         string;
    enabled:         boolean;
    inference:       RDFInferenceStatus;
    projectionState: ProjectionState;
    storageType:     string;
}

/**
 * Inference capabilities exposed by the RDF service.
 */
export interface RDFInferenceStatus {
    availableLevels: string[];
    defaultLevel:    string;
    enabled:         boolean;
}

export enum ProjectionState {
    Degraded = "DEGRADED",
    Disabled = "DISABLED",
    Ready = "READY",
    Rebuilding = "REBUILDING",
}
