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
 * This schema defines Document. A Generic entity to capture any kind of Json Payload.
 */
export interface CreateDocument {
    data: { [key: string]: any };
    /**
     * Description of the DocStore Entity.
     */
    description?: string;
    /**
     * Display Name that identifies this column name.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the Document belongs to.
     */
    domains?: string[];
    /**
     * Type of the Entity stored in DocStore.
     */
    entityType:         string;
    fullyQualifiedName: string;
    /**
     * Name of the DocStore
     */
    name: string;
}
