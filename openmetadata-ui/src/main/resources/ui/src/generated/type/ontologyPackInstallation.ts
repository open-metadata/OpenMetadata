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
 * Durable provenance and version state for an installed ontology library pack.
 */
export interface OntologyPackInstallation {
    installedAt: number;
    installedBy: string;
    license:     string;
    licenseUrl:  string;
    modules:     OntologyPackModuleInstallation[];
    packId:      string;
    sourceUrl:   string;
    version:     string;
}

/**
 * Verified ontology pack module recorded as installation provenance.
 */
export interface OntologyPackModuleInstallation {
    moduleId: string;
    sha256:   string;
}
