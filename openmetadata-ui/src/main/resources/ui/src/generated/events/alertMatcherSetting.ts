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
 * Which engine decides if an event belongs to an alert, one value for the whole cluster,
 * per alert type. An alert must never be decided by one engine on one server and by the
 * other on the next.
 */
export interface AlertMatcherSetting {
    notification:  MatcherMode;
    observability: MatcherMode;
    /**
     * When the setting was changed last.
     */
    timestamp: number;
    /**
     * Who changed the setting last.
     */
    updatedBy?: string;
}

/**
 * stored: the stored condition text decides and the plan is not evaluated. shadow: the
 * stored text decides and the plan is evaluated beside it. plan: the plan decides and the
 * stored text is evaluated beside it.
 */
export enum MatcherMode {
    Plan = "plan",
    Shadow = "shadow",
    Stored = "stored",
}
