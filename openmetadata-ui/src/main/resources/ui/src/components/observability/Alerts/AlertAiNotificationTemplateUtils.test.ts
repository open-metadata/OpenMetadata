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

import { getCustomTemplateFieldDocs } from './AlertAiNotificationTemplateUtils';

describe('AlertAiNotificationTemplateUtils', () => {
  it('returns rich markdown docs for custom notification template fields', () => {
    const docs = getCustomTemplateFieldDocs();

    expect(docs.displayName).not.toContain('# Template Name');
    expect(docs.displayName).toContain(
      'Provide a descriptive name for your notification template'
    );
    expect(docs.displayName).toContain('**Guidelines:**');
    expect(docs.displayName).toContain('"Data Quality Alert"');

    expect(docs.templateSubject).not.toContain('# Template Subject');
    expect(docs.templateSubject).toContain(
      'Define the subject line for your notification'
    );
    expect(docs.templateSubject).toContain('**Handlebars Support:**');
    expect(docs.templateSubject).toContain('`{{event.eventType}}`');

    expect(docs.templateBody).not.toContain('# Template Body');
    expect(docs.templateBody).toContain(
      'Create the main content of your notification'
    );
    expect(docs.templateBody).toContain('**Available Placeholders:**');
    expect(docs.templateBody).toContain('| `{{entity.fullyQualifiedName}}` |');
    expect(docs.templateBody).toContain('```handlebars');
    expect(docs.templateBody).toContain('{{#each changes.updates}}');
    expect(docs.templateBody).toContain('**Best Practices:**');
  });

  it('documents placeholders that exist in the backend template context', () => {
    // HandlebarsNotificationMessageEngine#buildEventContext puts exactly four
    // things in scope — event, entity, publisherName, emailingEntity — so
    // everything else has to hang off one of those. These flat names were
    // documented for a long time and none of them resolve: Handlebars renders
    // an unknown path as empty text, and Validate only checks syntax, so a
    // template built from them delivers blank messages with nothing failing.
    const FICTIONAL = [
      'eventType',
      'entityType',
      'entityName',
      'entityFqn',
      'entityUrl',
      'description',
      'updatedBy',
      'timestamp',
    ];
    const docs = getCustomTemplateFieldDocs();

    for (const field of ['templateSubject', 'templateBody'] as const) {
      for (const name of FICTIONAL) {
        expect(docs[field]).not.toContain(`{{${name}}}`);
      }
    }
  });
});
