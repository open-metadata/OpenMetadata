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
 * Changes which engine decides matching for one alert type, for the whole cluster.
 */
export interface SetAlertMatcherMode {
    alertType: AlertType;
    mode:      MatcherMode;
}

/**
 * Type of Alerts supported.
 */
export enum AlertType {
    ActivityFeed = "ActivityFeed",
    Custom = "Custom",
    GovernanceWorkflowChangeEvent = "GovernanceWorkflowChangeEvent",
    Notification = "Notification",
    Observability = "Observability",
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
