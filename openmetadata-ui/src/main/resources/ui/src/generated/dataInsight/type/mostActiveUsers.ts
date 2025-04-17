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
 * pageViewsByEntities data blob
 */
export interface MostActiveUsers {
    /**
     * avg. duration of a sessions in seconds
     */
    avgSessionDuration?: number;
    /**
     * date time of the most recent session for the user
     */
    lastSession?: number;
    /**
     * Total number of pages viewed by the user
     */
    pageViews?: number;
    /**
     * Total duration of all sessions in seconds
     */
    sessionDuration?: number;
    /**
     * Total number of sessions
     */
    sessions?: number;
    /**
     * Team a user belongs to
     */
    team?: string;
    /**
     * Name of a user
     */
    userName?: string;
}
