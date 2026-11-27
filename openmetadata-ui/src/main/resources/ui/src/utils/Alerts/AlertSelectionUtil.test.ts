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
  getAlertSourceChanges,
  getSelectionSupport,
  getSourceKindLabel,
  getSourceOptions,
  groupSourcesByKind,
  shouldShowRuleSection,
} from './AlertSelectionUtil';

jest.mock('../EntityNameUtils', () => ({
  getEntityNameLabel: jest.fn().mockImplementation((name: string) => name),
}));

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
  it('knows nothing about the selected sources until the server has answered', () => {
    expect(getSelectionSupport(['table'])).toEqual({});
  });

  // An answer for an empty form usually arrives before a saved alert has loaded.
  it('never takes the answer for no sources as the answer for the selected ones', () => {
    expect(getSelectionSupport(['table'], TABLE_AND_TOPIC, [])).toEqual({});
  });

  // The save may reject what the answer for other sources lists, so none of it is offered.
  it('keeps the sections of the answer for another selection, but offers none of its rules', () => {
    const support = getSelectionSupport(['table'], TABLE_AND_TOPIC, [
      'table',
      'topic',
    ]);

    expect(support).toEqual({ hasFilters: true, hasTriggers: true });
  });

  it('takes an answer for the same sources in another order as the answer for them', () => {
    const support = getSelectionSupport(['topic', 'table'], TABLE_AND_TOPIC, [
      'table',
      'topic',
    ]);

    expect(support.supportedFilters).toEqual([{ name: 'filterByOwner' }]);
  });

  it('answers nothing selected with nothing', () => {
    expect(
      getSelectionSupport([], TABLE_AND_TOPIC, []).supportedFilters
    ).toBeUndefined();
  });

  it('answers from what the server said, and labels triggers when there are several sources', () => {
    const support = getSelectionSupport(['table', 'topic'], TABLE_AND_TOPIC, [
      'table',
      'topic',
    ]);

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
    const support = getSelectionSupport(['table'], TABLE_AND_TOPIC, ['table']);

    expect(support.supportedTriggers?.[0].displayName).toBe('Schema changed');
  });

  // The recipients are the server's to say, before any source is chosen as after.
  it('says who alerts can be sent to only as the server said it', () => {
    const offered = {
      ...TABLE_AND_TOPIC,
      recipientCategories: ['Owners', 'Followers'],
    } as AlertCapabilities;

    expect(getSelectionSupport([], offered, []).recipientCategories).toEqual([
      'Owners',
      'Followers',
    ]);
    expect(
      getSelectionSupport(['table'], offered, ['table']).recipientCategories
    ).toEqual(['Owners', 'Followers']);
    expect(getSelectionSupport(['table']).recipientCategories).toBeUndefined();
  });
});

describe('shouldShowRuleSection', () => {
  it('shows an empty section while no source is chosen', () => {
    expect(shouldShowRuleSection([], undefined, [])).toBe(true);
  });

  it('follows what the sources support once the server has said it', () => {
    expect(shouldShowRuleSection(['table'], true, [])).toBe(true);
    expect(shouldShowRuleSection(['table'], false, [{ name: 'f' }])).toBe(
      false
    );
  });

  it('keeps the rules an alert holds while what its sources support is unknown', () => {
    expect(shouldShowRuleSection(['table'], undefined, [{ name: 'f' }])).toBe(
      true
    );
    expect(shouldShowRuleSection(['table'], undefined, [])).toBe(false);
  });
});

describe('getSourceOptions', () => {
  const EVERY_SOURCE = {
    ...TABLE_AND_TOPIC,
    sources: [
      { name: 'all', kind: 'all' },
      { name: 'table', kind: 'entity' },
      { name: 'topic', kind: 'entity' },
      { name: 'conversation', kind: 'activity' },
    ],
  } as unknown as AlertCapabilities;

  it('lists every source the server lists, in its order', () => {
    expect(getSourceOptions([], EVERY_SOURCE).map((o) => o.name)).toEqual([
      'all',
      'table',
      'topic',
      'conversation',
    ]);
  });

  it('offers the sources it last listed when the latest answer failed', () => {
    const options = getSourceOptions(['table'], undefined, [
      { name: 'table', kind: 'entity' },
      { name: 'topic', kind: 'entity' },
    ] as AlertCapabilities['sources']);

    expect(options.map((o) => o.name)).toEqual(['table', 'topic']);
    expect(options.every((option) => !option.disabled)).toBe(true);
  });

  it('offers nothing before the server has listed anything', () => {
    expect(getSourceOptions([])).toEqual([]);
  });

  it('uses what the server said about the selection', () => {
    const options = getSourceOptions(['table', 'topic'], TABLE_AND_TOPIC);

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

describe('getAlertSourceChanges', () => {
  it('starts the filters over but keeps the destinations when a source is added', () => {
    expect(getAlertSourceChanges(['table', 'topic'], ['table'])).toEqual({
      resources: ['table', 'topic'],
      input: {},
    });
  });

  it('starts the destinations over when a source is removed or replaced', () => {
    expect(getAlertSourceChanges(['topic'], ['table', 'topic'])).toEqual({
      resources: ['topic'],
      input: {},
      destinations: [],
    });
    expect(getAlertSourceChanges(['dashboard'], ['table'])).toEqual({
      resources: ['dashboard'],
      input: {},
      destinations: [],
    });
  });

  it('keeps rules stored without selections listed when sources change', () => {
    expect(getAlertSourceChanges(['topic'], ['table'], true)).toEqual({
      resources: ['topic'],
      destinations: [],
    });
  });
});
