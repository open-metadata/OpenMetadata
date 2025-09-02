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
 * AggregatedUsedVsUnusedAssetsCount data blob
 */
export interface AggregatedUsedVsUnusedAssetsCount {
    /**
     * timestamp
     */
    timestamp?: number;
    /**
     * Count of unused assets (last access >= 3 days)
     */
    Unused?: number;
    /**
     * Percentage of the count of unused assets (last access >= 3 days)
     */
    UnusedPercentage?: number;
    /**
     * Count of used assets (last access < 3 days)
     */
    Used?: number;
    /**
     * Percentage of the count of used assets (last access < 3 days)
     */
    UsedPercentage?: number;
}
