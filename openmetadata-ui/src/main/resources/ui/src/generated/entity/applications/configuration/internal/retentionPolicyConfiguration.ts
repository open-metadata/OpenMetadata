/*
 *  Copyright 2024 Collate.
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
 * Retention Policy Configuration.
 */
export interface RetentionPolicyConfiguration {
    /**
     * The entity for which the records will be deleted
     */
    entity: Entity;
    /**
     * Select the retention period after which the records will be deleted
     */
    retentionPeriod: RetentionPeriod;
}

/**
 * The entity for which the records will be deleted
 */
export enum Entity {
    EventSubscription = "EventSubscription",
}

/**
 * Select the retention period after which the records will be deleted
 */
export enum RetentionPeriod {
    OneMonth = "One month",
    OneWeek = "One week",
    SixMonths = "Six months",
    ThreeMonths = "Three months",
    TwoWeeks = "Two weeks",
}
