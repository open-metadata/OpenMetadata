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

import type { TFunction } from 'i18next';
import { isEmpty } from 'lodash';
import type { NotificationTemplate } from '../../../generated/entity/events/notificationTemplate';
import type { ModifiedCreateEventSubscription } from '../../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import {
  CUSTOM_TEMPLATE_VALUE,
  SYSTEM_DEFAULT_TEMPLATES,
} from './Template.constants';

export const CUSTOM_TEMPLATE_FIELD_NAMES = {
  displayName: 'displayName',
  templateBody: 'templateBody',
  templateSubject: 'templateSubject',
} as const;

export const CUSTOM_TEMPLATE_FIELD_DOC_NAMES = {
  displayName: 'root/displayName',
  templateBody: 'root/templateBody',
  templateSubject: 'root/templateSubject',
} as const;

export type CustomTemplateField = keyof typeof CUSTOM_TEMPLATE_FIELD_NAMES;
export type CustomTemplateErrors = Partial<Record<CustomTemplateField, string>>;

interface CustomTemplateFieldLabels {
  displayName: string;
  templateBody: string;
  templateSubject: string;
}

export const getSelectedTemplateKey = (
  notificationTemplate: ModifiedCreateEventSubscription['notificationTemplate']
) => {
  if (typeof notificationTemplate === 'string') {
    return notificationTemplate;
  }

  return notificationTemplate
    ? JSON.stringify(notificationTemplate)
    : undefined;
};

export const getSelectedSavedTemplate = (
  selectedTemplate: string | undefined,
  templates: NotificationTemplate[] = []
) => {
  if (
    !selectedTemplate ||
    [CUSTOM_TEMPLATE_VALUE, SYSTEM_DEFAULT_TEMPLATES].includes(selectedTemplate)
  ) {
    return;
  }

  try {
    const parsedTemplate = JSON.parse(selectedTemplate);

    return templates.find((template) => template.id === parsedTemplate.id);
  } catch {
    return;
  }
};

export const getTemplateFieldLabel = (t: TFunction, fieldName: string) =>
  t('label.template-field-name', { fieldName });

export const getCustomTemplateFieldLabels = (
  t: TFunction
): CustomTemplateFieldLabels => ({
  displayName: getTemplateFieldLabel(t, t('label.name')),
  templateBody: getTemplateFieldLabel(t, t('label.body')),
  templateSubject: getTemplateFieldLabel(t, t('label.subject')),
});

export const getCustomTemplateFieldDocs = (): Record<
  CustomTemplateField,
  string
> => ({
  displayName: `Provide a descriptive name for your notification template. This name will help identify the template when configuring alerts and notifications.

**Guidelines:**

- Use a clear, descriptive name that indicates the template's purpose
- Examples: "Data Quality Alert", "Incident Notification", "Weekly Report"`,
  templateSubject: `Define the subject line for your notification. This appears as the email subject or message header.

**Handlebars Support:**

Values are nested under \`entity\` (the asset) and \`event\` (what happened). Type \`{{\` to browse them:

- \`{{entity.displayName}}\` - The name of the affected entity
- \`{{entity.fullyQualifiedName}}\` - Its fully qualified name
- \`{{event.eventType}}\` - The type of event that triggered the notification
- \`{{event.entityType}}\` - The type of entity involved (Table, Pipeline, Dashboard, etc.)
- \`{{publisherName}}\` - The name of the alert that sent this

Recipients triage on the subject line, so lead with the entity name.`,
  templateBody: `Create the main content of your notification using rich text and Handlebars placeholders.

**Available Placeholders:**

| Placeholder | Description |
| --- | --- |
| \`{{entity.name}}\` | Name of the entity |
| \`{{entity.displayName}}\` | Display name of the entity |
| \`{{entity.fullyQualifiedName}}\` | Fully qualified name of the entity |
| \`{{entity.description}}\` | Description of the entity |
| \`{{entity.updatedBy}}\` | User who made the change |
| \`{{event.eventType}}\` | Type of event (e.g., entityCreated, entityUpdated) |
| \`{{event.entityType}}\` | Type of entity (Table, Pipeline, etc.) |
| \`{{event.userName}}\` | User the event is attributed to |
| \`{{publisherName}}\` | Name of the alert that sent this |

**Helpers:**

| Helper | Description |
| --- | --- |
| \`{{buildEntityUrl entity}}\` | Link to the entity in Collate |
| \`{{formatDate event.timestamp}}\` | Event timestamp, human readable |
| \`{{camelCaseToTitle field}}\` | Turns a field name into a readable label |

**Conditional Blocks:**

Use \`{{#if condition}}...{{/if}}\` for conditional content:

\`\`\`handlebars
{{#if entity.description}}
Description: {{entity.description}}
{{/if}}
\`\`\`

**Iteration:**

Use \`{{#each items}}...{{/each}}\` to iterate over lists:

\`\`\`handlebars
{{#each changes.updates}}
- {{camelCaseToTitle name}}: {{oldValue}} -> {{newValue}}
{{/each}}
\`\`\`

**Best Practices:**

- Keep templates concise and actionable
- Include relevant links for quick access to affected entities
- Use conditional blocks for optional information
- Test templates with the Validate button before saving`,
});

export const getRequiredTemplateFieldError = (
  t: TFunction,
  fieldName: string
) =>
  t('label.field-required', {
    field: getTemplateFieldLabel(t, fieldName),
  });

export const getCustomTemplateRequiredErrors = (
  customTemplateData:
    | ModifiedCreateEventSubscription['customNotificationTemplateData']
    | undefined,
  t: TFunction
): CustomTemplateErrors => {
  const nextErrors: CustomTemplateErrors = {};

  if (isEmpty(customTemplateData?.displayName)) {
    nextErrors.displayName = getRequiredTemplateFieldError(t, t('label.name'));
  }

  if (isEmpty(customTemplateData?.templateSubject)) {
    nextErrors.templateSubject = getRequiredTemplateFieldError(
      t,
      t('label.subject')
    );
  }

  if (isEmpty(customTemplateData?.templateBody)) {
    nextErrors.templateBody = getRequiredTemplateFieldError(t, t('label.body'));
  }

  return nextErrors;
};

export const getCustomTemplateFieldData = ({
  customTemplateData,
  isCustomTemplate,
  selectedSavedTemplate,
}: {
  customTemplateData?: ModifiedCreateEventSubscription['customNotificationTemplateData'];
  isCustomTemplate: boolean;
  selectedSavedTemplate?: NotificationTemplate;
}) => {
  if (isCustomTemplate) {
    return customTemplateData;
  }

  return selectedSavedTemplate
    ? {
        displayName:
          selectedSavedTemplate.displayName ?? selectedSavedTemplate.name,
        templateBody: selectedSavedTemplate.templateBody,
        templateSubject: selectedSavedTemplate.templateSubject,
      }
    : undefined;
};
