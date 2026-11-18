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
 * Typed payload persisted for a library install job. It names the verified pack selection
 * and never carries the pack body.
 */
export interface OntologyPackInstallJobArguments {
    /**
     * Selected modules with their dependencies, in catalogue order.
     */
    moduleIds:  string[];
    ontologyId: string;
    /**
     * SHA-256 over the pack id, version and the checksum of each selected module, checked again
     * when the job runs.
     */
    packDigest: string;
    packId:     string;
    version:    string;
}
