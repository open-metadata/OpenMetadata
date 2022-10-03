/*
 *  Copyright 2021 Collate
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

/* eslint-disable max-len */

export const WEBHOOK_LISTING_TEXT =
  'The webhook allows external services to be notified of the metadata change events happening in your organization through APIs. Register callback URLs with webhook integration to receive metadata event notifications. You can add, list, update, and delete webhooks.';

export const SLACK_LISTING_TEXT =
  'Provide timely updates to the producers and consumers of metadata via Slack notifications. Use Slack webhooks to send notifications regarding the metadata change events in your organization through APIs. You can add, list, update, and delete these webhooks.';

export const MS_TEAMS_LISTING_TEXT =
  'Provide timely updates to the producers and consumers of metadata via MS Teams notifications. Use MS Teams webhooks to send notifications regarding the metadata change events in your organization through APIs. You can add, list, update, and delete these webhooks.';

export const CONFIGURE_WEBHOOK_TEXT =
  'OpenMetadata can be configured to automatically send out event notifications to registered webhooks. Enter the webhook name, and an Endpoint URL to receive the HTTP call back on. Use Event Filters to only receive notifications based on events of interest, like when an entity is created, updated, or deleted; and for the entities your application is interested in. Add a description to help people understand the purpose of the webhook and to keep  track of the use case. Use advanced configuration to set up a shared secret key to verify the webhook events using HMAC signature.';

export const CONFIGURE_SLACK_TEXT =
  'Automatically send out event notifications to registered Slack webhooks through OpenMetadata. Enter the webhook name, and an Endpoint URL to receive the HTTP call back on. Use Event Filters to only receive notifications for the required entities. Filter events based on when an entity is created, updated, or deleted. Add a description to note the use case of the webhook. You can use advanced configuration to set up a shared secret key to verify the Slack webhook events using HMAC signature.';

export const CONFIGURE_MS_TEAMS_TEXT =
  'Automatically send out event notifications to registered MS Teams webhooks through OpenMetadata. Enter the MS Teams webhook name, and an Endpoint URL to receive the HTTP call back on. Use Event Filters to only receive notifications for the required entities. Filter events based on when an entity is created, updated, or deleted. Add a description to note the use case of the webhook. You can use advanced configuration to set up a shared secret key to verify the MS Teams webhook events using HMAC signature.';

export const ADD_ROLE_TEXT = `Roles are assigned to Users. In OpenMetadata, Roles are a collection of
        Policies. Each Role must have at least one policy attached to it. A Role
        supports multiple policies with a one to many relationship. Ensure that
        the necessary policies are created before creating a new role. Build
        rich access control roles with well-defined policies based on
        conditional rules.`;

export const ADD_POLICY_TEXT = `
Policies are assigned to Teams. In OpenMetadata, a Policy is a collection of Rules, which define access based on certain conditions. We support rich SpEL (Spring Expression Language) based conditions. All the operations supported by an Entity are published. Use these fine grained operations to define the conditional Rules for each Policy.
Create well-defined policies based on conditional rules to build rich access control roles.
        `;

export const NO_PERMISSION_FOR_ACTION =
  'You do not have the necessary permissions to perform this action.';

export const NO_PERMISSION_TO_VIEW =
  'You do not have the necessary permissions to view this data.';

export const GROUP_TEAM_TYPE_CHANGE_MSG =
  "The team type 'Group' cannot be changed. Please create a new team with the preferred type.";

export const INGESTION_BOT_CANT_BE_DELETED =
  'You can not delete the ingestion bot.';

export const BOT_ACCOUNT_EMAIL_CHANGE_CONFIRMATION =
  'Changing account email will update or create a new bot user';
