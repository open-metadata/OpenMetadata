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
 * Configuration for assigning owners to ingested entities following topology hierarchy with
 * inheritance support
 */
export interface OwnerConfig {
    /**
     * Owner for database entities. Can be a single owner for all databases, or a map of
     * database names to owner(s).
     */
    database?: { [key: string]: string[] | string } | string;
    /**
     * Owner for schema entities. Can be a single owner for all schemas, or a map of schema FQNs
     * to owner(s).
     */
    databaseSchema?: { [key: string]: string[] | string } | string;
    /**
     * Default owner applied to all entities when no specific owner is configured (user or team
     * name/email)
     */
    default?: string;
    /**
     * Enable child entities to inherit owner from parent entities when they don't have a
     * specific owner configured
     */
    enableInheritance?: boolean;
    /**
     * Owner for the service level
     */
    service?: string;
    /**
     * Owner for table entities. Can be a single owner for all tables, or a map of table FQNs to
     * owner(s).
     */
    table?: { [key: string]: string[] | string } | string;
}
