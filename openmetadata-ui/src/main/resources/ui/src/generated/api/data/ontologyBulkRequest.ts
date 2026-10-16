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
 * Typed QTT-style bulk authoring request for an ontology glossary.
 */
export interface OntologyBulkRequest {
    changeSetDescription:  string;
    changeSetDisplayName?: string;
    changeSetName:         string;
    /**
     * UTF-8 CSV payload for CSV_UPSERT.
     */
    csv?:         string;
    dryRun:       boolean;
    findReplace?: FindReplace;
    glossaryId:   string;
    operation:    Operation;
    retype?:      Retype;
}

export interface FindReplace {
    caseSensitive: boolean;
    field:         MatchField;
    find:          string;
    matchMode:     MatchMode;
    replacement:   string;
}

export enum MatchField {
    Description = "DESCRIPTION",
    DisplayName = "DISPLAY_NAME",
    Name = "NAME",
}

export enum MatchMode {
    Contains = "CONTAINS",
    Exact = "EXACT",
}

export enum Operation {
    CSVUpsert = "CSV_UPSERT",
    FindReplace = "FIND_REPLACE",
    RetypeRelationships = "RETYPE_RELATIONSHIPS",
}

export interface Retype {
    fromRelationshipTypeId: string;
    /**
     * Optional bounded term scope. Omit to inspect every term in the glossary.
     */
    termIds?:             string[];
    toRelationshipTypeId: string;
}
