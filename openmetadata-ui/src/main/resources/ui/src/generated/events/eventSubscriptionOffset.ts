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
 * Represents the offsets for an event subscription, tracking the starting point and current
 * position of events processed.
 */
export interface EventSubscriptionOffset {
    /**
     * The current position in the events.
     */
    currentOffset: number;
    /**
     * The offset from where event processing starts.
     */
    startingOffset: number;
    /**
     * Update time of the job status.
     */
    timestamp?: number;
}
