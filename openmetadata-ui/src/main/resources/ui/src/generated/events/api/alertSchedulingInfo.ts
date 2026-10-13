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
 * How one alert is scheduled right now: its job, its trigger, how far it has read and what
 * the last reconcile found. It answers why an alert is not firing in one request.
 */
export interface AlertSchedulingInfo {
    /**
     * The position the alert has read up to.
     */
    currentOffset: number;
    /**
     * Whether the stored alert is enabled. A disabled alert has no job.
     */
    enabled: boolean;
    /**
     * Class the job is stored with. Absent when the alert has no job.
     */
    jobClass?: string;
    /**
     * Change events the alert has not read yet.
     */
    lag: number;
    /**
     * When a reconcile on the answering server last looked at this alert.
     */
    lastReconcileAt?: number;
    /**
     * What that reconcile found: healthy, or what it repaired.
     */
    lastReconcileVerdict?: string;
    /**
     * The offset of the newest change event.
     */
    latestOffset: number;
    /**
     * When the trigger fires next.
     */
    nextFireTime?: number;
    /**
     * When the trigger last fired.
     */
    previousFireTime?: number;
    /**
     * State of the alert's own trigger in the job store, such as NORMAL, BLOCKED or ERROR. NONE
     * when it has no trigger.
     */
    triggerState: string;
}
