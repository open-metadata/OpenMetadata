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
 * The complete catalog of supported Ontology Studio modeling patterns.
 */
export interface OntologyPatternList {
    data: OntologyPatternTemplate[];
}

/**
 * A governed ontology modeling pattern available to Ontology Studio.
 */
export interface OntologyPatternTemplate {
    description:       string;
    displayName:       string;
    patternType:       PatternType;
    relationshipRoles: RelationshipRole[];
    termRoles:         TermRole[];
}

export enum PatternType {
    MeasuredKpi = "MEASURED_KPI",
    ProductHierarchy = "PRODUCT_HIERARCHY",
    RegulatoryControl = "REGULATORY_CONTROL",
}

export interface RelationshipRole {
    fromRole:         string;
    relationshipType: string;
    toRole:           string;
}

export interface TermRole {
    description: string;
    displayName: string;
    key:         string;
}
