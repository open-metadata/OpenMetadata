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
  Badge,
  BadgeColors,
  BadgeWithIcon,
  Button,
  Dialog,
  Dot,
  HoverCard,
  Modal,
  ModalOverlay,
  NativeSelect,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  Check,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { TFunction } from 'i18next';
import { isEmpty, startCase, uniq } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { Task } from '../../../generated/entity/tasks/task';
import { EntityReference } from '../../../generated/entity/type';
import {
  ChangeRequest,
  MutationOpType,
} from '../../../generated/governance/changeRequest/changeRequest';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getChangeRequestDecisions,
  withdrawChangeRequest,
} from '../../../rest/changeRequestsAPI';
import { getTaskById, resolveTask } from '../../../rest/tasksAPI';
import { getEntityAPIfromSource } from '../../../utils/Assets/AssetsUtils';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import Fqn from '../../../utils/Fqn';
import {
  getEntityTasksPath,
  getTaskDisplayId,
} from '../../../utils/TaskNavigationUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import { MapPatchAPIResponse } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import {
  computeTaskEditAccessFlags,
  computeTaskOwnershipFlags,
} from '../../Entity/Task/TaskTab/TaskTab.utils';
import { RequestHistory } from '../ChangeRequestTools/ChangeRequestTools.component';
import {
  buildResolutions,
  DiffPart,
  elementLabel,
  FieldGroup,
  groupSuggestions,
  incompleteRequests,
  isCompeting,
  isConflicted,
  isTextChange,
  listCounts,
  Suggestion,
  valueText,
  Verdict,
  voteOn,
  votesOf,
  wordDiff,
} from './ReviewPendingChanges.utils';
import { ReviewPendingChangesModalProps } from './ReviewPendingChangesModal.interface';

const EVERYONE = '';
// A decision moves the workflow asynchronously; the requests are read again once it has.
const WORKFLOW_SETTLE_MS = 3000;

const GLOSSARY_ENTITIES = new Set<string>([
  EntityType.GLOSSARY,
  EntityType.GLOSSARY_TERM,
]);

/**
 * The review task of each request, read once per open request on the asset: its number, and
 * whether the current user can decide it. Who can decide is the same rule the task's own Tasks tab
 * applies to its Approve and Reject actions, over the same task, owners and glossary reviewers.
 */
const useReviewTasks = (
  requests: ChangeRequest[],
  published?: Record<string, unknown>
) => {
  const { currentUser } = useApplicationStore();
  const [tasks, setTasks] = useState<Map<string, Task>>(new Map());
  const taskKey = requests.map((request) => request.taskId).join(',');
  const owners = (published?.owners ?? []) as EntityReference[];
  const hasGlossaryReviewer = GLOSSARY_ENTITIES.has(requests[0]?.entityType)
    ? !isEmpty(published?.reviewers)
    : undefined;

  useEffect(() => {
    const ids = uniq(
      requests.map((request) => request.taskId).filter(Boolean)
    ) as string[];
    // A task the user cannot read is one they cannot decide; it does not hide the others.
    Promise.allSettled(
      ids.map((id) => getTaskById(id, { fields: 'assignees,createdBy' }))
    ).then((results) =>
      setTasks(
        new Map(
          results.flatMap((result) =>
            result.status === 'fulfilled'
              ? [[result.value.data.id, result.value.data]]
              : []
          )
        )
      )
    );
  }, [taskKey]);

  return {
    canDecide: (taskId?: string) => {
      const task = taskId ? tasks.get(taskId) : undefined;
      if (!task) {
        return false;
      }

      return computeTaskEditAccessFlags({
        ...computeTaskOwnershipFlags(owners, task, currentUser),
        isAdminUser: Boolean(currentUser?.isAdmin),
        hasGlossaryReviewer,
        isTaskClosed: false,
        ownersCount: owners.length,
      }).hasEditAccess;
    },
    taskNumber: (taskId?: string) =>
      getTaskDisplayId(taskId ? tasks.get(taskId)?.taskId : undefined),
  };
};

/**
 * The current user's earlier votes on each request's active revision. A change they voted on
 * waits for the other reviewers; voting on it again would be refused.
 */
const useMyVotes = (requests: ChangeRequest[]) => {
  const { currentUser } = useApplicationStore();
  const [votes, setVotes] = useState<Map<string, Map<string, Verdict>>>(
    new Map()
  );
  const revisionKey = requests
    .map((request) => `${request.id}:${request.activeRevisionNumber}`)
    .join(',');

  useEffect(() => {
    // One read per open request on the asset; there is no bulk decisions endpoint.
    Promise.allSettled(
      requests.map((request) => getChangeRequestDecisions(request.id))
    ).then((results) =>
      setVotes(
        new Map(
          results.flatMap((result, index) =>
            result.status === 'fulfilled'
              ? [
                  [
                    requests[index].id,
                    votesOf(requests[index], result.value, currentUser?.name),
                  ],
                ]
              : []
          )
        )
      )
    );
  }, [revisionKey, currentUser?.name]);

  return (suggestion: Suggestion) =>
    voteOn(votes.get(suggestion.request.id), suggestion);
};

/**
 * The asset as it is published: its owners and glossary reviewers, who decide the review tasks,
 * and the list fields the requests add to or remove from, whose changes carry no previous value.
 */
const usePublishedEntity = (requests: ChangeRequest[]) => {
  const [published, setPublished] = useState<Record<string, unknown>>();
  const [first] = requests;
  const fields = uniq([
    'owners',
    ...(GLOSSARY_ENTITIES.has(first?.entityType) ? ['reviewers'] : []),
    ...requests.flatMap((request) =>
      (request.activeRevision?.ops ?? [])
        .filter((op) => op.op !== MutationOpType.Set)
        .map((op) => op.field)
    ),
  ]).join(',');

  useEffect(() => {
    const getEntity = first
      ? getEntityAPIfromSource(first.entityType as keyof MapPatchAPIResponse)
      : undefined;
    if (!first || !getEntity) {
      return;
    }
    // Without the published asset the fields still list their changes, just no current value.
    getEntity(first.entityFullyQualifiedName, { fields })
      .then((entity) =>
        setPublished(entity as unknown as Record<string, unknown>)
      )
      .catch(() => setPublished(undefined));
  }, [first?.entityType, first?.entityFullyQualifiedName, fields]);

  return published;
};

const VERDICT_COLORS: Record<Verdict, BadgeColors> = {
  [Verdict.Accepted]: 'success',
  [Verdict.Rejected]: 'error',
  [Verdict.Superseded]: 'gray',
};

const DIFF_CLASSES: Record<DiffPart['type'], string> = {
  add: 'tw:rounded-xs tw:bg-success-secondary tw:text-success-primary',
  del: 'tw:rounded-xs tw:bg-error-secondary tw:text-error-primary tw:line-through',
  same: '',
};

const verbOf = (suggestion: Suggestion, t: TFunction) => {
  if (isTextChange(suggestion)) {
    return t('label.suggested-an-edit');
  }
  const { added, removed } = listCounts(suggestion);
  if (added && !removed) {
    return t('label.added-count', { count: added });
  }
  if (removed && !added) {
    return t('label.removed-count', { count: removed });
  }

  return t('label.edited-lowercase');
};

const TextDiff = ({ before, after }: { before: string; after: string }) => (
  <div className="tw:rounded-lg tw:border tw:border-secondary tw:px-3 tw:py-2.5 tw:text-sm tw:text-pretty">
    {wordDiff(before, after).map((part) => (
      <span className={DIFF_CLASSES[part.type]} key={part.id}>
        {part.text}
      </span>
    ))}
  </div>
);

const SuggestionBody = ({ suggestion }: { suggestion: Suggestion }) => {
  const [first] = suggestion.ops;
  if (isTextChange(suggestion)) {
    return (
      <TextDiff
        after={valueText(first.value)}
        before={valueText(first.baseValue)}
      />
    );
  }
  if (first.op === MutationOpType.Set) {
    return (
      <Typography as="p" size="text-sm">
        {valueText(first.value)}
      </Typography>
    );
  }

  return (
    <div className="tw:flex tw:flex-wrap tw:gap-2">
      {suggestion.ops.map((op) => {
        const removed = op.op === MutationOpType.Remove;

        return (
          <Badge
            className={removed ? 'tw:line-through' : ''}
            color={removed ? 'error' : 'success'}
            key={`${op.op}-${op.key}`}
            size="md"
            type="color">
            {`${removed ? '−' : '+'} ${elementLabel(op)}`}
          </Badge>
        );
      })}
    </div>
  );
};

// The request's review task; hovering it shows the request's revisions, decisions and events.
const TaskChip = ({
  request,
  number,
}: {
  request: ChangeRequest;
  number: string;
}) => {
  const { t } = useTranslation();

  return (
    <HoverCard
      content={<RequestHistory request={request} />}
      placement="bottom start">
      <Link
        className="tw:rounded-xs"
        data-testid={`task-${request.id}`}
        to={getEntityTasksPath(
          request.entityType as EntityType,
          request.entityFullyQualifiedName
        )}>
        <Badge color="gray" size="sm" type="color">
          {number ? t('label.task-number', { number }) : t('label.task')}
        </Badge>
      </Link>
    </HoverCard>
  );
};

interface SuggestionRowProps {
  suggestion: Suggestion;
  verdict?: Verdict;
  // The current user's vote recorded earlier on this change, still waiting for other reviewers.
  myVote?: Verdict;
  canDecide: boolean;
  taskNumber: string;
  onDecide: (verdict?: Verdict) => void;
  onWithdraw: () => void;
}

const StagedVerdict = ({
  verdict,
  onUndo,
}: {
  verdict: Verdict;
  onUndo: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Badge color={VERDICT_COLORS[verdict]} size="sm" type="pill-color">
        {`${t(`label.verdict-${verdict}`)} · ${t('label.pending-submit')}`}
      </Badge>
      <Button color="tertiary" size="sm" onClick={onUndo}>
        {t('label.undo')}
      </Button>
    </>
  );
};

// What the viewer can do with one suggestion: nothing once it is decided, withdraw their own
// request, or, as a reviewer, accept or reject it. A suggestion whose field moved since it was
// proposed can only be rejected; accepting it would be refused.
const SuggestionControls = ({
  suggestion,
  verdict,
  myVote,
  canDecide,
  onDecide,
  onWithdraw,
}: SuggestionRowProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const conflicted = isConflicted(suggestion);

  if (currentUser?.name === suggestion.request.requestedBy) {
    return (
      <Button
        color="secondary"
        data-testid={`withdraw-${suggestion.id}`}
        size="sm"
        onClick={onWithdraw}>
        {t('label.withdraw-revision')}
      </Button>
    );
  }
  if (myVote) {
    return (
      <Badge color="gray" size="sm" type="pill-color">
        {t('label.you-voted-waiting', {
          vote: t(`label.verdict-${myVote}`),
        })}
      </Badge>
    );
  }
  if (verdict) {
    return <StagedVerdict verdict={verdict} onUndo={() => onDecide()} />;
  }

  return (
    <>
      {conflicted && (
        <Badge color="warning" size="sm" type="pill-color">
          {t('label.conflicts-with-published-value')}
        </Badge>
      )}
      {canDecide && (
        <Button
          color="secondary"
          data-testid={`reject-${suggestion.id}`}
          iconLeading={XClose}
          size="sm"
          onClick={() => onDecide(Verdict.Rejected)}>
          {t('label.reject')}
        </Button>
      )}
      {canDecide && !conflicted && (
        <Button
          color="primary"
          data-testid={`accept-${suggestion.id}`}
          iconLeading={Check}
          size="sm"
          onClick={() => onDecide(Verdict.Accepted)}>
          {t('label.accept')}
        </Button>
      )}
    </>
  );
};

const SuggestionRow = (props: SuggestionRowProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { suggestion, verdict, taskNumber } = props;
  const { request } = suggestion;
  const own = currentUser?.name === request.requestedBy;

  return (
    <div
      className={`tw:flex tw:gap-3 tw:border-t tw:border-secondary tw:px-4 tw:py-3.5 ${
        verdict === Verdict.Accepted ? 'tw:bg-success-primary' : ''
      }`}
      data-testid={`suggestion-${suggestion.id}`}>
      <ProfilePicture name={request.requestedBy} size="sm" />
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-2">
        <div className="tw:flex tw:min-h-8 tw:flex-wrap tw:items-center tw:gap-2">
          <Typography as="span" size="text-sm" weight="semibold">
            {own ? t('label.you') : request.requestedBy}
          </Typography>
          <Typography
            as="span"
            className="tw:whitespace-nowrap tw:text-tertiary"
            size="text-sm">
            {`${verbOf(suggestion, t)} · ${getRelativeTime(request.updatedAt)}`}
          </Typography>
          {request.taskId && <TaskChip number={taskNumber} request={request} />}
          <span className="tw:flex-1" />
          <div className="tw:flex tw:items-center tw:gap-2">
            <SuggestionControls {...props} />
          </div>
        </div>
        <div
          className={
            verdict === Verdict.Rejected || verdict === Verdict.Superseded
              ? 'tw:opacity-50'
              : ''
          }>
          <SuggestionBody suggestion={suggestion} />
        </div>
      </div>
    </div>
  );
};

interface FieldSectionProps {
  group: FieldGroup;
  canDecide: (taskId?: string) => boolean;
  taskNumber: (taskId?: string) => string;
  voteOf: (suggestion: Suggestion) => Verdict | undefined;
  verdicts: Record<string, Verdict>;
  onDecide: (suggestion: Suggestion, verdict?: Verdict) => void;
  onWithdraw: (request: ChangeRequest) => void;
}

const FieldSection = ({
  group,
  canDecide,
  taskNumber,
  voteOf,
  verdicts,
  onDecide,
  onWithdraw,
}: FieldSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:items-center tw:gap-2">
        <Typography as="span" size="text-md" weight="semibold">
          {startCase(group.field)}
        </Typography>
        <Typography as="span" className="tw:text-tertiary" size="text-sm">
          {t('label.suggestion-count', { count: group.suggestions.length })}
        </Typography>
        {isCompeting(group) &&
          !group.suggestions.some((suggestion) => verdicts[suggestion.id]) && (
            <BadgeWithIcon color="warning" iconLeading={AlertCircle} size="sm">
              {t('label.competing-edits-accept-one')}
            </BadgeWithIcon>
          )}
      </div>
      <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary">
        {group.current !== undefined && (
          <div className="tw:flex tw:items-baseline tw:gap-3 tw:bg-secondary tw:px-4 tw:py-2.5">
            <Typography
              as="span"
              className="tw:w-16 tw:shrink-0 tw:text-tertiary tw:uppercase"
              size="text-xs"
              weight="semibold">
              {t('label.current')}
            </Typography>
            <Typography as="span" className="tw:text-secondary" size="text-sm">
              {group.current || t('label.none')}
            </Typography>
          </div>
        )}
        {group.suggestions.map((suggestion) => (
          <SuggestionRow
            canDecide={canDecide(suggestion.request.taskId)}
            key={suggestion.id}
            myVote={voteOf(suggestion)}
            suggestion={suggestion}
            taskNumber={taskNumber(suggestion.request.taskId)}
            verdict={verdicts[suggestion.id]}
            onDecide={(verdict) => onDecide(suggestion, verdict)}
            onWithdraw={() => onWithdraw(suggestion.request)}
          />
        ))}
      </div>
    </section>
  );
};

const Tally = ({ className, text }: { className: string; text: string }) => (
  <span className="tw:flex tw:items-center tw:gap-1.5">
    <Dot className={className} size="sm" />
    {text}
  </span>
);

// The staged verdicts so far, and the submit that sends them.
const ReviewFooter = ({
  verdicts,
  toReview,
  isBusy,
  onSubmit,
}: {
  verdicts: Verdict[];
  toReview: number;
  isBusy: boolean;
  onSubmit: () => void;
}) => {
  const { t } = useTranslation();
  const accepted = verdicts.filter((v) => v === Verdict.Accepted).length;
  const staged = verdicts.filter((v) => v !== Verdict.Superseded).length;

  return (
    <Dialog.Footer className="tw:mt-0 tw:flex tw:items-center tw:border-t tw:border-subtle tw:sm:mt-0">
      <Typography
        as="div"
        className="tw:flex tw:flex-wrap tw:items-center tw:gap-4 tw:text-tertiary"
        size="text-sm">
        <Tally
          className="tw:text-fg-success-secondary"
          text={t('label.accepted-count', { count: accepted })}
        />
        <Tally
          className="tw:text-fg-error-secondary"
          text={t('label.rejected-count', {
            count: verdicts.length - accepted,
          })}
        />
        <Tally
          className="tw:text-fg-quaternary"
          text={t('label.to-review-count', { count: toReview })}
        />
      </Typography>
      <span className="tw:flex-1" />
      <Button
        color="primary"
        data-testid="submit-review"
        isDisabled={staged === 0 || isBusy}
        size="md"
        onClick={onSubmit}>
        {staged > 0
          ? t('label.submit-review-count', { count: staged })
          : t('label.submit-review')}
      </Button>
    </Dialog.Footer>
  );
};

/**
 * Every pending change on one asset, grouped by field: a reviewer accepts or rejects what each
 * request proposes for a field, then submits, which resolves each request's task with the
 * decisions made on its changes.
 */
const ReviewPendingChangesModal = ({
  requests,
  onClose,
  onChange,
}: ReviewPendingChangesModalProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [proposedBy, setProposedBy] = useState(EVERYONE);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [isBusy, setIsBusy] = useState(false);
  const published = usePublishedEntity(requests);
  const { canDecide, taskNumber } = useReviewTasks(requests, published);
  const myVote = useMyVotes(requests);

  const visible = useMemo(
    () =>
      proposedBy === EVERYONE
        ? requests
        : requests.filter((request) => request.requestedBy === proposedBy),
    [requests, proposedBy]
  );
  const groups = useMemo(
    () => groupSuggestions(visible, published),
    [visible, published]
  );
  const all = useMemo(
    () => groupSuggestions(requests, published),
    [requests, published]
  );
  const reviewable = (suggestion: Suggestion) =>
    suggestion.request.requestedBy !== currentUser?.name &&
    canDecide(suggestion.request.taskId) &&
    !myVote(suggestion);
  // Fields with competing text edits across every request, whatever the proposed-by filter shows.
  const competingFields = new Set(
    all.filter(isCompeting).map((group) => group.field)
  );
  const allSuggestions = all.flatMap((group) => group.suggestions);
  const undecided = groups
    .flatMap((group) => group.suggestions)
    .filter((suggestion) => reviewable(suggestion) && !verdicts[suggestion.id]);
  const acceptable = undecided.filter(
    (suggestion) =>
      !competingFields.has(suggestion.field) && !isConflicted(suggestion)
  );

  const decide = (suggestion: Suggestion, verdict?: Verdict) =>
    setVerdicts((current) => {
      const next = { ...current };
      const competing = isTextChange(suggestion)
        ? (all.find((g) => g.field === suggestion.field)?.suggestions ?? [])
            .filter((other) => other.id !== suggestion.id)
            .filter(isTextChange)
        : [];
      // At most one text edit of a field is accepted: accepting one supersedes the others, and
      // only undoing that accepted edit brings them back.
      if (verdict === Verdict.Accepted) {
        competing.forEach((other) => {
          next[other.id] = Verdict.Superseded;
        });
      } else if (current[suggestion.id] === Verdict.Accepted) {
        competing
          .filter((other) => next[other.id] === Verdict.Superseded)
          .forEach((other) => delete next[other.id]);
      }
      if (verdict) {
        next[suggestion.id] = verdict;
      } else {
        delete next[suggestion.id];
      }

      return next;
    });

  const decideAll = (items: Suggestion[], verdict: Verdict) =>
    setVerdicts((current) => ({
      ...current,
      ...Object.fromEntries(
        items.map((suggestion) => [suggestion.id, verdict])
      ),
    }));

  const withdraw = async (request: ChangeRequest) => {
    try {
      await withdrawChangeRequest(request.id, request.activeRevisionNumber);
      showSuccessToast(t('message.change-request-withdrawn'));
      await onChange();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  // One resolve call per request: each request has its own review task and revision. Requests
  // whose approval step needs every change decided are held back until they are; a failed call
  // keeps its decisions staged so the reviewer can retry.
  const submit = async () => {
    const incomplete = incompleteRequests(requests, verdicts);
    if (incomplete.length > 0) {
      showErrorToast(
        t('message.decide-every-change-of-request', {
          requesters: uniq(incomplete.map((r) => r.requestedBy)).join(', '),
        })
      );

      return;
    }
    setIsBusy(true);
    const submitted = new Set<string>();
    for (const { request, taskId, body } of buildResolutions(
      requests,
      verdicts
    )) {
      try {
        await resolveTask(taskId, body);
        submitted.add(request.id);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }
    if (submitted.size > 0) {
      showSuccessToast(
        t('message.review-submitted-task-count', { count: submitted.size })
      );
    }
    setVerdicts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([id]) => !submitted.has(id.split('|')[0])
        )
      )
    );
    setIsBusy(false);
    await onChange();
    setTimeout(onChange, WORKFLOW_SETTLE_MS);
  };

  const people = uniq(requests.map((request) => request.requestedBy));
  const [first] = requests;
  const subtitle = first
    ? [
        Fqn.split(first.entityFullyQualifiedName).pop(),
        startCase(first.entityType),
        t('message.changes-from-people-across-tasks', {
          changes: allSuggestions.length,
          people: people.length,
          tasks: requests.length,
        }),
      ].join(' · ')
    : '';

  return (
    <ModalOverlay
      isOpen
      className="tw:z-1100"
      onOpenChange={(open) => !open && onClose()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="review-pending-changes-modal"
          width={920}
          onClose={onClose}>
          <Dialog.Header
            className="tw:border-b tw:border-subtle tw:pr-12 tw:pb-4 tw:sm:pb-4"
            title={t('label.review-pending-changes')}>
            <Typography as="p" className="tw:text-tertiary" size="text-sm">
              {subtitle}
            </Typography>
            <div className="tw:mt-4 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              <Typography
                as="span"
                className="tw:whitespace-nowrap tw:text-tertiary"
                size="text-sm"
                weight="medium">
                {t('label.proposed-by')}
              </Typography>
              <NativeSelect
                aria-label={t('label.proposed-by')}
                className="tw:w-48"
                data-testid="proposed-by"
                options={[
                  {
                    label: `${t('label.everyone')} (${allSuggestions.length})`,
                    value: EVERYONE,
                  },
                  ...people.map((person) => ({
                    label: `${person} (${
                      allSuggestions.filter(
                        (s) => s.request.requestedBy === person
                      ).length
                    })`,
                    value: person,
                  })),
                ]}
                selectClassName="tw:py-1.5 tw:text-sm"
                value={proposedBy}
                onChange={(event) => setProposedBy(event.target.value)}
              />
              <span className="tw:flex-1" />
              {undecided.length > 0 && (
                <>
                  <Button
                    color="secondary"
                    data-testid="reject-all"
                    size="sm"
                    onClick={() => decideAll(undecided, Verdict.Rejected)}>
                    {t('label.reject-all')}
                  </Button>
                  {acceptable.length > 0 && (
                    <Button
                      color="secondary"
                      data-testid="accept-all"
                      iconLeading={Check}
                      size="sm"
                      onClick={() => decideAll(acceptable, Verdict.Accepted)}>
                      {acceptable.length < undecided.length
                        ? t('label.accept-count-non-conflicting', {
                            count: acceptable.length,
                          })
                        : t('label.accept-all')}
                    </Button>
                  )}
                </>
              )}
            </div>
          </Dialog.Header>
          <div className="tw:flex tw:h-[520px] tw:flex-col tw:gap-7 tw:overflow-y-auto tw:bg-secondary tw:px-6 tw:pt-5 tw:pb-6">
            {groups.map((group) => (
              <FieldSection
                canDecide={canDecide}
                group={group}
                key={group.field}
                taskNumber={taskNumber}
                verdicts={verdicts}
                voteOf={myVote}
                onDecide={decide}
                onWithdraw={withdraw}
              />
            ))}
            {groups.length === 0 && (
              <Typography
                as="p"
                className="tw:p-12 tw:text-center tw:text-tertiary"
                size="text-sm">
                {requests.length > 0
                  ? t('message.no-changes-from-person')
                  : t('message.no-pending-changes-on-asset')}
              </Typography>
            )}
          </div>
          <ReviewFooter
            isBusy={isBusy}
            toReview={
              allSuggestions.filter((s) => reviewable(s) && !verdicts[s.id])
                .length
            }
            verdicts={Object.values(verdicts)}
            onSubmit={submit}
          />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ReviewPendingChangesModal;
