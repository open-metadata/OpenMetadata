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
 * Rejects RecognizerFeedback, updating its status to REJECTED without modifying the tag or
 * entity.
 */
export interface RejectRecognizerFeedbackTask {
    config?: Config;
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
    output?:  string[];
    subType?: string;
    type?:    string;
    [property: string]: any;
}

export interface Config {
}

export interface InputNamespaceMap {
    relatedEntity:      string;
    triggeringObjectId: string;
    updatedBy:          string;
}
