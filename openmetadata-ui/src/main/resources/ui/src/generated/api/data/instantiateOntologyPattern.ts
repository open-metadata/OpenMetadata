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
 * Create a durable Draft change set from a typed ontology modeling pattern.
 */
export interface InstantiateOntologyPattern {
    changeSetDescription:  string;
    changeSetDisplayName?: string;
    changeSetName:         string;
    glossaryId:            string;
    measuredKpi?:          MeasuredKpi;
    patternType:           PatternType;
    productHierarchy?:     ProductHierarchy;
    regulatoryControl?:    RegulatoryControl;
}

export interface MeasuredKpi {
    dimension: TermInput;
    kpi:       TermInput;
    metric:    TermInput;
}

export interface TermInput {
    description:  string;
    displayName?: string;
    name:         string;
}

export enum PatternType {
    MeasuredKpi = "MEASURED_KPI",
    ProductHierarchy = "PRODUCT_HIERARCHY",
    RegulatoryControl = "REGULATORY_CONTROL",
}

export interface ProductHierarchy {
    feature:   TermInput;
    portfolio: TermInput;
    product:   TermInput;
}

export interface RegulatoryControl {
    control:     TermInput;
    evidence:    TermInput;
    requirement: TermInput;
}
