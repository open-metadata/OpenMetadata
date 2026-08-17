/*
 *  Copyright 2026 Collate.
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
 * Notification preferences that control which entity changes OpenMetadata records as Change
 * Events.
 */
export interface NotificationSettings {
    /**
     * Produce Change Events for Query entity create, update, and delete operations. Disabled by
     * default since queries are often ingested in large bulk batches.
     */
    enableQueryChangeEvents?: boolean;
}
