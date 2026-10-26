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
  TaskStatus,
  TaskType,
} from '../../../../generated/entity/tasks/task';
import { EntityUnion } from '../../../Explore/ExplorePage.interface';
import { TaskDetailRow } from './taskDetail.types';
import {
  deriveTaskAboutEntity,
  getPlainDescription,
  getProposingAgent,
  getTaskDetailDescriptor,
  getTaskTypeBadge,
  getTaskTypeKey,
  resolveIncidentTestCaseFqn,
  withExistingValues,
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

  it('gives a memory conflict review its own chip', () => {
    expect(
      getTaskTypeBadge(buildTask({ type: TaskType.MemoryConflictReview }), t)
    ).toEqual({
      label: 'label.memory-conflict',
      color: 'orange',
      icon: 'approval',
    });
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
  // A description task reads as an activity card's change: Existing, then
  // Suggested.
  it("shows a description task's proposal beside the existing text", () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        payload: {
          currentDescription: 'Order total.',
          newDescription: 'The order total in local currency.',
        },
      } as unknown as Partial<Task>),
      t
    );

    expect(descriptor.change).toEqual({
      labelKey: 'label.description',
      before: ['Order total.'],
      after: ['The order total in local currency.'],
      isText: true,
    });
    expect(descriptor.callout).toBeUndefined();
  });

  it('has no change when the payload proposes nothing', () => {
    const descriptor = getTaskDetailDescriptor(buildTask(), t);

    expect(descriptor.change).toBeUndefined();
    expect(descriptor.callout).toBeUndefined();
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
      title: 'label.owner-plural',
    });
    expect(descriptor.callout?.text).toBe('The previous owner left.');
  });

  // Approving replaces the current owners, so both sides of the change show.
  it('names the proposed owners beside the current ones', () => {
    const newOwners = [{ id: 'u4', type: 'user', name: 'dana' }];
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        type: TaskType.OwnershipUpdate,
        payload: { currentOwners: [{ id: 'u3', name: 'carol' }], newOwners },
      } as unknown as Partial<Task>),
      t
    );

    expect(rowKeys(descriptor.rows)).toEqual([
      'owner',
      'newOwners',
      'createdAt',
    ]);
    expect(descriptor.rows[1]).toMatchObject({
      label: 'label.new-entity:label.owner-plural',
      value: { kind: 'users', refs: newOwners },
    });
  });

  // Past three people the row collapses into "+N", headed in the plural.
  it('titles the assignees overflow in the plural', () => {
    const assignees = [{ id: 'u1', type: 'user', name: 'ann' }];
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        type: TaskType.TestCaseResolution,
        assignees,
        payload: {},
      } as unknown as Partial<Task>),
      t
    );

    expect(descriptor.rows.find((row) => row.key === 'assignees')).toEqual(
      expect.objectContaining({
        label: 'label.assignee',
        value: {
          kind: 'users',
          refs: assignees,
          title: 'label.assignee-plural',
        },
      })
    );
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
      expect.arrayContaining(['accessType', 'resolvedOn'])
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

  // The callout renders markdown, so the description reaches it as written.
  it('keeps the callout description as written for the renderer', () => {
    const description =
      '**The 02:00 load** timed out; yesterday&#39;s numbers.';
    const descriptor = getTaskDetailDescriptor(
      buildTask({ type: 'SomethingNew' as TaskType, description }),
      t
    );

    expect(descriptor.callout?.text).toBe(description);
  });

  it('leaves out a description with no text in it', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({ type: 'SomethingNew' as TaskType, description: '<p> </p>' }),
      t
    );

    expect(descriptor.callout).toBeUndefined();
  });

  // Who resolved it reads in the byline ("Rejected by bob on …"), not twice.
  it('leaves the resolver out of the rows', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        status: 'Rejected',
        resolution: { resolvedBy: { id: 'u2', name: 'bob' }, resolvedAt: 5 },
      } as unknown as Partial<Task>),
      t
    );

    expect(rowKeys(descriptor.rows)).not.toContain('resolvedBy');
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
      expect.arrayContaining(['resolvedOn', 'resolutionComment'])
    );
  });

  it('leaves the outcome rows off an open task', () => {
    expect(rowKeys(getTaskDetailDescriptor(buildTask(), t).rows)).not.toContain(
      'resolvedOn'
    );
  });
});

describe('tag request change', () => {
  const changeOf = (payload: Record<string, unknown>) =>
    getTaskDetailDescriptor(
      buildTask({
        type: TaskType.TagUpdate,
        payload,
      } as unknown as Partial<Task>),
      t
    ).change;

  // Approving a tag request removes tags as well as adding them.
  it('shows the tags to remove beside the tags to add', () => {
    expect(
      changeOf({
        tagsToAdd: [{ tagFQN: 'PII.Sensitive' }],
        tagsToRemove: [{ tagFQN: 'PII.None' }],
      })
    ).toEqual({
      labelKey: 'label.tag-plural',
      before: ['PII.None'],
      after: ['PII.Sensitive'],
      isText: false,
    });
  });

  it('shows only the added side when nothing is removed', () => {
    expect(changeOf({ tagsToAdd: [{ tagFQN: 'PII.Sensitive' }] })).toEqual(
      expect.objectContaining({ before: [], after: ['PII.Sensitive'] })
    );
  });

  it('has no change when the request names no tags', () => {
    expect(changeOf({})).toBeUndefined();
  });
});

describe('withExistingValues for a tag task', () => {
  const change = {
    labelKey: 'label.tag-plural',
    before: ['PII.None'],
    after: ['PII.Sensitive'],
    isText: false,
  };
  const tagTask = (payload: Record<string, unknown>) =>
    buildTask({
      type: TaskType.TagUpdate,
      payload,
    } as unknown as Partial<Task>);
  const entity = {
    tags: [{ tagFQN: 'Tier.Tier1' }],
    columns: [
      {
        name: 'email',
        tags: [{ tagFQN: 'PII.Email' }, { tagFQN: 'PII.None' }],
      },
    ],
  } as unknown as EntityUnion;

  // The column's current tags, less the one the task removes.
  it("keeps the column's other tags on both sides", () => {
    expect(
      withExistingValues(
        change,
        tagTask({ fieldPath: 'columns.email' }),
        entity
      )?.unchanged
    ).toEqual(['PII.Email']);
  });

  it('keeps no tags for a field path it cannot resolve', () => {
    expect(
      withExistingValues(
        change,
        tagTask({ fieldPath: 'messageSchema.schemaFields.order_id' }),
        entity
      )?.unchanged
    ).toEqual([]);
  });

  it("reads the asset's own tags for a table-level task", () => {
    expect(withExistingValues(change, tagTask({}), entity)?.unchanged).toEqual([
      'Tier.Tier1',
    ]);
  });

  // An empty currentTags is the payload's default, not a snapshot.
  it('reads the asset when the payload carries an empty currentTags', () => {
    expect(
      withExistingValues(
        change,
        tagTask({ fieldPath: 'columns.email', currentTags: [] }),
        entity
      )?.unchanged
    ).toEqual(['PII.Email']);
  });

  it("prefers the payload's snapshot of the current tags", () => {
    expect(
      withExistingValues(
        change,
        tagTask({
          fieldPath: 'columns.email',
          currentTags: [{ tagFQN: 'PersonalData.Personal' }],
        }),
        entity
      )?.unchanged
    ).toEqual(['PersonalData.Personal']);
  });
});

describe('withExistingValues', () => {
  const change = {
    labelKey: 'label.description',
    before: [],
    after: ['Suggested'],
    isText: true,
  };
  const taskFor = (fieldPath: string) =>
    buildTask({
      payload: { fieldPath, newDescription: 'Suggested' },
    } as unknown as Partial<Task>);
  const entity = {
    description: 'The table.',
    columns: [
      { name: 'country', description: 'Country.' },
      { name: 'order.total', description: 'Order total.' },
      {
        name: 'address',
        children: [{ name: 'city', description: 'City.' }],
      },
    ],
  } as unknown as EntityUnion;

  it.each([
    ['description', 'The table.'],
    ['columns.country.description', 'Country.'],
    ['columns.address.city.description', 'City.'],
    ['columns.city.description', 'City.'],
    ['columns."order.total".description', 'Order total.'],
  ])('reads the existing text of %s from the entity', (fieldPath, existing) => {
    expect(
      withExistingValues(change, taskFor(fieldPath), entity)?.before
    ).toEqual([existing]);
  });

  it("keeps the payload's own snapshot", () => {
    expect(
      withExistingValues(
        { ...change, before: ['Snapshot.'] },
        taskFor('description'),
        entity
      )?.before
    ).toEqual(['Snapshot.']);
  });

  // A path naming a field this cannot resolve, such as a topic's schema field,
  // shows nothing rather than the entity's own description.
  it.each([
    'messageSchema.schemaFields.order_id.description',
    'dataModel.columns.amount.description',
  ])('leaves the Existing side empty for %s', (fieldPath) => {
    expect(
      withExistingValues(change, taskFor(fieldPath), entity)?.before
    ).toEqual([]);
  });

  it('leaves the Existing side empty for a field the entity lacks', () => {
    expect(
      withExistingValues(change, taskFor('columns.gone.description'), entity)
        ?.before
    ).toEqual([]);
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

  // PII.NonSensitive and PII.None classify a column as safe; they share the
  // prefix but must not count.
  it('counts only columns tagged PII.Sensitive', () => {
    expect(
      deriveTaskAboutEntity({
        columns: [
          { tags: [{ tagFQN: 'PII.Sensitive' }] },
          { tags: [{ tagFQN: 'PII.NonSensitive' }] },
          { tags: [{ tagFQN: 'PII.None' }] },
        ],
      } as unknown as EntityUnion).piiColumnCount
    ).toBe(1);
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

describe('getPlainDescription', () => {
  it('strips tags and decodes entities', () => {
    expect(
      getPlainDescription({
        description:
          '<p>It&#39;s <strong>late</strong> &amp; &lt;empty&gt;</p>',
      })
    ).toBe("It's late & <empty>");
  });

  // textContent alone would read "Need access for Q3.Owner approved."
  it('puts each paragraph and line break on its own line', () => {
    expect(
      getPlainDescription({
        description:
          '<p>Need access for Q3.</p><p>Owner approved.</p>line one<br>line two',
      })
    ).toBe('Need access for Q3.\nOwner approved.\nline one\nline two');
  });

  it('lists items on their own lines and drops blank ones', () => {
    expect(
      getPlainDescription({
        description: '<ul><li><p>first</p></li><li>second</li></ul><p> </p>',
      })
    ).toBe('first\nsecond');
  });

  it('keeps an encoded tag as text rather than markup', () => {
    expect(
      getPlainDescription({ description: '&lt;img src=x onerror=alert(1)&gt;' })
    ).toBe('<img src=x onerror=alert(1)>');
  });

  it('is empty for a missing or blank description', () => {
    expect(getPlainDescription({})).toBe('');
    expect(getPlainDescription({ description: '  ' })).toBe('');
  });
});

describe('metadata completion tasks', () => {
  const task = buildTask({
    type: TaskType.MetadataCompletion,
    payload: {
      workflow: 'DomainLifecycle',
      node: 'Collect0',
      stage: 'Draft',
      targetStage: 'In Review',
      missingFields: ['experts', 'extension.costCenter'],
    },
  });

  it('gives a metadata completion task its own chip', () => {
    expect(getTaskTypeBadge(task, t)).toEqual({
      label: 'label.missing-metadata',
      color: 'warning',
      icon: 'description',
    });
  });

  it('lists the missing fields by name and says which stage they unlock', () => {
    const descriptor = getTaskDetailDescriptor(task, t);

    expect(
      descriptor.rows.find((row) => row.key === 'missingFields')?.value
    ).toEqual({
      kind: 'list',
      items: [{ label: 'label.expert-plural' }, { label: 'costCenter' }],
      title: 'label.missing-field-plural',
    });
    expect(descriptor.callout?.text).toBe('message.metadata-completion-move');
    expect(
      descriptor.rows.find((row) => row.key === 'conditions')
    ).toBeUndefined();
  });

  it('reports unmet lifecycle conditions with one generic row', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        type: TaskType.MetadataCompletion,
        payload: { stage: 'Draft', missingFields: [], conditionsMet: false },
      }),
      t
    );

    expect(
      descriptor.rows.find((row) => row.key === 'missingFields')
    ).toBeUndefined();
    expect(
      descriptor.rows.find((row) => row.key === 'conditions')?.value
    ).toEqual({ kind: 'text', text: 'message.lifecycle-conditions-not-met' });
  });

  it('lists nothing outstanding once the task has closed', () => {
    const descriptor = getTaskDetailDescriptor(
      buildTask({
        type: TaskType.MetadataCompletion,
        status: TaskStatus.Completed,
        payload: {
          stage: 'Draft',
          missingFields: ['experts'],
          conditionsMet: false,
        },
      }),
      t
    );

    expect(
      descriptor.rows.filter((row) =>
        ['missingFields', 'conditions'].includes(row.key)
      )
    ).toEqual([]);
  });

  it('reads a revise and resubmit task as its own kind, with the reviewer comment', () => {
    const revision = buildTask({
      type: TaskType.MetadataCompletion,
      payload: {
        stage: 'In Review',
        missingFields: [],
        revision: { comment: 'Name a business owner', requestedBy: 'karan' },
      },
    });
    const descriptor = getTaskDetailDescriptor(revision, t);

    expect(getTaskTypeBadge(revision, t)).toEqual({
      label: 'label.revise-and-resubmit',
      color: 'warning',
      icon: 'approval',
    });
    expect(getTaskTypeKey(revision)).not.toBe(getTaskTypeKey(task));
    expect(descriptor.callout?.text).toBe(
      'message.metadata-completion-revision'
    );
    expect(
      descriptor.rows.find((row) => row.key === 'revisionComment')?.value
    ).toEqual({ kind: 'text', text: 'Name a business owner' });
    expect(
      descriptor.rows.find((row) => row.key === 'revisionRequestedBy')?.value
    ).toEqual({ kind: 'text', text: 'karan' });
  });
});

describe('getProposingAgent', () => {
  const approval = (payload: unknown) =>
    buildTask({
      type: TaskType.RequestApproval,
      category: TaskCategory.Approval,
      createdBy: { id: 'bot', name: 'aiautomationapplicationbot' },
      payload,
    } as Partial<Task>);

  it('names the agent that proposed the term, in place of its bot', () => {
    const task = approval({
      proposal: { provider: 'automation', agent: 'Glossary Agent' },
    });

    expect(getProposingAgent(task, t)).toBe('Glossary Agent');
    expect(
      getTaskDetailDescriptor(task, t).rows.find(
        (row) => row.key === 'createdBy'
      )?.value
    ).toEqual({ kind: 'agent', name: 'Glossary Agent' });
  });

  it('falls back to a generic agent when the proposal names none', () => {
    expect(
      getProposingAgent(approval({ proposal: { provider: 'automation' } }), t)
    ).toBe('label.ai-agent');
  });

  it('keeps the person who opened any other task', () => {
    const task = approval({ glossaryTerm: { id: 'g1', type: 'glossaryTerm' } });

    expect(getProposingAgent(task, t)).toBeUndefined();
    expect(
      getTaskDetailDescriptor(task, t).rows.find(
        (row) => row.key === 'createdBy'
      )?.value
    ).toEqual(expect.objectContaining({ kind: 'users' }));
  });
});
