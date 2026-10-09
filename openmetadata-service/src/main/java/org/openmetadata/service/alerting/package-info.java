/*
 *  Copyright 2026 Collate
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
 * Alerts and notifications: what an alert watches, who hears about it, what they read and how it
 * reaches them. It runs on the consumer runtime in {@code events.consumer}, and each package here
 * uses only the ones below it: delivery, then the channels, then the channel SPI, then content and
 * audience, then matching.
 *
 * <p>Code outside alerting reaches it through the channel SPI ({@code alerting.channel}), or
 * through one of these adapters: {@code EventSubscriptionRepository}, {@code
 * EventSubscriptionResource}, {@code EventSubscriptionMapper}, {@code
 * NotificationTemplateRepository}, {@code NotificationTemplateResource}, {@code
 * OpenMetadataApplication}, {@code ApplicationHandler}, {@code DataRetention}, {@code
 * OpenMetadataOperations} and {@code ExpressionValidator}. {@code AlertingArchitectureTest}
 * enforces both.
 */
package org.openmetadata.service.alerting;
