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
  ChangeRequestStatus,
  MutationOpType,
} from '../../../generated/governance/changeRequest/changeRequest';
import {
  buildResolutions,
  groupSuggestions,
  incompleteRequests,
  isCompeting,
  shownOps,
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
      [suggestionId(a, TAG)]: Verdict.Accepted,
      [suggestionId(a, DESCRIPTION)]: Verdict.Rejected,
      [suggestionId(b, TAG)]: Verdict.Rejected,
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
        [suggestionId(a, DESCRIPTION)]: Verdict.Superseded,
        [suggestionId(a, decidedTag)]: Verdict.Accepted,
      })
    ).toEqual([]);
  });

  it('holds back a request whose approval step needs every change decided', () => {
    const whole = request('a', false);
    const partial = request('b', true);
    const verdicts = {
      [suggestionId(whole, TAG)]: Verdict.Accepted,
      [suggestionId(partial, TAG)]: Verdict.Accepted,
    };

    expect(incompleteRequests([whole, partial], verdicts)).toEqual([whole]);
    expect(
      incompleteRequests([whole], {
        ...verdicts,
        [suggestionId(whole, DESCRIPTION)]: Verdict.Rejected,
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
      request('a', true, [DESCRIPTION, appliedTag]),
    ]);

    expect(groups.map((group) => group.field)).toEqual(['description']);
  });

  it('shows an open request its pending changes and a closed one all of them', () => {
    const appliedTag = { ...TAG, outcome: ChangeOutcome.Applied };
    const open = request('a', true, [DESCRIPTION, appliedTag]);
    const closed = { ...open, status: ChangeRequestStatus.Applied };

    expect(shownOps({ ...open, status: ChangeRequestStatus.Pending })).toEqual([
      DESCRIPTION,
    ]);
    expect(shownOps(closed)).toEqual([DESCRIPTION, appliedTag]);
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

    expect(voteOn(votes, DESCRIPTION)).toBe(Verdict.Accepted);
    expect(voteOn(votes, TAG)).toBeUndefined();
    expect(voteOn(votesOf(a, [decision('karan', 2, {})], 'karan'), TAG)).toBe(
      Verdict.Accepted
    );
  });

  it('diffs text word by word', () => {
    expect(
      wordDiff('Demo desc update', 'Demo desc update for finance').map(
        ({ text, type }) => [type, text]
      )
    ).toEqual([
      ['same', 'Demo desc update'],
      ['add', ' for finance'],
    ]);
  });
});
