/*
 *  Copyright 2025 Collate.
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
 * Deny list recognizer that matches against a list of specific values
 */
export interface DenyListRecognizer {
    /**
     * Whether matching is case sensitive
     */
    caseSensitive?: boolean;
    /**
     * List of values to match against
     */
    denyList: string[];
    /**
     * Entity type this recognizer detects
     */
    supportedEntity: string;
    type:            any;
}
