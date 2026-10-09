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

/**
 * What one request proposes for one field, as a reviewer decides it: a text edit, or every element
 * the request adds to or removes from a list field. A verdict covers all of its changes.
 */
export interface Suggestion {
  id: string;
  request: ChangeRequest;
  field: string;
  ops: MutationOp[];
}

/** The suggestions on one field, with the field's published value when it is known. */
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
  if (Array.isArray(value)) {
    return value.map(textOf).join(', ');
  }

  return typeof value === 'string' ? withoutMarkup(value) : toValue(value).text;
};

// Keyed by revision too: a decision staged on one revision must never be sent for a newer one.
export const suggestionId = (request: ChangeRequest, field: string) =>
  `${request.id}|${request.activeRevisionNumber}|${field}`;

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

/** The user's earlier vote on any change of the suggestion; voting on it again would be refused. */
export const voteOn = (
  votes: Map<string, Verdict> | undefined,
  suggestion: Suggestion
) =>
  suggestion.ops
    .map((op) => votes?.get(targetOf(op.field, op.key)))
    .find(Boolean);

/** A change still waiting for review: reported Pending, or not reported at all. */
export const isOpenOp = (op: MutationOp) =>
  !op.outcome || op.outcome === ChangeOutcome.Pending;

/** A suggestion whose field moved since it was proposed: it can be rejected, not accepted. */
export const isConflicted = ({ request, field }: Suggestion) =>
  (request.conflicts ?? []).some((conflict) => conflict.field === field);

export const isTextChange = ({ ops }: Suggestion) =>
  ops.length === 1 &&
  ops[0].op === MutationOpType.Set &&
  typeof parse(ops[0].value) === 'string';

/** What a list change adds or removes, read by its name rather than its stored identity. */
export const elementLabel = (op: MutationOp): string => {
  const text = textOf(parse(op.value));

  return text.startsWith('{') ? op.key ?? text : text;
};

export const valueText = (json?: string) => textOf(parse(json));

/** How many elements a list suggestion adds and removes. */
export const listCounts = ({ ops }: Suggestion) => ({
  added: ops.filter((op) => op.op === MutationOpType.Add).length,
  removed: ops.filter((op) => op.op === MutationOpType.Remove).length,
});

/**
 * The pending requests' changes still under review grouped by field, in the order the fields first
 * appear, one suggestion per request on each field. A field's published value is read from its changes, or
 * from {@code published}, the asset as it is now, for list fields whose changes do not carry it.
 */
export const groupSuggestions = (
  requests: ChangeRequest[],
  published?: Record<string, unknown>
): FieldGroup[] => {
  const suggestions = requests.flatMap((request) =>
    Object.entries(
      groupBy(
        (request.activeRevision?.ops ?? []).filter(isOpenOp),
        (op) => op.field
      )
    ).map(([field, ops]) => ({
      id: suggestionId(request, field),
      request,
      field,
      ops,
    }))
  );

  return Object.entries(groupBy(suggestions, (s) => s.field)).map(
    ([field, items]) => {
      const base = items
        .flatMap((s) => s.ops)
        .find((op) => op.baseValue !== undefined)?.baseValue;
      let current: string | undefined;
      if (base !== undefined) {
        current = valueText(base);
      } else if (published) {
        current = textOf(published[field]);
      }

      return { field, current, suggestions: items };
    }
  );
};

/** Text fields with more than one open suggestion: a reviewer picks one of them. */
export const isCompeting = (group: FieldGroup) =>
  group.suggestions.filter(isTextChange).length > 1;

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
    const open = (request.activeRevision?.ops ?? []).filter(isOpenOp);
    const decided = open.filter((op) =>
      isDecided(verdicts[suggestionId(request, op.field)])
    );

    return (
      !request.reviewPolicy?.partialDecisions &&
      decided.length > 0 &&
      decided.length < open.length
    );
  });

/**
 * The resolve call for each request the reviewer decided changes of: every open change of each
 * decided suggestion, the revision they were read from, and Approved when anything is approved.
 */
export const buildResolutions = (
  requests: ChangeRequest[],
  verdicts: Record<string, Verdict>
): { request: ChangeRequest; taskId: string; body: ResolveTask }[] =>
  requests.flatMap((request) => {
    const decisions: ChangeDecision[] = (request.activeRevision?.ops ?? [])
      .filter(isOpenOp)
      .flatMap((op) => {
        const verdict = verdicts[suggestionId(request, op.field)];

        return isDecided(verdict)
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

type Run = { text: string; type: DiffPart['type'] };

const lcsRuns = (a: string[], b: string[]): Run[] => {
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
  const runs: Run[] = [];
  const push = (text: string, type: Run['type']) => {
    const last = runs[runs.length - 1];
    if (last?.type === type) {
      last.text += text;
    } else {
      runs.push({ text, type });
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

  return runs;
};

const isChange = (run: Run) => run.type !== 'same';

// Trimming a changed stretch drops the space that set it apart from the unchanged words next to it.
const needsSpace = (prev: Run | undefined, part: Run) => {
  if (!prev || isChange(prev) === isChange(part)) {
    return false;
  }

  return isChange(part) ? !/\s$/.test(prev.text) : !/^\s/.test(part.text);
};

/**
 * Word-level diff of two texts. A changed stretch reads as its removed words, then its added
 * words, rather than alternating word by word; whitespace between two changes joins them.
 */
export const wordDiff = (before: string, after: string): DiffPart[] => {
  const runs = lcsRuns(before.split(/(\s+)/), after.split(/(\s+)/));
  const parts: Run[] = [];
  let del = '';
  let add = '';
  const flush = () => {
    if (del.trim()) {
      parts.push({ text: del.trim(), type: 'del' });
    }
    if (del.trim() && add.trim()) {
      parts.push({ text: ' ', type: 'same' });
    }
    if (add.trim()) {
      parts.push({ text: add.trim(), type: 'add' });
    }
    del = '';
    add = '';
  };
  runs.forEach((run, index) => {
    const bridge =
      run.type === 'same' &&
      !run.text.trim() &&
      index > 0 &&
      index < runs.length - 1;
    if (run.type === 'same' && !bridge) {
      flush();
      parts.push(run);
    } else if (bridge) {
      del += run.text;
      add += run.text;
    } else if (run.type === 'del') {
      del += run.text;
    } else {
      add += run.text;
    }
  });
  flush();

  return parts
    .flatMap((part, index) =>
      needsSpace(parts[index - 1], part)
        ? [{ text: ' ', type: 'same' as const }, part]
        : [part]
    )
    .map((part, id) => ({ ...part, id }));
};
