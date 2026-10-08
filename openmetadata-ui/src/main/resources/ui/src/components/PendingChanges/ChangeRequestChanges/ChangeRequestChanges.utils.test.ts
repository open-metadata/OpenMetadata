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
import {
  MutationOp,
  MutationOpType,
} from '../../../generated/governance/changeRequest/changeRequest';
import {
  buildChangeSections,
  ChangeKind,
  countChangedFields,
  countChanges,
} from './ChangeRequestChanges.utils';

jest.mock('../../../utils/RouterUtils', () => ({
  getClassificationTagPath: (fqn: string) => `/tags/${fqn}`,
  getGlossaryTermDetailsPath: (fqn: string) => `/glossary/${fqn}`,
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: (type: string, fqn: string) => `/${type}/${fqn}`,
  },
}));

const tag = (tagFQN: string, source = 'Classification') => ({
  tagFQN,
  name: tagFQN.split('.').pop(),
  source,
  labelType: 'Manual',
  state: 'Confirmed',
});

const op = (
  type: MutationOpType,
  field: string,
  value?: unknown,
  baseValue?: unknown
): MutationOp =>
  ({
    op: type,
    field,
    value: value === undefined ? undefined : JSON.stringify(value),
    baseValue: baseValue === undefined ? undefined : JSON.stringify(baseValue),
    gated: true,
  } as MutationOp);

describe('buildChangeSections', () => {
  it('names tags by FQN, links them, and reads two adds as one row', () => {
    const [asset] = buildChangeSections([
      op(MutationOpType.Add, 'tags', tag('PII.Sensitive')),
      op(MutationOpType.Add, 'tags', tag('Glossary.Term', 'Glossary')),
    ]);

    expect(asset.entries).toEqual([
      {
        field: 'tags',
        kind: ChangeKind.Added,
        previous: [],
        values: [
          { text: 'PII.Sensitive', link: '/tags/PII.Sensitive' },
          { text: 'Glossary.Term', link: '/glossary/Glossary.Term' },
        ],
      },
    ]);
  });

  it('shows an update with its previous value as plain text', () => {
    const [asset] = buildChangeSections([
      op(MutationOpType.Set, 'description', '<p>New</p>', '<p>Old</p>'),
    ]);

    expect(asset.entries).toEqual([
      {
        field: 'description',
        kind: ChangeKind.Updated,
        values: [{ text: 'New' }],
        previous: [{ text: 'Old' }],
      },
    ]);
  });

  it('reads a value set on an empty field as added and a cleared one as removed', () => {
    const [asset] = buildChangeSections([
      op(MutationOpType.Set, 'displayName', 'Shown', null),
      op(MutationOpType.Set, 'retentionPeriod', null, 'P30D'),
    ]);

    expect(asset.entries.map((e) => [e.field, e.kind])).toEqual([
      ['displayName', ChangeKind.Added],
      ['retentionPeriod', ChangeKind.Removed],
    ]);
  });

  it('lists only the columns that changed, field by field', () => {
    const before = [
      { name: 'id', dataTypeDisplay: 'varchar(36)', tags: [] },
      { name: 'name', dataTypeDisplay: 'varchar(256)', tags: [] },
      { name: 'json', dataTypeDisplay: 'json', tags: [] },
    ];
    const after = [
      {
        name: 'id',
        dataTypeDisplay: 'varchar(36)',
        description: 'Primary key',
        tags: [],
      },
      {
        name: 'name',
        dataTypeDisplay: 'varchar(256)',
        tags: [tag('PII.Sensitive')],
      },
      { name: 'json', dataTypeDisplay: 'json', tags: [] },
    ];

    const sections = buildChangeSections([
      op(MutationOpType.Set, 'columns', after, before),
    ]);

    expect(sections).toEqual([
      {
        column: 'id',
        entries: [
          {
            field: 'description',
            kind: ChangeKind.Added,
            values: [{ text: 'Primary key' }],
            previous: [],
          },
        ],
      },
      {
        column: 'name',
        entries: [
          {
            field: 'tags',
            kind: ChangeKind.Added,
            values: [{ text: 'PII.Sensitive', link: '/tags/PII.Sensitive' }],
            previous: [],
          },
        ],
      },
    ]);
  });

  it('reports added and removed columns, and nested columns by their path', () => {
    const before = [
      { name: 'gone', tags: [] },
      { name: 'address', tags: [], children: [{ name: 'city', tags: [] }] },
    ];
    const after = [
      { name: 'fresh', tags: [] },
      {
        name: 'address',
        tags: [],
        children: [{ name: 'city', description: 'City name', tags: [] }],
      },
    ];

    const [asset, nested] = buildChangeSections([
      op(MutationOpType.Set, 'columns', after, before),
    ]);

    expect(asset.entries.map((e) => [e.field, e.kind, e.values])).toEqual([
      ['columns', ChangeKind.Added, [{ text: 'fresh' }]],
      ['columns', ChangeKind.Removed, [{ text: 'gone' }]],
    ]);
    expect(nested.column).toBe('address.city');
  });

  it('shows a replaced list of references as what it gained and lost', () => {
    const [asset] = buildChangeSections([
      op(
        MutationOpType.Set,
        'owners',
        [{ type: 'user', name: 'karan', fullyQualifiedName: 'karan' }],
        [{ type: 'user', name: 'ram', fullyQualifiedName: 'ram' }]
      ),
    ]);

    expect(asset.entries).toEqual([
      {
        field: 'owners',
        kind: ChangeKind.Added,
        values: [{ text: 'karan', link: '/user/karan' }],
        previous: [],
      },
      {
        field: 'owners',
        kind: ChangeKind.Removed,
        values: [{ text: 'ram', link: '/user/ram' }],
        previous: [],
      },
    ]);
  });
});

describe('change counts', () => {
  const ops = [
    op(
      MutationOpType.Set,
      'owners',
      [{ type: 'user', name: 'karan', fullyQualifiedName: 'karan' }],
      [{ type: 'user', name: 'admin', fullyQualifiedName: 'admin' }]
    ),
    op(MutationOpType.Add, 'tags', tag('PII.NonSensitive')),
    op(MutationOpType.Set, 'description', 'New', 'Old'),
  ];

  it('counts each changed field once', () => {
    expect(countChangedFields(ops)).toBe(3);
    expect(countChangedFields()).toBe(0);
  });

  it('counts every value added, removed or replaced', () => {
    expect(countChanges(ops)).toBe(4);
    expect(countChanges()).toBe(0);
  });
});
