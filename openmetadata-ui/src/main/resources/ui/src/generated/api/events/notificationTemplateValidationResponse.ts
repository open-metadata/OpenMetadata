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
 * Response from notification template validation
 */
export interface NotificationTemplateValidationResponse {
    /**
     * Error message if body validation failed, null otherwise
     */
    bodyError?: null | string;
    /**
     * Whether both subject and body passed validation
     */
    isValid: boolean;
    /**
     * Error message if subject validation failed, null otherwise
     */
    subjectError?: null | string;
}
