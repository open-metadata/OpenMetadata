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
 * Page view data event
 */
export interface PageViewEvent {
    /**
     * complete URL of the page
     */
    fullUrl?: string;
    /**
     * domain name
     */
    hostname?: string;
    /**
     * language set on the page
     */
    language?: string;
    /**
     * time for the page to load in seconds
     */
    pageLoadTime?: number;
    /**
     * referrer URL
     */
    referrer?: string;
    /**
     * Size of the screen
     */
    screenSize?: string;
    /**
     * Unique ID identifying a session
     */
    sessionId?: string;
    /**
     * url part after the domain specification
     */
    url?: string;
    /**
     * OpenMetadata logged in user Id
     */
    userId?: string;
    [property: string]: any;
}
