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
 * Schema defining the response for event subscription events record, including total,
 * pending, successful, and failed event counts for a specific alert.
 */
export interface EventsRecord {
    /**
     * Count of failed events for specific alert.
     */
    failedEventsCount?: any;
    /**
     * Count of pending events for specific alert.
     */
    pendingEventsCount?: any;
    /**
     * Count of successful events for specific alert.
     */
    successfulEventsCount?: any;
    /**
     * Count of total events (pendingEventsCount + successfulEventsCount + failedEventsCount)
     * for specific alert.
     */
    totalEventsCount?: any;
}
