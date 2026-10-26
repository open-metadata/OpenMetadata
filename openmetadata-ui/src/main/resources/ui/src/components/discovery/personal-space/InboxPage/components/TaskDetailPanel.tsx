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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import AgentBadge from '../../../../../components/common/AgentBadge/AgentBadge';
import PermissionPlaceholder from '../../../../../components/common/EmptyPlaceholder/PermissionPlaceholder';
import SomethingWentWrongPlaceholder from '../../../../../components/common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { INCIDENT_TASK_TYPES } from '../../../../../constants/Task.constant';
import { usePermissionProvider } from '../../../../../context/PermissionProvider/PermissionProvider';
import { OperationPermission } from '../../../../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../../../../enums/Axios.enum';
import { ResourceEntity } from '../../../../../enums/permissions.enum';
import { Operation } from '../../../../../generated/entity/policies/accessControl/resourcePermission';
import {
  Task,
  TaskAvailableTransition,
  TaskCategory,
} from '../../../../../generated/entity/tasks/task';
import { EntityReference } from '../../../../../generated/entity/teams/user';
import { TaskFormSchema } from '../../../../../rest/taskFormSchemasAPI';
import {
  addTaskComment,
  getTask,
  resolveTask,
} from '../../../../../rest/tasksAPI';
import { getRelativeTime } from '../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import {
  EXTENSION_POINTS,
  InboxTaskPanelContribution,
} from '../../../../../utils/ExtensionPointTypes';
import { getPermissionErrorText } from '../../../../../utils/StringUtils';
import { getResolvedTaskFormSchema } from '../../../../../utils/TaskFormSchemaUtils';
import { getTaskAboutPath } from '../../../../../utils/TaskNavigationUtils';
import { isOntologyReviewTask } from '../../../../../utils/TaskUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import CommentComposer from '../../../../common/CommentComposer/CommentComposer';
import NoDataPlaceholder from '../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import OntologyReviewPanel from '../../../../governance/ontology/OntologyReviewPanel/OntologyReviewPanel';
import { useApplicationsProvider } from '../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { formatInboxDate, isTaskOpen } from '../inbox.utils';
import {
  getProposingAgent,
  getTaskDetailDescriptor,
  resolveIncidentTestCaseFqn,
  withExistingValues,
} from '../taskDetail.utils';
import {
  getTaskStatusBadge,
  getTaskStatusLabel,
} from '../taskResolution.utils';
import {
  applyActionLabels,
  buildResolveBody,
  getReassignBlocker,
  getTaskResolveActions,
  TaskResolveAction,
} from '../taskResolve.utils';
import { getTaskTitleParts } from '../taskTitle.utils';
import { useCurrentUserIds } from '../useCurrentUserIds';
import { useIsScrolled } from '../useIsScrolled';
import { useTaskAboutEntity } from '../useTaskAboutEntity';
import TaskActionCommentModal from './TaskActionCommentModal';
import TaskActivityTimeline from './TaskActivityTimeline';
import TaskAssetCard from './TaskAssetCard';
import TaskDetailHeader from './TaskDetailHeader';
import TaskDetailSkeleton from './TaskDetailSkeleton';
import TaskDetailSummary from './TaskDetailSummary';
import TaskTitle from './TaskTitle';

const TASK_FIELDS =
  'about,createdBy,reviewers,assignees,resolution,approvedBy,approvedAt,availableTransitions,payload,comments';

// A resolve returns before the workflow engine has advanced the task, so it
// keeps echoing the transition just consumed. Re-read until that transition is
// gone — the next stage's actions (Approve → Mark as granted) are then real.
//
// Two attempts, not a long backoff chain: the engine advances well inside a
// second in practice, so a longer tail cost up to 6 reads of the full task per
// action for a case that almost never happens. If it still has not advanced,
// the consumed transition simply stays hidden (never re-firable) and the
// route-activation revalidation picks the task up on the next visit or refocus.
const TRANSITION_SYNC_INTERVALS_MS = [1000, 3000];

export interface TaskDetailPanelProps {
  taskId: string;
  // The list row, used as header fallback while the full task loads.
  fallbackTask?: Task;
  // Fired when a transition is applied and the task may leave its bucket.
  onResolved?: (task: Task) => void;
  // Fired for assignee changes — the task stays open but may leave the current
  // user's visible set, so the list should re-sync with the server.
  onTaskUpdated?: (task: Task) => void;
  // Fired after a comment is added/edited/deleted with the reloaded task, so the
  // list row's comment count stays in sync.
  onCommentsChanged?: (task: Task) => void;
}

// Locate the whitespace-delimited token in the title that contains the asset
// name — requiring the name to start the token (title start or after
// whitespace), then extending to the end of that token. This links the whole
// identifier consistently: "dim_address_clean" and "dim_address_clean_changed"
// both highlight as one token, while a bare "1" inside "TASK-19586" (not at a
// token start) is left alone so the whole title links instead.
const matchAssetToken = (
  title: string,
  candidate: string
): { index: number; length: number } | null => {
  const isSpace = (char: string | undefined) =>
    char !== undefined && /\s/.test(char);
  let index = title.indexOf(candidate);
  while (index >= 0) {
    if (index === 0 || isSpace(title[index - 1])) {
      let end = index + candidate.length;
      while (end < title.length && !isSpace(title[end])) {
        end++;
      }

      return { index, length: end - index };
    }
    index = title.indexOf(candidate, index + 1);
  }

  return null;
};

// The title reads as plain text in the heading's font and colour; only the
// hover underline says it links to the asset. `!` beats the legacy
// `.prose-typography a` rule (fonts.less), which makes Typography's links 14px
// and blue.
const TITLE_LINK_CLASS =
  'tw:[font:inherit]! tw:text-inherit! tw:no-underline! tw:hover:underline!';

interface AssetSpan {
  index: number;
  end: number;
}

// Locates the title token (display name, raw name, or last FQN segment) that
// carries the asset, so both "…dim_address_clean" and
// "…dim_address_clean_changed" colour the whole trailing identifier.
const computeAssetSpan = (
  task: Task,
  titleText: string,
  aboutPath: string,
  incidentTestCaseFqn: string
): AssetSpan => {
  if (!aboutPath) {
    return { index: -1, end: -1 };
  }

  const aboutRef = task.about;
  const assetCandidates = aboutRef
    ? [
        getEntityName(aboutRef),
        aboutRef.name,
        aboutRef.fullyQualifiedName?.split('.').pop(),
      ]
    : [incidentTestCaseFqn.split('.').pop()];
  const assetMatch = assetCandidates
    .map((candidate) =>
      candidate ? matchAssetToken(titleText, candidate) : null
    )
    .find((match) => match);

  return assetMatch
    ? { index: assetMatch.index, end: assetMatch.index + assetMatch.length }
    : { index: -1, end: -1 };
};

/**
 * The task title with its asset token (or the whole title, if no token is
 * found) turned into a link to the about entity's Activity Feed → Tasks tab —
 * or, for an incident with no `about`, the derived test case's Issues tab.
 */
const resolveTaskAboutTitle = (task: Task, titleText: string): ReactNode => {
  const incidentTestCaseFqn = resolveIncidentTestCaseFqn(task);
  const aboutPath = getTaskAboutPath(task, incidentTestCaseFqn);
  const { index: assetIndex, end: assetEnd } = computeAssetSpan(
    task,
    titleText,
    aboutPath,
    incidentTestCaseFqn
  );

  if (assetIndex >= 0) {
    return (
      <>
        {titleText.slice(0, assetIndex)}
        <Link
          className={TITLE_LINK_CLASS}
          data-testid="task-about-link"
          to={aboutPath}>
          {titleText.slice(assetIndex, assetEnd)}
        </Link>
        {titleText.slice(assetEnd)}
      </>
    );
  }

  if (aboutPath) {
    // No asset token in the title: the whole title links to the asset.
    return (
      <Link
        className={TITLE_LINK_CLASS}
        data-testid="task-about-link"
        to={aboutPath}>
        {titleText}
      </Link>
    );
  }

  return titleText;
};

// Marks where the requester sits in a translated byline, whatever the language's word order.
const REQUESTER_SLOT = '\u0000';

/** "Opened by <agent> 2 minutes ago", with the AI agent's badge where a person's name would be. */
const AgentByline: React.FC<{
  agent: string;
  task: Task;
  subtitleKey: string;
}> = ({ agent, task, subtitleKey }) => {
  const { t } = useTranslation();
  const [before, after] = t(subtitleKey, {
    user: REQUESTER_SLOT,
    time: getRelativeTime(task.createdAt),
  }).split(REQUESTER_SLOT);

  return (
    <Box align="center" data-testid="task-byline" gap={1} wrap="wrap">
      {before.trim() && (
        <Typography className="tw:text-tertiary" size="text-sm">
          {before.trim()}
        </Typography>
      )}
      <AgentBadge name={agent} />
      {after?.trim() && (
        <Typography className="tw:text-tertiary" size="text-sm">
          {after.trim()}
        </Typography>
      )}
    </Box>
  );
};

/** Who raised the task and when, led by their avatar. */
const TaskByline: React.FC<{ task: Task; subtitleKey: string }> = ({
  task,
  subtitleKey,
}) => {
  const { t } = useTranslation();
  // A closed task reads as its outcome — "Rejected by harsh.soni on Jul 21,
  // 2026" — led by whoever decided it, rather than by its request.
  const resolver = isTaskOpen(task) ? undefined : task.resolution?.resolvedBy;
  const agent = resolver ? undefined : getProposingAgent(task, t);
  const person = resolver ?? task.createdBy;
  const text = resolver
    ? t('message.task-outcome-by-on', {
        status: getTaskStatusBadge(task, t)?.label,
        user: getEntityName(resolver),
        date: formatInboxDate(task.resolution?.resolvedAt),
      })
    : t(subtitleKey, {
        user: getEntityName(task.createdBy),
        time: getRelativeTime(task.createdAt),
      });

  if (agent) {
    return <AgentByline agent={agent} subtitleKey={subtitleKey} task={task} />;
  }

  return (
    <Box align="center" gap={2}>
      {person && (
        <ProfilePicture
          matchRingToFill
          displayName={getEntityName(person)}
          name={person.name ?? ''}
          width="20"
        />
      )}
      <Typography className="tw:text-tertiary" size="text-sm">
        {text}
      </Typography>
    </Box>
  );
};

// A filer is denied their own task (self-approval); anyone else is not one of
// its approvers.
const TaskResolveDeniedHint = ({ isFiler }: { isFiler: boolean }) => {
  const { t } = useTranslation();

  return (
    <Typography
      className="tw:text-tertiary"
      data-testid="task-resolve-denied-hint"
      size="text-sm">
      {isFiler
        ? t('message.no-permission-for-action')
        : t('message.only-reviewers-can-approve-or-reject')}
    </Typography>
  );
};

/** Why no task shows: only a 404 means it is gone; anything else failed to load. */
const TaskUnavailable = ({
  error,
  onRetry,
}: {
  error?: AxiosError;
  onRetry: () => void;
}) => {
  const { t } = useTranslation();
  const status = error?.response?.status;
  let placeholder = (
    <SomethingWentWrongPlaceholder
      description={t('server.entity-fetch-error', { entity: t('label.task') })}
      onReload={onRetry}
    />
  );
  if (!error || status === ClientErrors.NOT_FOUND) {
    placeholder = (
      <NoDataPlaceholder
        data-testid="task-not-found"
        description={t('message.no-task-found-desc')}
        title={t('label.no-task-found')}
      />
    );
  } else if (status === ClientErrors.FORBIDDEN) {
    placeholder = (
      <PermissionPlaceholder
        permissionValue={t('label.view-entity', { entity: t('label.task') })}
      />
    );
  }

  return (
    <div className="tw:flex tw:h-full tw:items-center tw:justify-center tw:p-8">
      {placeholder}
    </div>
  );
};

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  taskId,
  fallbackTask,
  onResolved,
  onTaskUpdated,
  onCommentsChanged,
}) => {
  const { t } = useTranslation();
  const { isScrolled: isBodyScrolled, onScroll: onBodyScroll } =
    useIsScrolled();
  const { getEntityPermission } = usePermissionProvider();
  const { extensionRegistry } = useApplicationsProvider();
  const [task, setTask] = useState<Task | undefined>(fallbackTask);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<AxiosError>();
  // A failed first load renders its own placeholder; only a failed reload of a
  // task already on screen needs the toast.
  const hasTaskRef = useRef(Boolean(fallbackTask));
  hasTaskRef.current = Boolean(task);
  const [readyReviewTask, setReadyReviewTask] = useState<string>();
  const handleReviewReady = useCallback(
    (ready: boolean) => {
      setReadyReviewTask(ready ? task?.id : undefined);
    },
    [task?.id]
  );
  // The task id whose full record has loaded. The list row the panel opens with
  // lacks availableTransitions, so actions wait for it — but only the first
  // time: a reload after a comment keeps the buttons and status steady.
  const [loadedTaskId, setLoadedTaskId] = useState<string>();
  // Gates approve/reject/resolve on the server's ResolveTask verdict (assignee,
  // reviewer, owner; self-approval denied). Fail closed: undefined until the
  // permission resolves so the buttons never flash for a user who can't act.
  const [canResolveTask, setCanResolveTask] = useState<boolean>();
  const [loadingTransitionId, setLoadingTransitionId] = useState<string>();
  // Actions stay hidden while re-reading, so a consumed transition can't be
  // re-submitted — that hits a workflow with no active task (500).
  const [isSyncingTransitions, setIsSyncingTransitions] = useState(false);
  const consumedTransitionIdsRef = useRef<Set<string>>(new Set());
  // Bumped to invalidate an in-flight sync (unmount, or a newer transition).
  const syncRunRef = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [commentAction, setCommentAction] = useState<TaskResolveAction>();
  const [formSchema, setFormSchema] = useState<TaskFormSchema>();

  const loadTask = useCallback(async () => {
    setIsLoading(true);
    let result: Task | undefined;
    try {
      const res = await getTask(taskId, { fields: TASK_FIELDS });
      setTask(res.data);
      setLoadedTaskId(taskId);
      setLoadError(undefined);
      result = res.data;
    } catch (error) {
      setLoadError(error as AxiosError);
      if (hasTaskRef.current) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      setIsLoading(false);
    }

    return result;
  }, [taskId]);

  // Reload the task, then notify the list so its comment-count badge re-syncs.
  const handleCommentMutated = useCallback(async () => {
    const updated = await loadTask();
    if (updated) {
      onCommentsChanged?.(updated);
    }
  }, [loadTask, onCommentsChanged]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  // The endpoint evaluates policy conditions (isTaskFiler) against this task, so
  // a requester who is also an assignee resolves false on their own request.
  // Incident tasks are exempt: the server lets EditStatus/EditTests on the test
  // case resolve them even when ResolveTask on the task is denied.
  useEffect(() => {
    let active = true;
    if (!task?.id || INCIDENT_TASK_TYPES.has(task.type)) {
      setCanResolveTask(true);

      return undefined;
    }

    // Fail closed while (re)resolving so switching to a self-filed DAR can't
    // briefly show the buttons with a stale allow from the previous task.
    setCanResolveTask(undefined);
    getEntityPermission(ResourceEntity.TASK, task.id)
      .then(
        (perm: OperationPermission) =>
          active && setCanResolveTask(Boolean(perm[Operation.ResolveTask]))
      )
      .catch(() => active && setCanResolveTask(false));

    return () => {
      active = false;
    };
  }, [getEntityPermission, task?.id, task?.type]);

  // A task the workflow engine never touched resolves through the legacy path,
  // whose newValue comes from the type's form schema (resolution is cached per
  // type+category, so switching between tasks of one type refetches nothing).
  const isLegacyTask = Boolean(task) && !task?.availableTransitions?.length;
  const taskType = task?.type;
  const taskCategory = task?.category;

  useEffect(() => {
    let active = true;
    if (!isLegacyTask || !taskType || !taskCategory) {
      setFormSchema(undefined);

      return undefined;
    }

    getResolvedTaskFormSchema(taskType, taskCategory)
      .then((schema) => active && setFormSchema(schema))
      // Without a schema the per-type defaults still produce a correct body.
      .catch(() => active && setFormSchema(undefined));

    return () => {
      active = false;
    };
  }, [isLegacyTask, taskType, taskCategory]);

  // A plugin can refine how a task type it owns renders — its summary rows, its
  // stat tiles — without owning the pane. The first matching contribution wins.
  const contribution = useMemo(
    () =>
      task
        ? extensionRegistry
            .getContributions<InboxTaskPanelContribution>(
              EXTENSION_POINTS.INBOX_TASK_PANELS
            )
            .find((panel) => panel.condition(task))
        : undefined,
    [extensionRegistry, task]
  );

  const descriptor = useMemo(
    () =>
      task
        ? getTaskDetailDescriptor(task, t, contribution?.describe?.(task, t))
        : undefined,
    [task, contribution, t]
  );

  // Actions wait for the full task: from the list row alone a workflow task
  // would offer the legacy resolve path.
  const hasFullTask = loadedTaskId === taskId;
  const { actions, isResolveDenied } = useMemo(() => {
    if (!task || !hasFullTask || isSyncingTransitions) {
      return { actions: [], isResolveDenied: false };
    }
    const effective = applyActionLabels(
      getTaskResolveActions(
        task,
        { approve: t('label.approve'), reject: t('label.reject') },
        formSchema
      ),
      descriptor?.actionLabels
    ).filter((action) => !consumedTransitionIdsRef.current.has(action.id));

    // Drop resolve actions when ResolveTask is denied; keep assignee
    // transitions — those are permissioned by EditTask, not ResolveTask.
    if (!canResolveTask) {
      const permitted = effective.filter(
        (action) =>
          action.kind !== 'approve' &&
          action.kind !== 'reject' &&
          action.id !== 'resolve'
      );

      return {
        actions: permitted,
        isResolveDenied:
          canResolveTask === false && permitted.length < effective.length,
      };
    }

    return {
      actions:
        isOntologyReviewTask(task) && readyReviewTask !== task.id
          ? effective.filter(
              (action) => action.kind !== 'approve' && action.kind !== 'reject'
            )
          : effective,
      isResolveDenied: false,
    };
  }, [
    readyReviewTask,
    task,
    hasFullTask,
    isSyncingTransitions,
    canResolveTask,
    formSchema,
    descriptor,
    t,
  ]);

  // Stop an in-flight sync on unmount: no state set, no timer left behind.
  useEffect(
    () => () => {
      syncRunRef.current += 1;
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    },
    []
  );

  /**
   * Re-read the task until the workflow moves past {@code consumedId}, then show
   * the next stage's actions without a page reload. If it never advances within
   * the polling window the consumed transition stays hidden, never re-firable.
   */
  const syncTransitionsAfter = useCallback(
    async (consumedId: string) => {
      const run = syncRunRef.current + 1;
      syncRunRef.current = run;
      const isStale = () => syncRunRef.current !== run;

      // One re-read after `delayMs`. True once the engine has moved past the
      // consumed transition, which ends the sync.
      const hasAdvanced = async (delayMs: number): Promise<boolean> => {
        await new Promise((resolve) => {
          syncTimerRef.current = setTimeout(resolve, delayMs);
        });
        if (isStale()) {
          return true;
        }
        const { data: fresh } = await getTask(taskId, {
          fields: TASK_FIELDS,
        });
        if (isStale()) {
          return true;
        }
        const stillEchoed = (fresh.availableTransitions ?? []).some(
          (transition: TaskAvailableTransition) => transition.id === consumedId
        );
        if (stillEchoed) {
          return false;
        }
        consumedTransitionIdsRef.current.delete(consumedId);
        setTask(fresh);

        return true;
      };

      setIsSyncingTransitions(true);
      try {
        // Two attempts, written out rather than looped: this polls one task for
        // a state change, which is not the per-item fetching a loop would imply.
        if (await hasAdvanced(TRANSITION_SYNC_INTERVALS_MS[0])) {
          return;
        }
        await hasAdvanced(TRANSITION_SYNC_INTERVALS_MS[1]);
      } catch {
        // Keep the consumed transition hidden; the task itself still renders.
      } finally {
        if (!isStale()) {
          setIsSyncingTransitions(false);
        }
      }
    },
    [taskId]
  );

  const runTransition = useCallback(
    async (
      action: TaskResolveAction,
      extras?: {
        comment?: string;
        payload?: Record<string, unknown>;
        isAssigneeChange?: boolean;
      }
    ) => {
      if (!task) {
        return;
      }
      setLoadingTransitionId(action.id);
      try {
        const updated = await resolveTask(
          task.id,
          buildResolveBody(action, task, extras, formSchema)
        );
        // The workflow advances asynchronously, so the resolve response can echo
        // the pre-transition status. Stamp the authoritative post-transition status
        // (transition.targetTaskStatus) so the list can decide whether the task
        // leaves the current filter (e.g. a Rejected DAR drops; an Approved DAR or
        // an in-progress revoke stays Open). A legacy action declares none, so the
        // server response is authoritative there.
        const resolved = {
          ...updated,
          // Native review responses retain Open until the approval threshold is met.
          status: isOntologyReviewTask(task)
            ? updated.status
            : action.targetTaskStatus ?? updated.status,
        };
        consumedTransitionIdsRef.current.add(action.id);
        setTask(resolved);
        setCommentAction(undefined);
        if (extras?.isAssigneeChange) {
          onTaskUpdated?.(resolved);
        } else {
          onResolved?.(resolved);
        }
        // Only a workflow transition can be echoed back by a lagging engine.
        if (action.transition) {
          void syncTransitionsAfter(action.id);
        }
      } catch (error) {
        // Surface the backend's permission message (e.g. a denied ResolveTask).
        showErrorToast(
          error as AxiosError,
          getPermissionErrorText(
            error as AxiosError,
            t('message.something-went-wrong')
          )
        );
      } finally {
        setLoadingTransitionId(undefined);
      }
    },
    [task, formSchema, onResolved, onTaskUpdated, syncTransitionsAfter, t]
  );

  const handleTransition = useCallback(
    (action: TaskResolveAction) => () => {
      if (action.requiresComment) {
        setCommentAction(action);

        return;
      }
      runTransition(action);
    },
    [runTransition]
  );

  // The backend reads payload.assignees, persists them and routes the workflow
  // user task (TaskWorkflowHandler.extractAssigneesFromPayload).
  const handleAssigneeTransition = useCallback(
    (action: TaskResolveAction) => (updated?: EntityReference[]) => {
      const assignees = (updated ?? []).map(
        ({ id, type, name, displayName }) => ({
          id,
          type,
          name,
          displayName,
        })
      );
      // A reassign that would leave the task unassigned, or assigned to the
      // same people, says why instead of reaching the workflow.
      const blocker = getReassignBlocker(task?.assignees ?? [], assignees, t);
      if (blocker) {
        showErrorToast(blocker);

        return;
      }
      runTransition(action, {
        payload: { assignees },
        isAssigneeChange: true,
      });
    },
    [runTransition, t, task?.assignees]
  );

  const handleAddComment = useCallback(
    async (message: string) => {
      if (!task || !message) {
        return;
      }
      // A refused comment rejects, so the composer puts the draft back; the
      // refresh after a saved one does not.
      try {
        await addTaskComment(task.id, message);
      } catch (error) {
        showErrorToast(error as AxiosError);

        throw error;
      }
      await handleCommentMutated();
    },
    [task, handleCommentMutated]
  );

  const { about, isLoading: isAboutLoading } = useTaskAboutEntity(task);

  const currentUserIds = useCurrentUserIds();

  if (!task || !descriptor) {
    return isLoading ? (
      <TaskDetailSkeleton />
    ) : (
      <TaskUnavailable error={loadError} onRetry={loadTask} />
    );
  }

  const statusBadge = getTaskStatusLabel(task, currentUserIds, t);
  // Titleless tasks (governance workflows) carry the taskId as their name, so
  // getTaskTitleParts composes a title from the task type and the entity it is about
  // instead of repeating the id.
  const { title: titleText, entityType: titleEntityType } = getTaskTitleParts(
    task,
    t
  );
  // Two lines, the full title in a tooltip when clamped; see ClampedText for
  // why Typography's own `ellipsis` cannot hold the inline asset link.
  const title = titleText ? (
    <TaskTitle entityType={titleEntityType} size="text-md" text={titleText}>
      <Typography size="text-md" weight="medium">
        {resolveTaskAboutTitle(task, titleText)}
      </Typography>
    </TaskTitle>
  ) : null;
  const LegacyPanel = contribution?.component;
  const renderDetails = () => {
    if (isOntologyReviewTask(task)) {
      return (
        <OntologyReviewPanel task={task} onReadyChange={handleReviewReady} />
      );
    }

    return (
      <>
        <TaskAssetCard
          StatTiles={contribution?.stats}
          about={about}
          isLoading={isAboutLoading}
          task={task}
        />
        {LegacyPanel ? (
          <LegacyPanel id={task.id} task={task} />
        ) : (
          <TaskDetailSummary
            callout={descriptor.callout}
            change={withExistingValues(descriptor.change, task, about?.entity)}
            rows={descriptor.rows}
          />
        )}
      </>
    );
  };

  return (
    <Box
      className="tw:h-full tw:w-full tw:min-h-0"
      data-testid="task-detail-panel"
      direction="col">
      {/* Lifts off the body with a light shadow once it scrolls under it. */}
      <Box
        className={classNames(
          'tw:relative tw:z-10 tw:shrink-0 tw:border-b tw:border-secondary tw:px-6 tw:py-5 tw:transition-shadow',
          isBodyScrolled && 'tw:shadow-sm'
        )}
        direction="col">
        <TaskDetailHeader
          actions={actions}
          loadingTransitionId={loadingTransitionId}
          statusBadge={statusBadge}
          task={task}
          typeBadge={descriptor.typeBadge}
          onAssigneeUpdate={handleAssigneeTransition}
          onTransition={handleTransition}
        />

        <Box direction="col" gap={2}>
          {title}
          <TaskByline subtitleKey={descriptor.subtitleKey} task={task} />
          {isResolveDenied && (
            <TaskResolveDeniedHint
              isFiler={currentUserIds.has(task.createdBy?.id)}
            />
          )}
        </Box>
      </Box>

      {/* Sections keep their height and the body scrolls: a flex child with
          overflow-hidden (the asset card) would otherwise shrink to nothing. */}
      <Box
        className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-7 tw:pt-6 tw:pb-12 tw:*:shrink-0"
        direction="col"
        gap={6}
        onScroll={onBodyScroll}>
        {renderDetails()}

        <TaskActivityTimeline
          createdEvent={descriptor.createdEvent}
          incidentStatuses={about?.incidentStatuses}
          task={task}
          onCommentChanged={handleCommentMutated}
        />
      </Box>

      <Box
        className="tw:relative tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-6 tw:py-4 tw:dark:bg-secondary"
        direction="col"
        gap={2}>
        {/* A soft fade into the card above the footer, so the activity reads
            as scrolling under the composer rather than stopping at a line. The
            body's bottom padding clears it, so nothing sits under it at rest. */}
        <span
          aria-hidden
          className="tw:pointer-events-none tw:absolute tw:inset-x-0 tw:bottom-full tw:h-8 tw:bg-linear-to-t tw:from-bg-surface tw:to-transparent"
        />
        <CommentComposer onSave={handleAddComment} />
      </Box>

      <TaskActionCommentModal
        actionLabel={commentAction?.label ?? t('label.submit')}
        isLoading={loadingTransitionId !== undefined}
        open={commentAction !== undefined}
        requiredMessage={t('message.field-text-is-required', {
          fieldText: t('label.comment'),
        })}
        // Incident resolutions carry a Root Cause the backend stores as
        // testCaseFailureReason (IncidentTcrsSyncHandler).
        showRootCause={task.category === TaskCategory.Incident}
        title={commentAction?.label ?? t('label.comment')}
        onCancel={() => setCommentAction(undefined)}
        onConfirm={({ comment, rootCause }) =>
          commentAction &&
          runTransition(commentAction, {
            comment,
            ...(rootCause
              ? { payload: { testCaseFailureReason: rootCause } }
              : {}),
          })
        }
      />
    </Box>
  );
};

export default TaskDetailPanel;
