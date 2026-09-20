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
 * One event about which the stored condition text and the plan gave different answers.
 */
export interface AlertShadowDisagreement {
    eventId: string;
    /**
     * Offset of the event in the change event table.
     */
    offset?: number;
    /**
     * What the plan answered: yes, no, or the exception it threw.
     */
    plan: string;
    /**
     * What the stored condition text answered: yes, no, or the exception it threw.
     */
    storedText: string;
    /**
     * Type of the entity the event is about.
     */
    subjectType?: string;
    timestamp:    number;
}
