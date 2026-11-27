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
import { groupBy, isEqual } from 'lodash';
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
  /** Set when the suggestion reads element by element, such as a column edit. */
  changes?: ElementChange[];
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
    .replace(/<[^<>]*>/g, ' ')
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

export interface PropertyChange {
  property: string;
  before: string;
  after: string;
}

/**
 * One element of a list of named elements, such as a column, that a change adds, removes or edits,
 * with the properties it changes. An added element carries only its description.
 */
export interface ElementChange {
  element: string;
  status: 'added' | 'removed' | 'changed';
  properties: PropertyChange[];
}

type NamedElement = Record<string, unknown> & { name: string };

const CHILDREN_PROPERTY = 'children';

const isNamedList = (value: unknown): value is NamedElement[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (element) =>
      typeof element === 'object' &&
      element !== null &&
      typeof (element as { name?: unknown }).name === 'string'
  );

// A missing or empty list compares as an empty list of named elements, so a first child added or
// a last one removed is still shown element by element.
const namedOrEmpty = (value: unknown): NamedElement[] | undefined => {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) && (value.length === 0 || isNamedList(value))
    ? (value as NamedElement[])
    : undefined;
};

// Both sides of a property as lists of named elements, when at least one side has elements.
const nestedLists = (
  before: unknown,
  after: unknown
): [NamedElement[], NamedElement[]] | undefined => {
  const beforeList = namedOrEmpty(before);
  const afterList = namedOrEmpty(after);
  const hasElements = isNamedList(before) || isNamedList(after);

  return hasElements && beforeList && afterList
    ? [beforeList, afterList]
    : undefined;
};

const namedListChanges = (
  before: NamedElement[],
  after: NamedElement[],
  path: string[]
): ElementChange[] => {
  const beforeByName = new Map(
    before.map((element) => [element.name, element])
  );
  const afterNames = new Set(after.map((element) => element.name));
  const removed = before
    .filter((element) => !afterNames.has(element.name))
    .map(
      (element): ElementChange => ({
        element: [...path, element.name].join('.'),
        status: 'removed',
        properties: [],
      })
    );

  return after
    .flatMap((element): ElementChange[] => {
      const name = [...path, element.name];
      const previous = beforeByName.get(element.name);
      if (!previous) {
        const description = textOf(element.description);
        // An added column's nested columns are proposed too; a reviewer must see each of them.
        const children = namedOrEmpty(element[CHILDREN_PROPERTY]) ?? [];

        return [
          {
            element: name.join('.'),
            status: 'added' as const,
            properties: description
              ? [{ property: 'description', before: '', after: description }]
              : [],
          },
          ...namedListChanges([], children, name),
        ];
      }
      const changed = [
        ...new Set([...Object.keys(previous), ...Object.keys(element)]),
      ].filter((property) => !isEqual(previous[property], element[property]));
      // Only nested columns are elements; any other list, such as a column's tags, is a value of
      // its element and reads as one change.
      const lists = changed.includes(CHILDREN_PROPERTY)
        ? nestedLists(previous[CHILDREN_PROPERTY], element[CHILDREN_PROPERTY])
        : undefined;
      const properties = changed
        .filter((property) => !(lists && property === CHILDREN_PROPERTY))
        .map((property) => ({
          property,
          before: textOf(previous[property]),
          after: textOf(element[property]),
        }));
      const own: ElementChange[] = properties.length
        ? [{ element: name.join('.'), status: 'changed', properties }]
        : [];

      return lists
        ? own.concat(namedListChanges(lists[0], lists[1], name))
        : own;
    })
    .concat(removed);
};

/**
 * A list of named elements, as a table's columns and their nested children, is set whole; a
 * reviewer reads which elements change and how. Undefined for any other change, and for a change
 * that names no element change, such as a reorder.
 */
export const elementChanges = (op: MutationOp): ElementChange[] | undefined => {
  if (op.op !== MutationOpType.Set || op.baseValue === undefined) {
    return undefined;
  }
  const lists = nestedLists(parse(op.baseValue), parse(op.value));
  const changes = lists ? namedListChanges(lists[0], lists[1], []) : [];

  return changes.length ? changes : undefined;
};

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
      changes: ops.length === 1 ? elementChanges(ops[0]) : undefined,
    }))
  );

  return Object.entries(groupBy(suggestions, (s) => s.field)).map(
    ([field, items]) => {
      const base = items
        .flatMap((s) => s.ops)
        .find((op) => op.baseValue !== undefined)?.baseValue;
      let current: string | undefined;
      // Suggestions read element by element show the current value beside each change.
      const elementWise = items.every((s) => s.changes);
      if (!elementWise && base !== undefined) {
        current = valueText(base);
      } else if (!elementWise && published) {
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
