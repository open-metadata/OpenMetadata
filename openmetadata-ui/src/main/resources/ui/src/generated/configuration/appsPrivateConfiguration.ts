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
 * This schema defines a list of configurations for the Application Framework
 */
export interface AppsPrivateConfiguration {
    /**
     * List of configuration for apps
     */
    appsPrivateConfiguration: AppPrivateConfig[];
}

/**
 * Single Application Configuration Definition
 */
export interface AppPrivateConfig {
    /**
     * Application Name
     */
    name: string;
    /**
     * Parameters to initialize the Applications.
     */
    parameters: { [key: string]: any };
    /**
     * Flag to enable/disable preview for the application. If the app is in preview mode, it
     * can't be installed.
     */
    preview?:  boolean;
    schedule?: any[] | boolean | AppScheduleClass | number | number | null | string;
}

export interface AppScheduleClass {
    /**
     * Cron Expression in case of Custom scheduled Trigger
     */
    cronExpression?:  string;
    scheduleTimeline: ScheduleTimeline;
}

/**
 * This schema defines the Application ScheduleTimeline Options
 */
export enum ScheduleTimeline {
    Custom = "Custom",
    Daily = "Daily",
    Hourly = "Hourly",
    Monthly = "Monthly",
    None = "None",
    Weekly = "Weekly",
}
