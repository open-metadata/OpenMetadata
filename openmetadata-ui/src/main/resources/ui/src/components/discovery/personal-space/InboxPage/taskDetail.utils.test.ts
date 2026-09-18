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

  it('lists the proposed and current owners for an ownership task', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        type: TaskType.OwnershipUpdate,
        payload: {
          newOwners: [{ id: 'u2', name: 'bob' }],
          currentOwners: [{ id: 'u3', name: 'carol' }],
          reason: 'The previous owner left.',
        },
      } as unknown as Partial<Task>),
      t
    );

    expect(rowKeys(descriptor.rows)).toEqual(
      expect.arrayContaining(['newOwners', 'currentOwners'])
    );
    expect(descriptor.callout?.text).toBe('The previous owner left.');
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
      ownerCount: undefined,
      updatedAt: undefined,
    });
  });
});
