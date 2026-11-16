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
 * The delivery health of every destination of one alert, kept in a row so that edits,
 * restarts and test sends never reset it.
 */
export interface AlertHealth {
    /**
     * Health by destination id. Each value is a destinationHealth.json document.
     */
    destinations: { [key: string]: any };
    /**
     * Update time of this row.
     */
    timestamp: number;
}
