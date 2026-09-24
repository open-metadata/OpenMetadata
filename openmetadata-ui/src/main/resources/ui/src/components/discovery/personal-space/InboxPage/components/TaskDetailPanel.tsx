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
  Box,
  EmptyPlaceholder,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
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
import { usePermissionProvider } from '../../../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../../../context/PermissionProvider/PermissionProvider.interface';
import { Operation } from '../../../../../generated/entity/policies/accessControl/resourcePermission';
import {
  Task,
  TaskAvailableTransition,
  TaskCategory,
  TaskType,
} from '../../../../../generated/entity/tasks/task';
import { EntityReference } from '../../../../../generated/entity/teams/user';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { TaskFormSchema } from '../../../../../rest/taskFormSchemasAPI';
import {
  addTaskComment,
  getTaskById,
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
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { useApplicationsProvider } from '../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import {
  getTaskDetailDescriptor,
  resolveIncidentTestCaseFqn,
} from '../taskDetail.utils';
import {
  getTaskStatusLabel,
  isTaskPendingViewer,
} from '../taskResolution.utils';
import {
  applyActionLabels,
  buildResolveBody,
  getTaskResolveActions,
  TaskResolveAction,
} from '../taskResolve.utils';
import { getTaskTitle } from '../taskTitle.utils';
import { useTaskAboutEntity } from '../useTaskAboutEntity';
import InboxCommentComposer from './InboxCommentComposer';
import TaskActionCommentModal from './TaskActionCommentModal';
import TaskActivityTimeline from './TaskActivityTimeline';
import TaskAssetCard from './TaskAssetCard';
import TaskDetailHeader from './TaskDetailHeader';
import TaskDetailSkeleton from './TaskDetailSkeleton';
import TaskDetailSummary from './TaskDetailSummary';

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
          className="tw:text-utility-blue-dark-500 tw:no-underline! tw:font-medium! tw:hover:underline!"
          data-testid="task-about-link"
          to={aboutPath}>
          {titleText.slice(assetIndex, assetEnd)}
        </Link>
        {titleText.slice(assetEnd)}
      </>
    );
  }

  if (aboutPath) {
    // No asset token in the title — keep the whole title in normal colour
    // (still clickable), so the header never turns fully blue.
    return (
      <Link
        className="tw:text-inherit tw:no-underline! tw:hover:underline!"
        data-testid="task-about-link"
        to={aboutPath}>
        {titleText}
      </Link>
    );
  }

  return titleText;
};

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  taskId,
  fallbackTask,
  onResolved,
  onTaskUpdated,
  onCommentsChanged,
}) => {
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();
  const { currentUser } = useApplicationStore();
  const { extensionRegistry } = useApplicationsProvider();
  const [task, setTask] = useState<Task | undefined>(fallbackTask);
  const [isLoading, setIsLoading] = useState(true);
  // Gates DAR approve/reject/resolve so a self-approval deny (isTaskFiler) hides
  // the buttons. Fail closed: false until the permission resolves so a self-filed
  // DAR never flashes the buttons. Non-DAR tasks are never gated below.
  const [canResolveTask, setCanResolveTask] = useState(false);
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
      const res = await getTaskById(taskId, { fields: TASK_FIELDS });
      setTask(res.data);
      result = res.data;
    } catch (error) {
      showErrorToast(error as AxiosError);
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
  useEffect(() => {
    let active = true;
    if (!task?.id || task.type !== TaskType.DataAccessRequest) {
      setCanResolveTask(true);

      return undefined;
    }

    // Fail closed while (re)resolving so switching to a self-filed DAR can't
    // briefly show the buttons with a stale allow from the previous task.
    setCanResolveTask(false);
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

  const actions = useMemo(() => {
    if (!task || isSyncingTransitions) {
      return [];
    }
    const effective = applyActionLabels(
      getTaskResolveActions(
        task,
        { approve: t('label.approve'), reject: t('label.reject') },
        formSchema
      ),
      descriptor?.actionLabels
    ).filter((action) => !consumedTransitionIdsRef.current.has(action.id));

    // Drop resolve actions when ResolveTask is denied (self-approval); keep
    // assignee transitions — those are permissioned by EditTask, not ResolveTask.
    if (task.type === TaskType.DataAccessRequest && !canResolveTask) {
      return effective.filter(
        (action) =>
          action.kind !== 'approve' &&
          action.kind !== 'reject' &&
          action.id !== 'resolve'
      );
    }

    return effective;
  }, [task, isSyncingTransitions, canResolveTask, formSchema, descriptor, t]);

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
        const { data: fresh } = await getTaskById(taskId, {
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
          status: action.targetTaskStatus ?? updated.status,
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
      // A workflow user-task needs an assignee; reject an empty selection with
      // feedback instead of firing a no-op reassign.
      if (assignees.length === 0) {
        showErrorToast(
          t('message.field-text-is-required', {
            fieldText: t('label.assignee-plural'),
          })
        );

        return;
      }
      runTransition(action, {
        payload: { assignees },
        isAssigneeChange: true,
      });
    },
    [runTransition, t]
  );

  const handleAddComment = useCallback(
    async (message: string) => {
      if (!task || !message) {
        return;
      }
      try {
        await addTaskComment(task.id, message);
        await handleCommentMutated();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [task, handleCommentMutated]
  );

  const { about, isLoading: isAboutLoading } = useTaskAboutEntity(task);

  // The viewer's own id plus their teams': a task assigned to a team is theirs
  // to act on, so both decide whether the status reads "pending your approval".
  const currentUserIds = useMemo(
    () =>
      new Set(
        [currentUser?.id, ...(currentUser?.teams ?? []).map((team) => team.id)]
          .filter(Boolean)
          .map(String)
      ),
    [currentUser?.id, currentUser?.teams]
  );

  if (!task || !descriptor) {
    return isLoading ? (
      <TaskDetailSkeleton />
    ) : (
      <div className="tw:flex tw:h-full tw:items-center tw:justify-center tw:p-8">
        <EmptyPlaceholder
          description={t('message.no-task-found-desc')}
          title={t('label.no-task-found')}
          variant="blank"
        />
      </div>
    );
  }

  const statusBadge = getTaskStatusLabel(task, actions, currentUserIds, t);
  const isWaitingOnViewer = isTaskPendingViewer(task, actions, currentUserIds);
  // Titleless tasks (governance workflows) carry the taskId as their name, so
  // getTaskTitle composes a title from the task type and the entity it is about
  // instead of repeating the id.
  const titleText = getTaskTitle(task, t);
  // Not using Typography's `ellipsis` here: it wraps content in a pressable and
  // stringifies children, which would drop the asset Link. A plain line-clamp
  // keeps the two-row clamp while preserving the inline link.
  const title = titleText ? (
    <Typography
      className="tw:line-clamp-2 tw:break-words tw:text-left"
      size="text-lg"
      weight="semibold">
      {resolveTaskAboutTitle(task, titleText)}
    </Typography>
  ) : null;
  const LegacyPanel = contribution?.component;

  return (
    <Box
      className="tw:h-full tw:w-full tw:min-h-0"
      data-testid="task-detail-panel"
      direction="col">
      {/* Sections keep their height and the body scrolls: a flex child with
          overflow-hidden (the asset card) would otherwise shrink to nothing. */}
      <Box
        className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:*:shrink-0"
        direction="col"
        gap={5}>
        <TaskDetailHeader
          actions={actions}
          loadingTransitionId={loadingTransitionId}
          statusBadge={statusBadge}
          task={task}
          typeBadge={descriptor.typeBadge}
          onAssigneeUpdate={handleAssigneeTransition}
          onTransition={handleTransition}
        />

        <Box direction="col" gap={1}>
          {title}
          <Box align="center" gap={2}>
            <Typography className="tw:text-secondary" size="text-sm">
              {t(descriptor.subtitleKey, {
                user: getEntityName(task.createdBy),
                time: getRelativeTime(task.createdAt),
              })}
              {isWaitingOnViewer && ` · ${t('label.waiting-on-you')}`}
            </Typography>
          </Box>
        </Box>

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
            rows={descriptor.rows}
          />
        )}

        <TaskActivityTimeline
          task={task}
          onCommentChanged={handleCommentMutated}
        />
      </Box>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:pt-4"
        direction="col"
        gap={1}>
        <InboxCommentComposer onSave={handleAddComment} />
        <Box align="center" className="tw:justify-between tw:gap-2">
          <Typography className="tw:text-quaternary" size="text-xs">
            {t('message.markdown-supported-mention-hint')}
          </Typography>
          <Typography className="tw:text-quaternary" size="text-xs">
            {t('message.commenting-does-not-change-status')}
          </Typography>
        </Box>
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
