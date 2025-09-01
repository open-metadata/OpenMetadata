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
export interface EntityRulesSettings {
    /**
     * Semantics rules defined in the data contract.
     */
    entitySemantics: SemanticsRule[];
}

/**
 * Semantics rule defined in the data contract.
 */
export interface SemanticsRule {
    /**
     * Description of the semantics rule.
     */
    description: string;
    /**
     * Indicates if the semantics rule is enabled.
     */
    enabled: boolean;
    /**
     * Type of the entity to which this semantics rule applies.
     */
    entityType?: string;
    /**
     * List of entities to ignore for this semantics rule.
     */
    ignoredEntities?: string[];
    /**
     * Name of the semantics rule.
     */
    name:      string;
    provider?: ProviderType;
    /**
     * Definition of the semantics rule.
     */
    rule: string;
}

/**
 * Type of provider of an entity. Some entities are provided by the `system`. Some are
 * entities created and provided by the `user`. Typically `system` provide entities can't be
 * deleted and can only be disabled. Some apps such as AutoPilot create entities with
 * `automation` provider type. These entities can be deleted by the user.
 */
export enum ProviderType {
    Automation = "automation",
    System = "system",
    User = "user",
}
