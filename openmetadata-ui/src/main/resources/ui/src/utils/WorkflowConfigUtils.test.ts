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

import {
  buildEntityFieldGroups,
  buildFieldOptions,
  getCustomPropertyFieldNames,
  getFieldDisplayLabel,
} from './WorkflowConfigUtils';

describe('WorkflowConfigUtils.getCustomPropertyFieldNames', () => {
  const propertiesByType = {
    table: [{ name: 'owner_team' }, { name: 'sla' }],
    topic: [{ name: 'sla' }, { name: 'retention' }],
    dashboard: [{ name: 'refresh_rate' }],
  };

  it('returns only the selected entity types, prefixed, without duplicates', () => {
    expect(
      getCustomPropertyFieldNames(propertiesByType, ['table', 'topic'])
    ).toEqual(['extension.owner_team', 'extension.sla', 'extension.retention']);
  });

  it('skips a selected entity type that has no custom properties', () => {
    expect(getCustomPropertyFieldNames(propertiesByType, ['glossary'])).toEqual(
      []
    );
  });
});

describe('WorkflowConfigUtils.getFieldDisplayLabel', () => {
  it('shows a standard field by its bare name', () => {
    expect(getFieldDisplayLabel('description')).toBe('description');
  });

  it('marks a custom property distinctly from a same-named standard field', () => {
    const custom = getFieldDisplayLabel('extension.HyperLinkTest');

    expect(custom).toContain('HyperLinkTest');
    expect(custom).not.toBe('HyperLinkTest');
  });
});

describe('WorkflowConfigUtils.buildFieldOptions', () => {
  it('prefixes custom-property names with extension. so workflow nodes can resolve them', () => {
    const fields = [
      { name: 'description' },
      { name: 'HyperLinkTest' },
      { name: 'Department' },
    ];
    const customPropertyNames = new Set(['HyperLinkTest', 'Department']);

    const options = buildFieldOptions(fields, customPropertyNames);

    expect(options).toContain('extension.HyperLinkTest');
    expect(options).toContain('extension.Department');
    // A custom property must never leak out as a bare name.
    expect(options).not.toContain('HyperLinkTest');
    expect(options).not.toContain('Department');
  });

  it('leaves standard fields unprefixed', () => {
    const fields = [{ name: 'description' }, { name: 'owners' }];

    const options = buildFieldOptions(fields, new Set());

    expect(options).toEqual(['description', 'owners']);
  });

  it('keeps standard and custom fields in one list, prefixing only the custom ones', () => {
    const fields = [{ name: 'description' }, { name: 'HyperLinkTest' }];

    const options = buildFieldOptions(fields, new Set(['HyperLinkTest']));

    expect(options).toEqual(['description', 'extension.HyperLinkTest']);
  });

  it('de-duplicates field options', () => {
    const fields = [
      { name: 'description' },
      { name: 'description' },
      { name: 'HyperLinkTest' },
      { name: 'HyperLinkTest' },
    ];

    const options = buildFieldOptions(fields, new Set(['HyperLinkTest']));

    expect(options).toEqual(['description', 'extension.HyperLinkTest']);
  });

  it('applies the extension prefix after the exclude filter so the custom property is not dropped', () => {
    // filterExcludeFields drops names containing "." (other than column./columns.),
    // so the prefix must be added afterwards.
    const fields = [
      { name: 'HyperLinkTest' },
      { name: 'someInternal.nested' },
      { name: 'columns.description' },
    ];

    const options = buildFieldOptions(fields, new Set(['HyperLinkTest']));

    expect(options).toContain('extension.HyperLinkTest');
    expect(options).toContain('columns.description');
    expect(options).not.toContain('someInternal.nested');
  });

  it('ignores fields without a name', () => {
    const fields = [{ name: undefined }, {}, { name: 'description' }];

    const options = buildFieldOptions(fields, new Set());

    expect(options).toEqual(['description']);
  });
});

describe('buildEntityFieldGroups', () => {
  const entitySpecific = {
    table: ['columns', 'tableType', 'sourceUrl'],
    dashboardDataModel: ['columns', 'sql'],
    pipeline: ['tasks', 'sourceUrl'],
  };

  it('groups every field under its type when a single type is selected', () => {
    expect(buildEntityFieldGroups(entitySpecific, ['table'])).toEqual({
      columns: 'table',
      tableType: 'table',
      sourceUrl: 'table',
    });
  });

  it('leaves fields shared by several selected types ungrouped', () => {
    const groups = buildEntityFieldGroups(entitySpecific, [
      'table',
      'dashboardDataModel',
      'pipeline',
    ]);

    expect(groups).toEqual({
      tableType: 'table',
      sql: 'dashboardDataModel',
      tasks: 'pipeline',
    });
  });

  it('judges sharing against the selected types only', () => {
    expect(
      buildEntityFieldGroups(entitySpecific, ['table', 'pipeline'])
    ).toEqual({
      columns: 'table',
      tableType: 'table',
      tasks: 'pipeline',
    });
  });

  it('ignores selected types missing from the registry', () => {
    expect(buildEntityFieldGroups(entitySpecific, ['unknownType'])).toEqual({});
  });
});
