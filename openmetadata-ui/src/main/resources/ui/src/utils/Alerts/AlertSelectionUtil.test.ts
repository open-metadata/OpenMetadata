/*
 *  Copyright 2024 Collate.
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
  AlertCapabilities,
  SourceKind,
} from '../../generated/events/api/alertCapabilities';
import {
  getSelectionSupport,
  getSourceKindLabel,
  getSourceOptions,
  groupSourcesByKind,
  SourceOfTheCatalog,
} from './AlertSelectionUtil';

jest.mock('../EntityNameUtils', () => ({
  getEntityNameLabel: jest.fn().mockImplementation((name: string) => name),
}));

const CATALOG = [
  {
    name: 'table',
    containerEntities: ['databaseService'],
    supportedFilters: [{ name: 'filterByOwner' }, { name: 'filterByFqn' }],
    supportedActions: [{ name: 'GetTableSchemaChanges' }],
  },
  { name: 'topic', supportedFilters: [{ name: 'filterByOwner' }] },
] as SourceOfTheCatalog[];

const TABLE_AND_TOPIC = {
  alertType: 'Observability',
  filters: [
    { condition: { name: 'filterByOwner' }, sources: ['table', 'topic'] },
  ],
  triggers: [
    {
      condition: {
        name: 'GetTableSchemaChanges',
        displayName: 'Schema changed',
      },
      sources: ['table'],
    },
  ],
  containerEntities: ['databaseService', 'messagingService'],
  eventTypes: ['entityCreated'],
  sources: [
    { name: 'table', kind: 'entity', selected: true },
    {
      name: 'topic',
      kind: 'entity',
      selected: true,
      warning: 'No chosen trigger applies to this source.',
    },
    {
      name: 'conversation',
      kind: 'activity',
      canJoin: false,
      reason: 'Sources of different kinds cannot be combined.',
    },
  ],
} as unknown as AlertCapabilities;

describe('getSelectionSupport', () => {
  it('answers from the catalog until the server has answered', () => {
    const support = getSelectionSupport(CATALOG, ['table']);

    expect(support.supportedFilters).toEqual(CATALOG[0].supportedFilters);
    expect(support.supportedTriggers).toEqual(CATALOG[0].supportedActions);
    expect(support.containerEntities).toEqual(['databaseService']);
  });

  it('answers nothing selected with nothing', () => {
    expect(getSelectionSupport(CATALOG, []).supportedFilters).toBeUndefined();
  });

  it('answers from what the server said, and labels triggers when there are several sources', () => {
    const support = getSelectionSupport(
      CATALOG,
      ['table', 'topic'],
      TABLE_AND_TOPIC
    );

    expect(support.supportedFilters).toEqual([{ name: 'filterByOwner' }]);
    expect(support.supportedTriggers?.[0].displayName).toBe(
      'Schema changed (table)'
    );
    expect(support.containerEntities).toEqual([
      'databaseService',
      'messagingService',
    ]);
    expect(support.supportedEventTypes).toEqual(['entityCreated']);
  });

  it('does not label triggers for one source', () => {
    const support = getSelectionSupport(CATALOG, ['table'], TABLE_AND_TOPIC);

    expect(support.supportedTriggers?.[0].displayName).toBe('Schema changed');
  });

  // The recipients are the server's to say, before any source is chosen as after.
  it('says who alerts can be sent to only as the server said it', () => {
    const offered = {
      ...TABLE_AND_TOPIC,
      recipientCategories: ['Owners', 'Followers'],
    } as AlertCapabilities;

    expect(
      getSelectionSupport(CATALOG, [], offered).recipientCategories
    ).toEqual(['Owners', 'Followers']);
    expect(
      getSelectionSupport(CATALOG, ['table'], offered).recipientCategories
    ).toEqual(['Owners', 'Followers']);
    expect(
      getSelectionSupport(CATALOG, ['table']).recipientCategories
    ).toBeUndefined();
  });
});

describe('getSourceOptions', () => {
  const NAMES = ['all', 'table', 'topic', 'conversation'];

  it('offers everything while nothing is selected', () => {
    const options = getSourceOptions(NAMES, []);

    expect(options.every((option) => !option.disabled)).toBe(true);
  });

  it('offers everything until the server has answered about the selection', () => {
    const options = getSourceOptions(NAMES, ['table']);

    expect(options.every((option) => !option.disabled)).toBe(true);
  });

  it('uses what the server said about the selection', () => {
    const options = getSourceOptions(
      NAMES,
      ['table', 'topic'],
      TABLE_AND_TOPIC
    );

    expect(options.find((o) => o.name === 'conversation')?.reason).toBe(
      'Sources of different kinds cannot be combined.'
    );
    expect(options.find((o) => o.name === 'topic')?.warning).toBe(
      'No chosen trigger applies to this source.'
    );
    expect(options.find((o) => o.name === 'topic')?.disabled).toBe(false);
    expect(options.find((o) => o.name === 'conversation')?.kind).toBe(
      'activity'
    );
  });
});

describe('groupSourcesByKind', () => {
  it('groups by the kind the server gives, all events first and collaboration last', () => {
    const groups = groupSourcesByKind([
      { name: 'conversation', kind: SourceKind.Activity },
      { name: 'table', kind: SourceKind.Entity },
      { name: 'all', kind: SourceKind.All },
      { name: 'topic', kind: SourceKind.Entity },
    ]);

    expect(
      groups.map(({ kind, sources }) => [kind, sources.map((s) => s.name)])
    ).toEqual([
      [SourceKind.All, ['all']],
      [SourceKind.Entity, ['table', 'topic']],
      [SourceKind.Activity, ['conversation']],
    ]);
  });

  it('keeps sources whose kind is not known yet in one group with no kind', () => {
    expect(groupSourcesByKind([{ name: 'table' }, { name: 'topic' }])).toEqual([
      { kind: undefined, sources: [{ name: 'table' }, { name: 'topic' }] },
    ]);
  });

  it('names each kind', () => {
    expect(getSourceKindLabel(SourceKind.Entity)).toBe(
      'label.data-asset-plural'
    );
    expect(getSourceKindLabel(SourceKind.Activity)).toBe(
      'label.data-collaboration'
    );
    expect(getSourceKindLabel(SourceKind.All)).toBe('label.all-entity');
  });
});
