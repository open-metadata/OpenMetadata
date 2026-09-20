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
 * What comparing the stored condition text with the plan has shown for one alert. Every
 * alert reads every change event, so most compared events are ones both engines reject, and
 * agreeing on those proves nothing: the report therefore counts what was exercised.
 */
export interface AlertShadowReport {
    /**
     * Events both engines judged.
     */
    compared?: number;
    /**
     * Coverage by the name of each filter and trigger the alert uses.
     */
    conditions?: { [key: string]: any };
    /**
     * Compared events about which the engines gave different answers.
     */
    disagreements?: number;
    /**
     * The latest of them, newest last, at most twenty.
     */
    latestDisagreements?: AlertShadowDisagreement[];
    /**
     * Compared events at least one engine said belong to the alert.
     */
    matchedByAnEngine?: number;
    /**
     * The same count, by the type of the entity the event is about.
     */
    matchedBySubjectType?: { [key: string]: any };
    /**
     * Events not compared because the alert's stored text is not what this server's catalog
     * compiles its definition to. Saving the alert makes it comparable.
     */
    notComparable?: number;
    /**
     * Events not compared because the comparison had used its time within the tick.
     */
    skipped?:  number;
    timestamp: number;
}

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
