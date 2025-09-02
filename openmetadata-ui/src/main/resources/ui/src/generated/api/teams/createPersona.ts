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
 * Persona entity
 */
export interface CreatePersona {
    /**
     * When true, this persona is the system-wide default persona that will be applied to users
     * who don't have any persona assigned or no default persona set.
     */
    default?: boolean;
    /**
     * Optional description of the team.
     */
    description?: string;
    /**
     * Optional name used for display purposes. Example 'Data Steward'.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the Persona belongs to.
     */
    domains?: string[];
    name:     string;
    /**
     * Optional IDs of users that are going to assign a Persona.
     */
    users?: string[];
}
