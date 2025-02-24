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
 * This schema defines the type for reporting the count of threads related to an entity.
 */
export interface ThreadCount {
    /**
     * Total count of all the active announcements associated with the entity.
     */
    activeAnnouncementCount?: number;
    /**
     * Total count of all the tasks.
     */
    closedTaskCount?: number;
    /**
     * Total count of all the threads of type Conversation.
     */
    conversationCount?: number;
    entityLink?:        string;
    /**
     * Total count of all the inactive announcements associated with the entity.
     */
    inactiveAnnouncementCount?: number;
    /**
     * Total count of all the mentions of a user.
     */
    mentionCount?: number;
    /**
     * Total count of all the open tasks.
     */
    openTaskCount?: number;
    /**
     * Total count of all the announcements associated with the entity.
     */
    totalAnnouncementCount?: number;
    /**
     * Total count of all the tasks.
     */
    totalTaskCount?: number;
}
