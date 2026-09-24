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
  Task,
  TaskCategory,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { EntityUnion } from '../../../Explore/ExplorePage.interface';
import { TaskDetailRow } from './taskDetail.types';
import {
  deriveTaskAboutEntity,
  getTaskDetailDescriptor,
  getTaskTypeBadge,
  resolveIncidentTestCaseFqn,
} from './taskDetail.utils';

// Echo the key so a test asserts which label was chosen, and keep the
// interpolated entity visible for the parameterized keys.
const t = (key: string, options?: Record<string, unknown>) =>
  options?.entity ? `${key}:${options.entity}` : key;

const buildTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: 'task-1',
    status: 'Open',
    createdAt: 100,
    createdBy: { id: 'u1', name: 'alice' },
    type: TaskType.DescriptionUpdate,
    category: TaskCategory.MetadataUpdate,
    ...overrides,
  } as unknown as Task);

const rowKeys = (rows: TaskDetailRow[]) => rows.map((row) => row.key);

describe('getTaskTypeBadge', () => {
  it('gives an incident its own red chip', () => {
    expect(
      getTaskTypeBadge(buildTask({ type: TaskType.TestCaseResolution }), t)
    ).toEqual({ label: 'label.incident', color: 'error', icon: 'incident' });
  });

  it('falls back to a neutral chip for an unmapped type', () => {
    expect(
      getTaskTypeBadge(buildTask({ type: 'SomethingNew' as TaskType }), t)
    ).toEqual({ label: 'label.task', color: 'gray', icon: 'approval' });
  });

  // A type the map does not know still reads as an incident when its category
  // says so, rather than dropping to the generic chip.
  it('falls back by category before going generic', () => {
    expect(
      getTaskTypeBadge(
        buildTask({
          type: 'SomethingNew' as TaskType,
          category: TaskCategory.Incident,
        }),
        t
      ).icon
    ).toBe('incident');
  });
});

describe('resolveIncidentTestCaseFqn', () => {
  it('reads the test case FQN off the incident description', () => {
    expect(
      resolveIncidentTestCaseFqn(
        buildTask({
          category: TaskCategory.Incident,
          description: 'New incident for test case: svc.db.schema.tbl.test',
        })
      )
    ).toBe('svc.db.schema.tbl.test');
  });

  it('returns nothing when the task already names its entity', () => {
    expect(
      resolveIncidentTestCaseFqn(
        buildTask({
          category: TaskCategory.Incident,
          about: { fullyQualifiedName: 'svc.db.tbl' },
          description: 'New incident for test case: svc.db.tbl.test',
        } as unknown as Partial<Task>)
      )
    ).toBe('');
  });

  it('returns nothing for a non-incident task', () => {
    expect(
      resolveIncidentTestCaseFqn(buildTask({ description: 'a b c' }))
    ).toBe('');
  });
});

describe('getTaskDetailDescriptor', () => {
  it('puts a description task proposal in the callout', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        payload: { newDescription: 'The order total in local currency.' },
      } as unknown as Partial<Task>),
      t
    );

    expect(descriptor.callout).toEqual({
      label: 'label.suggested-description',
      text: 'The order total in local currency.',
    });
  });

  it('omits the callout when the payload carries no rationale', () => {
    expect(getTaskDetailDescriptor(buildTask(), t).callout).toBeUndefined();
  });

  // Ownership ships plain: who holds the asset now, and when someone asked.
  it('describes an ownership task by its current holder', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        type: TaskType.OwnershipUpdate,
        payload: {
          currentOwners: [{ id: 'u3', name: 'carol' }],
          reason: 'The previous owner left.',
        },
      } as unknown as Partial<Task>),
      t
    );

    expect(rowKeys(descriptor.rows)).toEqual(['owner', 'createdAt']);
    expect(descriptor.rows[0].value).toEqual({
      kind: 'users',
      refs: [{ id: 'u3', name: 'carol' }],
    });
    expect(descriptor.callout?.text).toBe('The previous owner left.');
  });

  it('says "No owner" when nobody holds the asset', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        type: TaskType.OwnershipUpdate,
        payload: {},
      } as unknown as Partial<Task>),
      t
    );

    expect(descriptor.rows[0].value).toEqual({
      kind: 'text',
      text: 'label.no-owner',
    });
  });

  it('names ownership actions for what they do', () => {
    expect(
      getTaskDetailDescriptor(
        buildTask({
          type: TaskType.OwnershipUpdate,
          payload: {},
        } as unknown as Partial<Task>),
        t
      ).actionLabels
    ).toEqual({
      approve: 'label.assign-entity:label.owner',
      reject: 'label.dismiss',
    });
  });

  it('names the proposed owner on the approve action', () => {
    expect(
      getTaskDetailDescriptor(
        buildTask({
          type: TaskType.OwnershipUpdate,
          payload: { newOwners: [{ id: 'u1', type: 'user', name: 'carol' }] },
        } as unknown as Partial<Task>),
        t
      ).actionLabels?.approve
    ).toBe('label.assign-entity:carol');
  });

  // A plugin that supplies its own rows still gets the inbox's outcome rows.
  it('keeps the outcome rows under a plugin override', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        status: 'Rejected',
        resolution: { resolvedBy: { id: 'u2', name: 'bob' }, resolvedAt: 5 },
      } as unknown as Partial<Task>),
      t,
      {
        rows: [
          {
            key: 'accessType',
            icon: 'shield',
            label: 'x',
            value: { kind: 'text', text: 'Full' },
          },
        ],
      }
    );

    expect(rowKeys(descriptor.rows)).toEqual(
      expect.arrayContaining(['accessType', 'resolvedBy'])
    );
  });

  it('reuses the parameterized label for a tier proposal', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        type: TaskType.TierUpdate,
        payload: { newTier: { tagFQN: 'Tier.Tier1' } },
      } as unknown as Partial<Task>),
      t
    );

    expect(descriptor.rows.find((row) => row.key === 'newTier')?.label).toBe(
      'label.new-entity:label.tier'
    );
  });

  it('describes an unmapped type from its common fields', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        type: 'SomethingNew' as TaskType,
        description: 'Please take a look.',
      }),
      t
    );

    expect(rowKeys(descriptor.rows)).toEqual(['createdBy', 'createdAt']);
    expect(descriptor.callout?.text).toBe('Please take a look.');
  });

  it('adds the outcome rows once the task is closed', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        status: 'Rejected',
        resolution: {
          resolvedBy: { id: 'u2', name: 'bob' },
          resolvedAt: 500,
          comment: 'Not needed.',
        },
      } as unknown as Partial<Task>),
      t
    );

    expect(rowKeys(descriptor.rows)).toEqual(
      expect.arrayContaining(['resolvedBy', 'resolvedOn', 'resolutionComment'])
    );
  });

  it('leaves the outcome rows off an open task', () => {
    expect(rowKeys(getTaskDetailDescriptor(buildTask(), t).rows)).not.toContain(
      'resolvedBy'
    );
  });
});

describe('source row', () => {
  const sourceOf = (task: Task) =>
    getTaskDetailDescriptor(task, t).rows.find((row) => row.key === 'source')
      ?.value;

  it('names the auto-classifier as the source of an agent-proposed tag', () => {
    expect(
      sourceOf(
        buildTask({
          type: TaskType.TagUpdate,
          payload: {
            source: 'Agent',
            tagsToAdd: [{ tagFQN: 'PII.Sensitive' }],
          },
        } as unknown as Partial<Task>)
      )
    ).toEqual({ kind: 'text', text: 'label.auto-classifier' });
  });

  // Outside tagging, an agent is not a classifier.
  it('calls an agent an agent on a description task', () => {
    expect(
      sourceOf(
        buildTask({
          payload: { source: 'Agent', newDescription: 'x' },
        } as unknown as Partial<Task>)
      )
    ).toEqual({ kind: 'text', text: 'label.agent' });
  });

  it('shows an unknown source as it arrived rather than hiding it', () => {
    expect(
      sourceOf(
        buildTask({
          payload: { source: 'SomethingNew', newDescription: 'x' },
        } as unknown as Partial<Task>)
      )
    ).toEqual({ kind: 'text', text: 'SomethingNew' });
  });

  it('omits the row when no source is recorded', () => {
    expect(sourceOf(buildTask())).toBeUndefined();
  });
});

describe('deriveTaskAboutEntity', () => {
  it('counts the columns carrying a PII tag', () => {
    const about = deriveTaskAboutEntity(
      {
        columns: [
          { tags: [{ tagFQN: 'PII.Sensitive' }] },
          { tags: [{ tagFQN: 'Tier.Tier1' }] },
          {},
        ],
      } as unknown as EntityUnion,
      12
    );

    expect(about).toMatchObject({
      columnCount: 3,
      piiColumnCount: 1,
      downstreamCount: 12,
    });
  });

  it('reads the weekly usage count for the queries tile', () => {
    expect(
      deriveTaskAboutEntity({
        usageSummary: { weeklyStats: { count: 9 } },
      } as unknown as EntityUnion)?.weeklyQueryCount
    ).toBe(9);
  });

  it('picks the tier out of the entity tags', () => {
    expect(
      deriveTaskAboutEntity({
        tags: [{ tagFQN: 'PersonalData.Personal' }, { tagFQN: 'Tier.Tier2' }],
      } as unknown as EntityUnion)?.tier?.tagFQN
    ).toBe('Tier.Tier2');
  });

  // An entity type with no fetch handler, or a lineage call that failed, must
  // leave its tiles out rather than reporting a zero it cannot vouch for.
  it('leaves every count undefined when nothing was fetched', () => {
    expect(deriveTaskAboutEntity(undefined, undefined)).toEqual({
      entity: undefined,
      tier: undefined,
      columnCount: undefined,
      piiColumnCount: undefined,
      downstreamCount: undefined,
      weeklyQueryCount: undefined,
      ownerCount: undefined,
      updatedAt: undefined,
    });
  });
});
