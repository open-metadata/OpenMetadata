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
 * Request to create a new Announcement.
 */
export interface CreateAnnouncement {
    /**
     * Announcement content in Markdown format.
     */
    description: string;
    /**
     * Display name for the announcement.
     */
    displayName?: string;
    /**
     * End time when the announcement expires.
     */
    endTime: number;
    /**
     * Link to the entity this announcement is about.
     */
    entityLink?: string;
    /**
     * Name for the announcement.
     */
    name?: string;
    /**
     * Owners of this announcement.
     */
    owners?: string[];
    /**
     * Start time from when the announcement should be shown.
     */
    startTime: number;
}
