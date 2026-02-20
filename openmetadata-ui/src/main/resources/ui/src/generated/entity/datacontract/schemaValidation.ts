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
 * Schema validation details for data contract.
 */
export interface SchemaValidation {
    /**
     * List of field names that appear more than once in the contract schema.
     */
    duplicateFields?: string[];
    /**
     * Number of schema checks failed.
     */
    failed?: number;
    /**
     * List of fields that do not exist in the entity.
     */
    failedFields?: string[];
    /**
     * Number of schema checks passed.
     */
    passed?: number;
    /**
     * Total number of schema checks.
     */
    total?: number;
    /**
     * List of fields with data type mismatches between contract and entity (format: 'fieldName:
     * expected TYPE1, got TYPE2').
     */
    typeMismatchFields?: string[];
}
