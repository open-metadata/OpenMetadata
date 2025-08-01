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
 * Create bot API request
 */
export interface CreateBot {
    /**
     * Bot user name created for this bot on behalf of which the bot performs all the
     * operations, such as updating description, responding on the conversation threads, etc.
     */
    botUser: string;
    /**
     * Description of the bot.
     */
    description?: string;
    /**
     * Name used for display purposes. Example 'FirstName LastName'.
     */
    displayName?: string;
    /**
     * Fully qualified names of the domains the Bot belongs to.
     */
    domains?: string[];
    /**
     * Name of the bot.
     */
    name:      string;
    provider?: ProviderType;
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
