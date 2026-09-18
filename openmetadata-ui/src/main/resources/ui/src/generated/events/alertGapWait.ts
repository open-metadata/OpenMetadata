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
 * A wait an alert started at a gap in the change event offsets. It belongs to the position
 * it was measured at and is ignored at any other position.
 */
export interface AlertGapWait {
    /**
     * The position of the alert when the gap was first seen.
     */
    atOffset: number;
    /**
     * When the gap was first seen.
     */
    since: number;
    /**
     * Update time of this row.
     */
    timestamp: number;
}
