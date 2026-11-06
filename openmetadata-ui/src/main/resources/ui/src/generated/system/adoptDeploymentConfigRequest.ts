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
 * Admin request to replace stored values of a setting with the values from the deployment
 * configuration.
 */
export interface AdoptDeploymentConfigRequest {
    /**
     * JSON pointers of the fields to take from the deployment configuration. When empty, every
     * field listed as overridden is taken.
     */
    paths?: string[];
}
