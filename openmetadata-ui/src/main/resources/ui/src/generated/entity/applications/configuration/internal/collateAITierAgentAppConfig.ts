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
 * The Collate AI Tier Agent will review the lineage and usage of your data and assign a
 * Tier to it, helping you identify business critical assets quickly. We currently support
 * Tables and will keep adding more assets in the future.
 */
export interface CollateAITierAgentAppConfig {
    /**
     * You can use the UI Query Filter builder to select the assets that you want to generate
     * the Tier for. You can filter by any property of your tables: the service, database or
     * schema they belong to, their name, owners, domain,... and even by Custom Properties!
     */
    filter: string;
    /**
     * The Tier Agent will only suggest a Tier by default. By toggling this option, the Agent
     * will automatically update the table with the Tier if there's no Tier assigned to it yet.
     */
    patchIfEmpty?: boolean;
    /**
     * Application Type
     */
    type?: CollateAITierAgentAppType;
}

/**
 * Application Type
 *
 * Application type.
 */
export enum CollateAITierAgentAppType {
    CollateAITierAgent = "CollateAITierAgent",
}
