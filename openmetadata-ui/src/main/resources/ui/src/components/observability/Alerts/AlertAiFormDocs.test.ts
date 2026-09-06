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
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Guards the alert form's hints against drift between the component and the
 * markdown that feeds it.
 *
 * Every other test in this folder mocks loadFormFieldDocs, so none of them
 * touch the real file: a field can be wired to a doc id that no longer exists
 * and the whole suite stays green while the panel silently shows nothing. That
 * is how the Notification Template field shipped with no hint at all.
 */
const DOCS_PATH = path.resolve(
  __dirname,
  '../../../../public/locales/en-US/OpenMetadata/ObservabilityAlertForm.md'
);
const COMPONENT_PATH = path.resolve(
  __dirname,
  'AlertAiFormFields.component.tsx'
);

// The component reads each field's doc through `docFor('<id>')`, so the call
// sites are the list of ids the form expects the markdown to define. The
// optional tail covers the second argument that gates registration on the
// section being rendered — `docFor('filters', shouldRenderFiltersSection)`.
const WIRED_FIELD_PATTERN = /docFor\('([^']+)'(?:,[^)]*)?\)/g;
const SECTION_ID_PATTERN = /\$\(id="([^"]+)"\)/g;

const matchAll = (source: string, pattern: RegExp): string[] => [
  ...new Set([...source.matchAll(pattern)].map(([, captured]) => captured)),
];

describe('ObservabilityAlertForm documentation', () => {
  const markdown = readFileSync(DOCS_PATH, 'utf8');
  const documentedIds = matchAll(markdown, SECTION_ID_PATTERN);
  const wiredIds = matchAll(
    readFileSync(COMPONENT_PATH, 'utf8'),
    WIRED_FIELD_PATTERN
  );

  it('reads both sources, so a refactor cannot turn this suite into a no-op', () => {
    // Without this the checks below pass vacuously if `docFor` is renamed or
    // the markdown moves — the exact silent failure they exist to prevent.
    expect(wiredIds.length).toBeGreaterThanOrEqual(7);
    expect(documentedIds.length).toBeGreaterThanOrEqual(7);
  });

  it('documents every field the form wires a hint to', () => {
    const undocumented = wiredIds.filter((id) => !documentedIds.includes(id));

    expect(undocumented).toEqual([]);
  });

  it('has no orphaned sections left behind by a renamed field', () => {
    const unused = documentedIds.filter((id) => !wiredIds.includes(id));

    expect(unused).toEqual([]);
  });

  it('only cites Handlebars placeholders the backend puts in scope', () => {
    // buildEventContext exposes event, entity, publisherName and
    // emailingEntity; anything else has to be a helper call. Flat names like
    // {{entityName}} render as empty text and Validate does not catch them,
    // so a template written from a bad hint silently delivers blanks.
    const IN_SCOPE = /^(entity|event)\.|^(publisherName|emailingEntity)$/;
    const cited = matchAll(markdown, /`\{\{([a-zA-Z][^}\s]*)\}\}`/g);
    const outOfScope = cited.filter((name) => !IN_SCOPE.test(name));

    expect(cited.length).toBeGreaterThan(0);
    expect(outOfScope).toEqual([]);
  });

  it('gives every section a body rather than a bare heading', () => {
    const sections = [
      ...markdown.matchAll(
        /\$\$section[\s\S]*?\$\(id="([^"]+)"\)\s*([\s\S]*?)\n\$\$/g
      ),
    ];
    const empty = sections
      .filter(([, , body]) => body.trim().length === 0)
      .map(([, id]) => id);

    expect(sections).toHaveLength(documentedIds.length);
    expect(empty).toEqual([]);
  });
});
