/*
 *  Copyright 2025 Collate.
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
 * Sets the GlossaryTerm Status to the configured value.
 */
export interface SetGlossaryTermStatusTask {
    config?: NodeConfiguration;
    /**
     * Description of the Node.
     */
    description?: string;
    /**
     * Display Name that identifies this Node.
     */
    displayName?:       string;
    input?:             string[];
    inputNamespaceMap?: InputNamespaceMap;
    /**
     * Name that identifies this Node.
     */
    name?:    string;
    subType?: string;
    type?:    string;
    [property: string]: any;
}

export interface NodeConfiguration {
    /**
     * Choose which Status to apply to the Glossary Term
     */
    glossaryTermStatus: Status;
}

/**
 * Choose which Status to apply to the Glossary Term
 */
export enum Status {
    Approved = "Approved",
    Deprecated = "Deprecated",
    Draft = "Draft",
    InReview = "In Review",
    Rejected = "Rejected",
}

export interface InputNamespaceMap {
    relatedEntity: string;
    updatedBy?:    string;
}
