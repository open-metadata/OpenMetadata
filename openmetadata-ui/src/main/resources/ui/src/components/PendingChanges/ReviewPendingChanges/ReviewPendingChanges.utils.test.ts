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
  Decision as ChangeDecisionType,
  ResolutionType,
} from '../../../generated/api/tasks/resolveTask';
import {
  ApprovalDecision,
  DecisionType,
} from '../../../generated/governance/changeRequest/approvalDecision';
import {
  ChangeOutcome,
  ChangeRequest,
  MutationOpType,
} from '../../../generated/governance/changeRequest/changeRequest';
import {
  buildResolutions,
  elementChanges,
  groupSuggestions,
  incompleteRequests,
  isCompeting,
  listCounts,
  suggestionId,
  valueText,
  Verdict,
  voteOn,
  votesOf,
  wordDiff,
} from './ReviewPendingChanges.utils';

const DESCRIPTION = {
  op: MutationOpType.Set,
  field: 'description',
  baseValue: '"published"',
  value: '"new text"',
};
const TAG = {
  op: MutationOpType.Add,
  field: 'tags',
  key: 'PII.Sensitive',
  value: '{"tagFQN":"PII.Sensitive"}',
};
const REMOVED_TAG = {
  op: MutationOpType.Remove,
  field: 'tags',
  key: 'PII.NonSensitive',
  value: '{"tagFQN":"PII.NonSensitive"}',
};

const request = (
  id: string,
  partialDecisions: boolean,
  ops = [DESCRIPTION, TAG]
): ChangeRequest =>
  ({
    id,
    taskId: `task-${id}`,
    requestedBy: `user-${id}`,
    activeRevisionNumber: 2,
    reviewPolicy: { partialDecisions },
    activeRevision: { ops },
  } as unknown as ChangeRequest);

describe('ReviewPendingChanges utils', () => {
  it('resolves each request once with the changes decided on it', () => {
    const a = request('a', true);
    const b = request('b', true);
    const resolutions = buildResolutions([a, b], {
      [suggestionId(a, 'tags')]: Verdict.Accepted,
      [suggestionId(a, 'description')]: Verdict.Rejected,
      [suggestionId(b, 'tags')]: Verdict.Rejected,
    });

    expect(resolutions).toEqual([
      {
        request: a,
        taskId: 'task-a',
        body: {
          resolutionType: ResolutionType.Approved,
          changeRequestRevision: 2,
          changeDecisions: [
            {
              field: 'description',
              key: undefined,
              decision: ChangeDecisionType.Reject,
            },
            {
              field: 'tags',
              key: 'PII.Sensitive',
              decision: ChangeDecisionType.Approve,
            },
          ],
        },
      },
      {
        request: b,
        taskId: 'task-b',
        body: {
          resolutionType: ResolutionType.Rejected,
          changeRequestRevision: 2,
          changeDecisions: [
            {
              field: 'tags',
              key: 'PII.Sensitive',
              decision: ChangeDecisionType.Reject,
            },
          ],
        },
      },
    ]);
  });

  it('leaves superseded and already decided changes out of the resolve call', () => {
    const decidedTag = { ...TAG, outcome: ChangeOutcome.Applied };
    const a = request('a', true, [DESCRIPTION, decidedTag]);

    expect(
      buildResolutions([a], {
        [suggestionId(a, 'description')]: Verdict.Superseded,
        [suggestionId(a, 'tags')]: Verdict.Accepted,
      })
    ).toEqual([]);
  });

  it('holds back a request whose approval step needs every change decided', () => {
    const whole = request('a', false);
    const partial = request('b', true);
    const verdicts = {
      [suggestionId(whole, 'tags')]: Verdict.Accepted,
      [suggestionId(partial, 'tags')]: Verdict.Accepted,
    };

    expect(incompleteRequests([whole, partial], verdicts)).toEqual([whole]);
    expect(
      incompleteRequests([whole], {
        ...verdicts,
        [suggestionId(whole, 'description')]: Verdict.Rejected,
      })
    ).toEqual([]);
  });

  it('flags two open text edits of one field as competing', () => {
    const groups = groupSuggestions([request('a', true), request('b', true)]);
    const description = groups.find((group) => group.field === 'description');
    const tags = groups.find((group) => group.field === 'tags');

    expect(description?.current).toBe('published');
    expect(description && isCompeting(description)).toBe(true);
    expect(tags && isCompeting(tags)).toBe(false);
  });

  it('offers only the changes still under review', () => {
    const appliedTag = { ...TAG, outcome: ChangeOutcome.Applied };
    const groups = groupSuggestions([
      request('a', true, [DESCRIPTION, appliedTag, REMOVED_TAG]),
    ]);
    const tags = groups.find((group) => group.field === 'tags');

    expect(groups.map((group) => group.field)).toEqual(['description', 'tags']);
    expect(tags?.suggestions[0].ops).toEqual([REMOVED_TAG]);
    expect(groupSuggestions([request('b', true, [appliedTag])])).toEqual([]);
  });

  it('compares descriptions by their words, not their markup', () => {
    const html = {
      ...DESCRIPTION,
      baseValue: JSON.stringify('<p>Old&nbsp;text</p>'),
      value: JSON.stringify('<p>Old text updated</p>'),
    };
    const [group] = groupSuggestions([request('a', true, [html])]);

    expect(group.current).toBe('Old text');
    expect(valueText(html.value)).toBe('Old text updated');
  });

  it("reads the user's earlier votes on the active revision only", () => {
    const a = request('a', true);
    const decision = (by: string, revisionNumber: number, lists: object) =>
      ({
        decidedBy: by,
        revisionNumber,
        decision: DecisionType.Approve,
        ...lists,
      } as unknown as ApprovalDecision);
    const votes = votesOf(
      a,
      [
        decision('karan', 2, { approvedChanges: [{ field: 'description' }] }),
        decision('karan', 1, {
          rejectedChanges: [{ field: 'tags', key: 'PII.Sensitive' }],
        }),
        decision('sonika', 2, {
          rejectedChanges: [{ field: 'tags', key: 'PII.Sensitive' }],
        }),
      ],
      'karan'
    );

    const [description, tags] = groupSuggestions([a]).map(
      (group) => group.suggestions[0]
    );

    expect(voteOn(votes, description)).toBe(Verdict.Accepted);
    expect(voteOn(votes, tags)).toBeUndefined();
    expect(voteOn(votesOf(a, [decision('karan', 2, {})], 'karan'), tags)).toBe(
      Verdict.Accepted
    );
  });

  it('lists one suggestion per request on a field, deciding all of its changes together', () => {
    const a = request('a', true, [DESCRIPTION, TAG, REMOVED_TAG]);
    const tags = groupSuggestions([a]).find((group) => group.field === 'tags');
    const [suggestion] = tags?.suggestions ?? [];

    expect(tags?.suggestions).toHaveLength(1);
    expect(suggestion && listCounts(suggestion)).toEqual({
      added: 1,
      removed: 1,
    });
    expect(
      buildResolutions([a], { [suggestionId(a, 'tags')]: Verdict.Rejected })[0]
        .body.changeDecisions
    ).toEqual([
      {
        field: 'tags',
        key: 'PII.Sensitive',
        decision: ChangeDecisionType.Reject,
      },
      {
        field: 'tags',
        key: 'PII.NonSensitive',
        decision: ChangeDecisionType.Reject,
      },
    ]);
  });

  it('shows the columns whose descriptions a request changes, and how', () => {
    const columns = (amount: string, id: string) =>
      JSON.stringify([
        { name: 'id', description: id, dataType: 'INT' },
        {
          name: 'amount',
          description: amount,
          dataType: 'STRUCT',
          children: [{ name: 'currency', description: 'ISO code' }],
        },
      ]);
    const op = {
      op: MutationOpType.Set,
      field: 'columns',
      baseValue: columns('<p>Total</p>', 'Key'),
      value: columns('<p>Total in cents</p>', 'Row key'),
    };

    expect(elementChanges(op)).toEqual([
      {
        element: 'id',
        status: 'changed',
        properties: [
          { property: 'description', before: 'Key', after: 'Row key' },
        ],
      },
      {
        element: 'amount',
        status: 'changed',
        properties: [
          {
            property: 'description',
            before: 'Total',
            after: 'Total in cents',
          },
        ],
      },
    ]);
    expect(elementChanges(DESCRIPTION)).toBeUndefined();

    const [group] = groupSuggestions([request('a', true, [op])]);

    expect(group.current).toBeUndefined();
    expect(group.suggestions[0].changes).toEqual(elementChanges(op));
  });

  it('names a nested element by its path, and lists elements added and removed', () => {
    const op = {
      op: MutationOpType.Set,
      field: 'columns',
      baseValue: JSON.stringify([
        {
          name: 'amount',
          children: [{ name: 'currency', description: 'ISO' }],
        },
        { name: 'legacy' },
      ]),
      value: JSON.stringify([
        {
          name: 'amount',
          children: [{ name: 'currency', description: 'ISO 4217' }],
        },
        { name: 'region' },
      ]),
    };

    expect(elementChanges(op)).toEqual([
      {
        element: 'amount.currency',
        status: 'changed',
        properties: [
          { property: 'description', before: 'ISO', after: 'ISO 4217' },
        ],
      },
      { element: 'region', status: 'added', properties: [] },
      { element: 'legacy', status: 'removed', properties: [] },
    ]);
  });

  it('shows a first nested column added with its details', () => {
    const op = {
      op: MutationOpType.Set,
      field: 'columns',
      baseValue: JSON.stringify([{ name: 'amount', children: [] }]),
      value: JSON.stringify([
        {
          name: 'amount',
          children: [{ name: 'currency', description: 'ISO code' }],
        },
      ]),
    };

    expect(elementChanges(op)).toEqual([
      {
        element: 'amount.currency',
        status: 'added',
        properties: [
          { property: 'description', before: '', after: 'ISO code' },
        ],
      },
    ]);
  });

  it("shows a column's tags as one change of the column, by their FQN", () => {
    const sensitive = {
      tagFQN: 'PII.Sensitive',
      name: 'Sensitive',
      source: 'Classification',
    };
    const term = {
      tagFQN: 'Finance.Sensitive',
      name: 'Sensitive',
      source: 'Glossary',
    };
    const legacy = { tagFQN: 'Tier.Tier3', name: 'Tier3' };
    const op = {
      op: MutationOpType.Set,
      field: 'columns',
      baseValue: JSON.stringify([
        { name: 'id' },
        { name: 'amount', tags: [term, legacy] },
      ]),
      value: JSON.stringify([
        { name: 'id', tags: [sensitive] },
        { name: 'amount', tags: [term, sensitive] },
      ]),
    };

    expect(elementChanges(op)).toEqual([
      {
        element: 'id',
        status: 'changed',
        properties: [{ property: 'tags', before: '', after: 'PII.Sensitive' }],
      },
      {
        element: 'amount',
        status: 'changed',
        properties: [
          {
            property: 'tags',
            before: 'Finance.Sensitive, Tier.Tier3',
            after: 'Finance.Sensitive, PII.Sensitive',
          },
        ],
      },
    ]);
  });

  it('shows the nested columns of an added column with their details', () => {
    const op = {
      op: MutationOpType.Set,
      field: 'columns',
      baseValue: JSON.stringify([{ name: 'id' }]),
      value: JSON.stringify([
        { name: 'id' },
        {
          name: 'amount',
          children: [
            {
              name: 'currency',
              description: 'ISO code',
              children: [{ name: 'symbol', description: 'Sign' }],
            },
          ],
        },
      ]),
    };

    expect(elementChanges(op)).toEqual([
      { element: 'amount', status: 'added', properties: [] },
      {
        element: 'amount.currency',
        status: 'added',
        properties: [
          { property: 'description', before: '', after: 'ISO code' },
        ],
      },
      {
        element: 'amount.currency.symbol',
        status: 'added',
        properties: [{ property: 'description', before: '', after: 'Sign' }],
      },
    ]);
  });

  it('shows every column removed when a change empties the list', () => {
    const op = {
      op: MutationOpType.Set,
      field: 'columns',
      baseValue: JSON.stringify([{ name: 'id' }, { name: 'amount' }]),
      value: JSON.stringify([]),
    };

    expect(elementChanges(op)).toEqual([
      { element: 'id', status: 'removed', properties: [] },
      { element: 'amount', status: 'removed', properties: [] },
    ]);
  });

  it('keeps the current value of a column change that changes no column, such as a reorder', () => {
    const op = {
      op: MutationOpType.Set,
      field: 'columns',
      baseValue: JSON.stringify([{ name: 'id' }, { name: 'amount' }]),
      value: JSON.stringify([{ name: 'amount' }, { name: 'id' }]),
    };
    const [group] = groupSuggestions([request('a', true, [op])]);

    expect(elementChanges(op)).toBeUndefined();
    expect(group.suggestions[0].changes).toBeUndefined();
    expect(group.current).toBe('id, amount');
  });

  it('reads the published value of a list field from the asset', () => {
    const [, tags] = groupSuggestions([request('a', true)], {
      tags: [{ tagFQN: 'Tier.Tier3' }, { tagFQN: 'PII.NonSensitive' }],
    });
    const [, empty] = groupSuggestions([request('a', true)], { tags: [] });

    expect(tags.current).toBe('Tier.Tier3, PII.NonSensitive');
    expect(empty.current).toBe('');
    expect(groupSuggestions([request('a', true)])[1].current).toBeUndefined();
  });

  it('reads a changed stretch as its removed words, then its added words', () => {
    expect(
      wordDiff(
        'Business terms used in demo datasets.',
        'Shared business vocabulary for demo datasets.'
      ).map(({ text, type }) => [type, text])
    ).toEqual([
      ['del', 'Business terms used in'],
      ['same', ' '],
      ['add', 'Shared business vocabulary for'],
      ['same', ' demo datasets.'],
    ]);
  });

  it('diffs text word by word', () => {
    expect(
      wordDiff('Demo desc update', 'Demo desc update for finance').map(
        ({ text, type }) => [type, text]
      )
    ).toEqual([
      ['same', 'Demo desc update'],
      ['same', ' '],
      ['add', 'for finance'],
    ]);
  });
});
