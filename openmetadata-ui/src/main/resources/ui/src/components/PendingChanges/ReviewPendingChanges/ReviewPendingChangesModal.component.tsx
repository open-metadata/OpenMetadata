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
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  NativeSelect,
  Typography,
} from '@openmetadata/ui-core-components';
import { Eye, ListView } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { startCase, uniq } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { Task } from '../../../generated/entity/tasks/task';
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
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import Fqn from '../../../utils/Fqn';
import { getEntityTasksPath } from '../../../utils/TaskNavigationUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import { AdminActions } from '../ChangeRequestTools/ChangeRequestTools.component';
import { PendingChangesModalProps } from '../PendingChangesModal/PendingChangesModal.interface';
import {
  buildResolutions,
  DiffPart,
  elementLabel,
  FieldGroup,
  groupSuggestions,
  incompleteRequests,
  isCompeting,
  isConflicted,
  isOpen,
  isTextChange,
  Suggestion,
  valueText,
  Verdict,
  voteOn,
  votesOf,
  wordDiff,
} from './ReviewPendingChanges.utils';

const EVERYONE = '';
// A decision moves the workflow asynchronously; the requests are read again once it has.
const WORKFLOW_SETTLE_MS = 3000;

/**
 * Whether the current user can decide a request's review task: administrators decide every task,
 * anyone else the tasks assigned to them or to one of their teams. One task read per open request
 * on the asset; a user's assigned-task list is paged and can be far larger than this.
 */
const useDecidableTasks = (requests: ChangeRequest[]) => {
  const { currentUser } = useApplicationStore();
  const [taskIds, setTaskIds] = useState<Set<string>>(new Set());
  const isAdmin = Boolean(currentUser?.isAdmin);
  const taskKey = requests.map((request) => request.taskId).join(',');

  useEffect(() => {
    const names = new Set([
      currentUser?.name,
      ...(currentUser?.teams ?? []).map((team) => team.name),
    ]);
    const assignedToMe = (task: Task) =>
      (task.assignees ?? []).some((assignee) => names.has(assignee.name));
    const ids = uniq(
      requests.map((request) => request.taskId).filter(Boolean)
    ) as string[];
    if (!isAdmin) {
      // A task the user cannot read is one they cannot decide; it does not hide the others.
      Promise.allSettled(
        ids.map((id) => getTaskById(id, { fields: 'assignees' }))
      ).then((results) =>
        setTaskIds(
          new Set(
            results
              .flatMap((result) =>
                result.status === 'fulfilled' ? [result.value.data] : []
              )
              .filter(assignedToMe)
              .map((task) => task.id)
          )
        )
      );
    }
  }, [taskKey, isAdmin]);

  return (taskId?: string) =>
    isAdmin || (taskId !== undefined && taskIds.has(taskId));
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
    voteOn(votes.get(suggestion.request.id), suggestion.op);
};

const VERBS: Record<MutationOpType, string> = {
  [MutationOpType.Add]: 'label.added',
  [MutationOpType.Remove]: 'label.removed',
  [MutationOpType.Set]: 'label.edited',
};

const VERDICT_COLORS: Record<Verdict, BadgeColors> = {
  [Verdict.Accepted]: 'success',
  [Verdict.Rejected]: 'error',
  [Verdict.Superseded]: 'gray',
};

const DIFF_CLASSES: Record<DiffPart['type'], string> = {
  add: 'tw:bg-success-secondary tw:text-success-primary',
  del: 'tw:bg-error-secondary tw:text-error-primary tw:line-through',
  same: '',
};

const TextDiff = ({ before, after }: { before: string; after: string }) => (
  <div className="tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-3 tw:py-2 tw:text-sm">
    {wordDiff(before, after).map((part) => (
      <span className={DIFF_CLASSES[part.type]} key={part.id}>
        {part.text}
      </span>
    ))}
  </div>
);

const SuggestionBody = ({ suggestion }: { suggestion: Suggestion }) => {
  const { op } = suggestion;
  if (isTextChange(op)) {
    return (
      <TextDiff after={valueText(op.value)} before={valueText(op.baseValue)} />
    );
  }
  if (op.op === MutationOpType.Set) {
    return (
      <Typography as="p" size="text-sm">
        {valueText(op.value)}
      </Typography>
    );
  }
  const removed = op.op === MutationOpType.Remove;

  return (
    <Badge
      className={removed ? 'tw:line-through' : ''}
      color={removed ? 'error' : 'success'}
      size="sm"
      type="color">
      {`${removed ? '−' : '+'} ${elementLabel(op)}`}
    </Badge>
  );
};

interface SuggestionRowProps {
  suggestion: Suggestion;
  verdict?: Verdict;
  // The current user's vote recorded earlier on this change, still waiting for other reviewers.
  myVote?: Verdict;
  canDecide: boolean;
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
      <Badge color={VERDICT_COLORS[verdict]} size="sm" type="color">
        {`${t(`label.verdict-${verdict}`)} · ${t('label.pending-submit')}`}
      </Badge>
      <Button color="tertiary" size="sm" onClick={onUndo}>
        {t('label.undo')}
      </Button>
    </>
  );
};

// What the viewer can do with one change: nothing once it is decided, withdraw their own request,
// or, as a reviewer, accept or reject it. A change whose field moved since it was proposed can only
// be rejected; accepting it would be refused.
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
  const { request } = suggestion;
  const conflicted = isConflicted(suggestion);

  if (currentUser?.name === request.requestedBy) {
    return (
      <Button color="secondary" size="sm" onClick={onWithdraw}>
        {t('label.withdraw-revision')}
      </Button>
    );
  }
  if (myVote) {
    return (
      <Badge color="gray" size="sm" type="color">
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
        <Badge color="warning" size="sm" type="color">
          {t('label.conflicts-with-published-value')}
        </Badge>
      )}
      {canDecide && (
        <Button
          color="secondary"
          data-testid={`reject-${suggestion.id}`}
          size="sm"
          onClick={() => onDecide(Verdict.Rejected)}>
          {t('label.reject')}
        </Button>
      )}
      {canDecide && !conflicted && (
        <Button
          color="primary"
          data-testid={`accept-${suggestion.id}`}
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
  const { suggestion, verdict } = props;
  const { request, op } = suggestion;
  const own = currentUser?.name === request.requestedBy;
  const verb = isTextChange(op)
    ? t('label.suggested-an-edit')
    : t(VERBS[op.op]);

  return (
    <div
      className={`tw:flex tw:gap-3 tw:border-t tw:border-secondary tw:px-4 tw:py-3 ${
        verdict === Verdict.Accepted ? 'tw:bg-success-primary' : ''
      }`}
      data-testid={`suggestion-${suggestion.id}`}>
      <ProfilePicture name={request.requestedBy} size="sm" />
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-2">
        <div className="tw:flex tw:items-center tw:gap-2">
          <Typography as="span" size="text-sm" weight="semibold">
            {own ? t('label.you') : request.requestedBy}
          </Typography>
          <Typography as="span" className="tw:text-tertiary" size="text-sm">
            {`${verb} · ${getRelativeTime(request.updatedAt)}`}
          </Typography>
          {request.taskId && (
            <Link
              className="tw:text-xs tw:text-tertiary"
              to={getEntityTasksPath(
                request.entityType as EntityType,
                request.entityFullyQualifiedName
              )}>
              {`${t('label.task')} · ${t('label.revision-number', {
                number: request.activeRevisionNumber,
              })}`}
            </Link>
          )}
          <span className="tw:flex-1" />
          <SuggestionControls {...props} />
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
  voteOf: (suggestion: Suggestion) => Verdict | undefined;
  verdicts: Record<string, Verdict>;
  onDecide: (suggestion: Suggestion, verdict?: Verdict) => void;
  onWithdraw: (request: ChangeRequest) => void;
}

const FieldSection = ({
  group,
  canDecide,
  voteOf,
  verdicts,
  onDecide,
  onWithdraw,
}: FieldSectionProps) => {
  const { t } = useTranslation();

  return (
    <section className="tw:flex tw:flex-col tw:gap-2">
      <div className="tw:flex tw:items-center tw:gap-2">
        <Typography as="span" size="text-md" weight="semibold">
          {startCase(group.field)}
        </Typography>
        <Typography as="span" className="tw:text-tertiary" size="text-sm">
          {t('label.suggestion-count', { count: group.suggestions.length })}
        </Typography>
        {isCompeting(group) && (
          <Badge color="warning" size="sm" type="color">
            {t('label.competing-edits-accept-one')}
          </Badge>
        )}
      </div>
      <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-primary">
        {group.current !== undefined && (
          <div className="tw:flex tw:gap-4 tw:bg-secondary tw:px-4 tw:py-2">
            <Typography
              as="span"
              className="tw:text-tertiary tw:uppercase"
              size="text-xs"
              weight="semibold">
              {t('label.current')}
            </Typography>
            <Typography as="span" size="text-sm">
              {group.current}
            </Typography>
          </div>
        )}
        {group.suggestions.map((suggestion) => (
          <SuggestionRow
            canDecide={canDecide(suggestion.request.taskId)}
            key={suggestion.id}
            myVote={voteOf(suggestion)}
            suggestion={suggestion}
            verdict={verdicts[suggestion.id]}
            onDecide={(verdict) => onDecide(suggestion, verdict)}
            onWithdraw={() => onWithdraw(suggestion.request)}
          />
        ))}
      </div>
    </section>
  );
};

/**
 * An administrator's actions on each open request: publish it without review, with a reason, or
 * cancel it. Shown to administrators only; the server checks the same.
 */
const AdminSection = ({
  requests,
  onChange,
}: {
  requests: ChangeRequest[];
  onChange: () => Promise<void>;
}) => {
  const { t } = useTranslation();

  return (
    <section
      className="tw:flex tw:flex-col tw:gap-2"
      data-testid="review-admin-actions">
      <Typography as="span" size="text-md" weight="semibold">
        {t('label.admin-action-plural')}
      </Typography>
      <div className="tw:flex tw:flex-col tw:divide-y tw:divide-secondary tw:rounded-xl tw:border tw:border-secondary tw:bg-primary">
        {requests.map((request) => (
          <div
            className="tw:flex tw:flex-col tw:gap-2 tw:px-4 tw:py-3"
            key={request.id}>
            <Typography as="span" className="tw:text-tertiary" size="text-sm">
              {`${request.requestedBy} · ${t('label.revision-number', {
                number: request.activeRevisionNumber,
              })}`}
            </Typography>
            <AdminActions request={request} onChange={onChange} />
          </div>
        ))}
      </div>
    </section>
  );
};

// Above the changes: an administrator's actions on each request, or why there is nothing to review.
const BodyIntro = ({
  isAdmin,
  isEmpty,
  requests,
  onChange,
}: {
  isAdmin: boolean;
  isEmpty: boolean;
  requests: ChangeRequest[];
  onChange: () => Promise<void>;
}) => {
  const { t } = useTranslation();

  return (
    <>
      {isAdmin && requests.length > 0 && (
        <AdminSection requests={requests} onChange={onChange} />
      )}
      {isEmpty && (
        <Typography as="p" className="tw:text-tertiary" size="text-sm">
          {t('message.no-pending-changes-on-asset')}
        </Typography>
      )}
    </>
  );
};

/**
 * Every pending change on one asset, grouped by field: a reviewer accepts or rejects each change,
 * then submits, which resolves each request's task with the decisions made on its changes.
 */
const ReviewPendingChangesModal = ({
  requests,
  onClose,
  onChange,
  onSwitchView,
}: PendingChangesModalProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const [proposedBy, setProposedBy] = useState(EVERYONE);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});
  const [isBusy, setIsBusy] = useState(false);
  const canDecide = useDecidableTasks(requests);
  const myVote = useMyVotes(requests);

  const visible = useMemo(
    () =>
      proposedBy === EVERYONE
        ? requests
        : requests.filter((request) => request.requestedBy === proposedBy),
    [requests, proposedBy]
  );
  const groups = useMemo(() => groupSuggestions(visible), [visible]);
  const all = useMemo(() => groupSuggestions(requests), [requests]);
  const reviewable = (suggestion: Suggestion) =>
    isOpen(suggestion.op) &&
    suggestion.request.requestedBy !== currentUser?.name &&
    canDecide(suggestion.request.taskId) &&
    !myVote(suggestion);
  // Fields with competing text edits across every request, whatever the proposed-by filter shows.
  const competingFields = new Set(
    all.filter(isCompeting).map((group) => group.field)
  );
  const allSuggestions = all.flatMap((group) => group.suggestions);
  const undecided = groups
    .flatMap((group) =>
      group.suggestions.map((suggestion) => ({ group, suggestion }))
    )
    .filter(
      ({ suggestion }) => reviewable(suggestion) && !verdicts[suggestion.id]
    );
  const acceptable = undecided.filter(
    ({ group, suggestion }) =>
      !competingFields.has(group.field) && !isConflicted(suggestion)
  );
  const counts = Object.values(verdicts);

  const decide = (suggestion: Suggestion, verdict?: Verdict) =>
    setVerdicts((current) => {
      const next = { ...current };
      const competing = isTextChange(suggestion.op)
        ? (all.find((g) => g.field === suggestion.op.field)?.suggestions ?? [])
            .filter((other) => other.id !== suggestion.id)
            .filter((other) => isTextChange(other.op) && isOpen(other.op))
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

  const decideAll = (items: { suggestion: Suggestion }[], verdict: Verdict) =>
    setVerdicts((current) => ({
      ...current,
      ...Object.fromEntries(
        items.map(({ suggestion }) => [suggestion.id, verdict])
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
  const staged = counts.filter((v) => v !== Verdict.Superseded).length;

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
            <div className="tw:mt-3 tw:flex tw:items-center tw:gap-2">
              <Typography as="span" className="tw:text-tertiary" size="text-sm">
                {t('label.proposed-by')}
              </Typography>
              <NativeSelect
                className="tw:w-56"
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
                selectClassName="tw:py-2 tw:text-sm"
                value={proposedBy}
                onChange={(event) => setProposedBy(event.target.value)}
              />
              {onSwitchView && (
                <>
                  <Button
                    color="secondary"
                    data-testid="switch-to-requests"
                    iconLeading={ListView}
                    size="sm"
                    onClick={() => onSwitchView()}>
                    {t('label.by-request')}
                  </Button>
                  <Button
                    color="secondary"
                    data-testid="open-preview"
                    iconLeading={Eye}
                    size="sm"
                    onClick={() => onSwitchView(true)}>
                    {t('label.preview-change')}
                  </Button>
                </>
              )}
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
          <div className="tw:flex tw:h-[520px] tw:flex-col tw:gap-6 tw:overflow-y-auto tw:bg-secondary tw:px-6 tw:py-5">
            <BodyIntro
              isAdmin={Boolean(currentUser?.isAdmin)}
              isEmpty={groups.length === 0}
              requests={visible}
              onChange={onChange}
            />
            {groups.map((group) => (
              <FieldSection
                canDecide={canDecide}
                group={group}
                key={group.field}
                verdicts={verdicts}
                voteOf={myVote}
                onDecide={decide}
                onWithdraw={withdraw}
              />
            ))}
          </div>
          <Dialog.Footer className="tw:mt-0 tw:flex tw:items-center tw:border-t tw:border-subtle tw:sm:mt-0">
            <Typography as="span" className="tw:text-tertiary" size="text-sm">
              {[
                t('label.accepted-count', {
                  count: counts.filter((v) => v === Verdict.Accepted).length,
                }),
                t('label.rejected-count', {
                  count: counts.filter((v) => v === Verdict.Rejected).length,
                }),
                t('label.to-review-count', {
                  count: allSuggestions.filter(
                    (s) => reviewable(s) && !verdicts[s.id]
                  ).length,
                }),
              ].join(' · ')}
            </Typography>
            <span className="tw:flex-1" />
            <Button
              color="primary"
              data-testid="submit-review"
              isDisabled={staged === 0 || isBusy}
              size="md"
              onClick={submit}>
              {staged > 0
                ? t('label.submit-review-count', { count: staged })
                : t('label.submit-review')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default ReviewPendingChangesModal;
