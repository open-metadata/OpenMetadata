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
 * Private Configuration for the CollateAITierAgent Internal Application.
 */
export interface CollateAITierAgentAppPrivateConfig {
    /**
     * Limits for the CollateAITierAgent Application.
     */
    limits: AppLimitsConfig;
}

/**
 * Limits for the CollateAITierAgent Application.
 *
 * Private Configuration for the App Limits.
 */
export interface AppLimitsConfig {
    /**
     * The records of the limits.
     */
    actions: Action[];
    /**
     * The start of this limit cycle.
     */
    billingCycleStart: Date;
}

export interface Action {
    /**
     * Limit for the action in the cycle on an annual basis.
     */
    limit?: number;
    /**
     * The action that is being performed and limited
     */
    name?: string;
    [property: string]: any;
}
