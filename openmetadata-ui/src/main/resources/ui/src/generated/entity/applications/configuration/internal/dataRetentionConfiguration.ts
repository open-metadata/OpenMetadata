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
export interface DataRetentionConfigurationClass {
    /**
     * Enter the retention period for Activity Threads of type = 'Conversation' records in days
     * (e.g., 30 for one month, 60 for two months).
     */
    activityThreadsRetentionPeriod: number;
    /**
     * Enter the retention period for change event records in days (e.g., 7 for one week, 30 for
     * one month).
     */
    changeEventRetentionPeriod: number;
}
