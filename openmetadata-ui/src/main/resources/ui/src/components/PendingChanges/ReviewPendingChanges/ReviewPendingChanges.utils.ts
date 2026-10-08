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
import { groupBy } from 'lodash';
import {
  ChangeDecision,
  Decision as ChangeDecisionType,
  ResolutionType,
  ResolveTask,
} from '../../../generated/api/tasks/resolveTask';
import {
  ApprovalDecision,
  DecisionType,
} from '../../../generated/governance/changeRequest/approvalDecision';
import {
  ChangeOutcome,
  ChangeRequest,
  MutationOp,
  MutationOpType,
} from '../../../generated/governance/changeRequest/changeRequest';
import { toValue } from '../ChangeRequestChanges/ChangeRequestChanges.utils';

export enum Verdict {
  Accepted = 'accepted',
  Rejected = 'rejected',
  Superseded = 'superseded',
}

/** One change of one request, as a reviewer decides it. */
export interface Suggestion {
  id: string;
  request: ChangeRequest;
  op: MutationOp;
}

/** The suggestions on one field, with the field's published value when the requests carry it. */
export interface FieldGroup {
  field: string;
  current?: string;
  suggestions: Suggestion[];
}

export interface DiffPart {
  id: number;
  text: string;
  type: 'same' | 'add' | 'del';
}

const parse = (json?: string): unknown =>
  json === undefined ? undefined : JSON.parse(json);

// Descriptions are stored as HTML; a reviewer compares their words, not their markup.
const withoutMarkup = (text: string): string =>
  text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const textOf = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  return typeof value === 'string' ? withoutMarkup(value) : toValue(value).text;
};

// Keyed by revision too: a decision staged on one revision must never be sent for a newer one.
export const suggestionId = (request: ChangeRequest, op: MutationOp) =>
  `${request.id}|${request.activeRevisionNumber}|${op.field}|${op.key ?? ''}`;

const targetOf = (field: string, key?: string) => `${field}|${key ?? ''}`;

// Decisions made change by change name the changes they cover; the generated type does not list
// these fields yet.
interface ChangeLists {
  approvedChanges?: { field: string; key?: string }[];
  rejectedChanges?: { field: string; key?: string }[];
}

/**
 * How {@code user} already voted on each change of the request's active revision, keyed by
 * field and key. A decision without change lists covers every change of the revision.
 */
export const votesOf = (
  request: ChangeRequest,
  decisions: ApprovalDecision[],
  user?: string
): Map<string, Verdict> => {
  const votes = new Map<string, Verdict>();
  const ops = request.activeRevision?.ops ?? [];
  decisions
    .filter(
      (decision) =>
        decision.decidedBy === user &&
        decision.revisionNumber === request.activeRevisionNumber
    )
    .forEach((decision) => {
      const { approvedChanges, rejectedChanges } =
        decision as ApprovalDecision & ChangeLists;
      const whole = !approvedChanges?.length && !rejectedChanges?.length;
      const wholeVerdict =
        decision.decision === DecisionType.Reject
          ? Verdict.Rejected
          : Verdict.Accepted;
      if (whole) {
        ops.forEach((op) =>
          votes.set(targetOf(op.field, op.key), wholeVerdict)
        );
      }
      (approvedChanges ?? []).forEach((ref) =>
        votes.set(targetOf(ref.field, ref.key), Verdict.Accepted)
      );
      (rejectedChanges ?? []).forEach((ref) =>
        votes.set(targetOf(ref.field, ref.key), Verdict.Rejected)
      );
    });

  return votes;
};

export const voteOn = (
  votes: Map<string, Verdict> | undefined,
  op: MutationOp
) => votes?.get(targetOf(op.field, op.key));

/** A change still waiting for review: reported Pending, or not reported at all. */
export const isOpen = (op: MutationOp) =>
  !op.outcome || op.outcome === ChangeOutcome.Pending;

/** A change whose field moved since it was proposed: it can be rejected, not accepted. */
export const isConflicted = ({ request, op }: Suggestion) =>
  (request.conflicts ?? []).some((conflict) => conflict.field === op.field);

export const isTextChange = (op: MutationOp) =>
  op.op === MutationOpType.Set && typeof parse(op.value) === 'string';

/** What a list change adds or removes, read by its name rather than its stored identity. */
export const elementLabel = (op: MutationOp): string => {
  const text = textOf(parse(op.value));

  return text.startsWith('{') ? op.key ?? text : text;
};

export const valueText = (json?: string) => textOf(parse(json));

/** The pending requests' changes grouped by field, in the order the fields first appear. */
export const groupSuggestions = (requests: ChangeRequest[]): FieldGroup[] => {
  const suggestions = requests.flatMap((request) =>
    (request.activeRevision?.ops ?? []).map((op) => ({
      id: suggestionId(request, op),
      request,
      op,
    }))
  );

  return Object.entries(groupBy(suggestions, (s) => s.op.field)).map(
    ([field, items]) => {
      const withBase = items.find((s) => s.op.baseValue !== undefined);

      return {
        field,
        current: withBase ? valueText(withBase.op.baseValue) : undefined,
        suggestions: items,
      };
    }
  );
};

/** Text fields with more than one open suggestion: a reviewer picks one of them. */
export const isCompeting = (group: FieldGroup) =>
  group.suggestions.filter((s) => isOpen(s.op) && isTextChange(s.op)).length >
  1;

const isDecided = (verdict?: Verdict) =>
  verdict === Verdict.Accepted || verdict === Verdict.Rejected;

/**
 * Requests the reviewer decided only some open changes of while their approval step needs every
 * change decided at once: submitting them would be refused.
 */
export const incompleteRequests = (
  requests: ChangeRequest[],
  verdicts: Record<string, Verdict>
): ChangeRequest[] =>
  requests.filter((request) => {
    const open = (request.activeRevision?.ops ?? []).filter(isOpen);
    const decided = open.filter((op) =>
      isDecided(verdicts[suggestionId(request, op)])
    );

    return (
      !request.reviewPolicy?.partialDecisions &&
      decided.length > 0 &&
      decided.length < open.length
    );
  });

/**
 * The resolve call for each request the reviewer decided changes of: the decided changes, the
 * revision they were read from, and Approved when anything is approved.
 */
export const buildResolutions = (
  requests: ChangeRequest[],
  verdicts: Record<string, Verdict>
): { request: ChangeRequest; taskId: string; body: ResolveTask }[] =>
  requests.flatMap((request) => {
    const decisions: ChangeDecision[] = (request.activeRevision?.ops ?? [])
      .filter((op) => isOpen(op))
      .flatMap((op) => {
        const verdict = verdicts[suggestionId(request, op)];

        return verdict === Verdict.Accepted || verdict === Verdict.Rejected
          ? [
              {
                field: op.field,
                key: op.key,
                decision:
                  verdict === Verdict.Accepted
                    ? ChangeDecisionType.Approve
                    : ChangeDecisionType.Reject,
              },
            ]
          : [];
      });
    const approves = decisions.some(
      (d) => d.decision === ChangeDecisionType.Approve
    );

    return request.taskId && decisions.length > 0
      ? [
          {
            request,
            taskId: request.taskId,
            body: {
              resolutionType: approves
                ? ResolutionType.Approved
                : ResolutionType.Rejected,
              changeRequestRevision: request.activeRevisionNumber,
              changeDecisions: decisions,
            },
          },
        ]
      : [];
  });

/** Word-level diff of two texts: unchanged, removed and added runs. */
export const wordDiff = (before: string, after: string): DiffPart[] => {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const lcs = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  const push = (text: string, type: DiffPart['type']) => {
    const last = parts[parts.length - 1];
    if (last?.type === type) {
      last.text += text;
    } else {
      parts.push({ id: parts.length, text, type });
    }
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(a[i], 'same');
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(a[i++], 'del');
    } else {
      push(b[j++], 'add');
    }
  }
  a.slice(i).forEach((text) => push(text, 'del'));
  b.slice(j).forEach((text) => push(text, 'add'));

  return parts;
};
