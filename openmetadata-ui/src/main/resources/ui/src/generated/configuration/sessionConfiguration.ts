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
 * This schema defines the Session Configuration for managing session cookies and related
 * settings.
 */
export interface SessionConfiguration {
    /**
     * Force secure flag on session cookies even when not using HTTPS directly. Enable this when
     * running behind a proxy/load balancer that handles SSL termination.
     */
    forceSecureSessionCookie?: boolean;
}
