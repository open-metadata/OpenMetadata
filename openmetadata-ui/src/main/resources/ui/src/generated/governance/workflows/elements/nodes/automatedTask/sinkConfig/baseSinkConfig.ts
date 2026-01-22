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
 * Base configuration shared by all sink types.
 */
export interface BaseSinkConfig {
    /**
     * Configuration for retry behavior on failure.
     */
    retryConfig?: RetryConfiguration;
    /**
     * Timeout in seconds for sink operations.
     */
    timeout?: number;
}

/**
 * Configuration for retry behavior on failure.
 */
export interface RetryConfiguration {
    /**
     * Maximum number of retry attempts.
     */
    maxRetries?: number;
    /**
     * Delay between retry attempts in seconds.
     */
    retryDelaySeconds?: number;
}
