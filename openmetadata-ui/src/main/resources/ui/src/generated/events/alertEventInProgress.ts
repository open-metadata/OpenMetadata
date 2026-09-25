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
 * A note an alert writes before it reads events and clears when it commits. It counts the
 * ticks in a row that opened at one position and never committed, so an event that stops
 * the server every time can be set aside.
 */
export interface AlertEventInProgress {
    /**
     * Ticks in a row that opened at this position and did not commit.
     */
    attempts: number;
    /**
     * The position the interrupted ticks opened at.
     */
    offset: number;
    /**
     * Update time of this row.
     */
    timestamp: number;
}
