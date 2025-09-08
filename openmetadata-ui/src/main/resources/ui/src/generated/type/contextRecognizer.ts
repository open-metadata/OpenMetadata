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
 * Context-aware recognizer using surrounding text
 */
export interface ContextRecognizer {
    /**
     * Words that indicate the presence of the entity
     */
    contextWords: string[];
    /**
     * Factor to increase score based on entity length
     */
    increaseFactorByCharLength?: number;
    /**
     * Maximum confidence score
     */
    maxScore?: number;
    /**
     * Minimum confidence score
     */
    minScore?: number;
    /**
     * Entity type this recognizer detects
     */
    supportedEntity: string;
    type:            any;
}
