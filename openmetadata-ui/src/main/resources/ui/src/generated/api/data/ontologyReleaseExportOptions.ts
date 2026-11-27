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
 * Query options of a sealed ontology release export. Definitions come from the release.
 * Bound asset links are the caller's current authorized operational metadata, so they are
 * opt-in.
 */
export interface OntologyReleaseExportOptions {
    /**
     * Write one link per binding from a concept to the asset it is bound to. Not available for
     * CSV.
     */
    includeBoundAssets?: boolean;
    /**
     * Write the owl:inverseOf pairs the properties state.
     */
    includeInverses?: boolean;
    /**
     * Refuse to export, with status 422 and the validation report, unless the release validates.
     */
    shaclGate?: boolean;
}
