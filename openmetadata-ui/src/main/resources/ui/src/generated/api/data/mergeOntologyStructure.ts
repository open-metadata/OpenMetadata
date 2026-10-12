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
 * Select source fields to merge into a reviewable application ontology Draft.
 */
export interface MergeOntologyStructure {
    changeSetDescription:  string;
    changeSetDisplayName?: string;
    changeSetName:         string;
    /**
     * Subset terms used to resolve hierarchy and relationship targets.
     */
    contextTermIds:   string[];
    selections:       Selection[];
    sourceGlossaryId: string;
    targetGlossaryId: string;
}

export interface Selection {
    fields:       Field[];
    subsetTermId: string;
}

export enum Field {
    Attributes = "ATTRIBUTES",
    ConceptMappings = "CONCEPT_MAPPINGS",
    Description = "DESCRIPTION",
    DisplayName = "DISPLAY_NAME",
    EntityStatus = "ENTITY_STATUS",
    Name = "NAME",
    Parent = "PARENT",
    Relationships = "RELATIONSHIPS",
}
