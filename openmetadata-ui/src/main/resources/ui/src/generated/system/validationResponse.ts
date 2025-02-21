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
 * Define the system validation response
 */
export interface ValidationResponse {
    /**
     * Database connectivity check
     */
    database?: StepValidation;
    /**
     * JWKs validation
     */
    jwks?: StepValidation;
    /**
     * List migration results
     */
    migrations?: StepValidation;
    /**
     * Pipeline Service Client connectivity check
     */
    pipelineServiceClient?: StepValidation;
    /**
     * Search instance connectivity check
     */
    searchInstance?: StepValidation;
}

/**
 * Database connectivity check
 *
 * JWKs validation
 *
 * List migration results
 *
 * Pipeline Service Client connectivity check
 *
 * Search instance connectivity check
 */
export interface StepValidation {
    /**
     * Validation description. What is being tested?
     */
    description?: string;
    /**
     * Results or exceptions to be shared after running the test.
     */
    message?: string;
    /**
     * Did the step validation successfully?
     */
    passed?: boolean;
}
