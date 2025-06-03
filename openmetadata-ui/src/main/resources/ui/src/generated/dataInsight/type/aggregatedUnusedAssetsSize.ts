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
 * AggregatedUnusedAssetsSize data blob
 */
export interface AggregatedUnusedAssetsSize {
    /**
     * Frequently used Data Assets
     */
    frequentlyUsedDataAssets?: DataAssetValues;
    /**
     * timestamp
     */
    timestamp?: number;
    /**
     * Unused Data Assets
     */
    unusedDataAssets?: DataAssetValues;
}

/**
 * Frequently used Data Assets
 *
 * Count or Size in bytes of Data Assets over a time period
 *
 * Unused Data Assets
 */
export interface DataAssetValues {
    /**
     * Data Asset Count or Size for 14 days
     */
    fourteenDays?: number | null;
    /**
     * Data Asset Count or Size for 7 days
     */
    sevenDays?: number | null;
    /**
     * Data Asset Count or Size for 60 days
     */
    sixtyDays?: number | null;
    /**
     * Data Asset Count or Size for 30 days
     */
    thirtyDays?: number | null;
    /**
     * Data Asset Count or Size for 3 days
     */
    threeDays?: number | null;
}
