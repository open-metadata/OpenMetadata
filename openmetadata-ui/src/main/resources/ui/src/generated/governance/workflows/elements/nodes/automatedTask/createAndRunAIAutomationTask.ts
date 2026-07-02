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
 * Creates (or updates) a service-scoped AI Automation from a seed template and runs it.
 */
export interface CreateAndRunAIAutomationTask {
    branches?: string[];
    config?:   Config;
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

export interface Config {
    /**
     * If True, it will be created/updated and run. Otherwise it will only be created/updated.
     */
    shouldRun?: boolean;
    /**
     * Name of the seed AI Automation template to instantiate per service (e.g.
     * DescriptionAutomation).
     */
    template: string;
    /**
     * Seconds to wait before treating the run as timed out.
     */
    timeoutSeconds: number;
    /**
     * Set if this step should wait until the Automation run finishes.
     */
    waitForCompletion: boolean;
}

export interface InputNamespaceMap {
    relatedEntity: string;
}
