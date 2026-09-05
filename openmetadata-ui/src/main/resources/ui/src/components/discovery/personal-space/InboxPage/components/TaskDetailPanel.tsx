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
  Box,
  Button,
  EmptyPlaceholder,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckCircle, Edit01, Trash01, XCircle } from '@untitledui/icons';
import { AxiosError } from 'axios';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ActivityFeedEditorNew from '../../../../../components/ActivityFeed/ActivityFeedEditor/ActivityFeedEditorNew';
import DeleteModal from '../../../../../components/common/DeleteModal/DeleteModal';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { UserTeamSelectableList } from '../../../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
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
import { TestCasePageTabs } from '../../../../../pages/IncidentManager/IncidentManager.interface';
import { TaskFormSchema } from '../../../../../rest/taskFormSchemasAPI';
import {
  addTaskComment,
  deleteTaskComment,
  editTaskComment,
  getTaskById,
  resolveTask,
  TaskComment,
} from '../../../../../rest/tasksAPI';
import { getRelativeTime } from '../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import {
  getFrontEndFormat,
  MarkdownToHTMLConverter,
} from '../../../../../utils/FeedUtilsPure';
import { getTestCaseDetailPagePath } from '../../../../../utils/RouterUtils';
import { getPermissionErrorText } from '../../../../../utils/StringUtils';
import { getResolvedTaskFormSchema } from '../../../../../utils/TaskFormSchemaUtils';
import { getTaskDetailPathFromTask } from '../../../../../utils/TaskNavigationUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { getTaskStatusBadge } from '../taskResolution.utils';
import {
  buildResolveBody,
  getTaskResolveActions,
  TaskResolveAction,
} from '../taskResolve.utils';
import { getTaskTitle } from '../taskTitle.utils';
import InboxCommentComposer from './InboxCommentComposer';
import TaskActionCommentModal from './TaskActionCommentModal';
import TaskActivityTimeline from './TaskActivityTimeline';
import TaskDetailSkeleton from './TaskDetailSkeleton';
import TaskOverview from './TaskOverview';

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

interface TaskCommentRowProps {
  comment: TaskComment;
  taskId: string;
  // Reload the task after an edit or delete so the comment list stays in sync.
  onChanged: () => void;
}

/**
 * A single task comment with author, message and timestamp. The comment's author
 * can edit or delete it (admins can also delete); the actions surface on hover.
 * Mirrors the activity-drawer CommentRow, but drives the task comment endpoints.
 */
const TaskCommentRow: React.FC<TaskCommentRowProps> = ({
  comment,
  taskId,
  onChanged,
}) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const authorName = getEntityName(comment.author);

  const isAuthor =
    Boolean(currentUser?.name) && comment.author?.name === currentUser?.name;
  const canEdit = isAuthor;
  const canDelete = isAuthor || Boolean(currentUser?.isAdmin);
  const canModifyComment = canEdit || canDelete;

  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditSave = useCallback(
    async (message: string) => {
      if (!message) {
        return;
      }
      try {
        await editTaskComment(taskId, comment.id, message);
        setIsEditing(false);
        onChanged();
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [taskId, comment.id, onChanged]
  );

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await deleteTaskComment(taskId, comment.id);
      setShowDeleteDialog(false);
      onChanged();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDeleting(false);
    }
  }, [taskId, comment.id, onChanged]);

  return (
    <Box
      className="tw:relative"
      data-testid="task-comment-card"
      direction="col"
      gap={2}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <Box align="center" className="tw:justify-between" gap={2}>
        <Box align="center" gap={2}>
          <ProfilePicture
            displayName={authorName}
            name={comment.author?.name ?? ''}
            width="28"
          />
          <Typography size="text-sm" weight="semibold">
            {authorName}
          </Typography>
        </Box>
        {isHovered && !isEditing && canModifyComment && (
          <Box align="center" data-testid="task-comment-actions" gap={1}>
            {canEdit && (
              <Edit01
                className="tw:cursor-pointer tw:text-secondary"
                data-testid="edit-task-comment"
                height={16}
                width={16}
                onClick={() => setIsEditing(true)}
              />
            )}
            {canDelete && (
              <Trash01
                className="tw:cursor-pointer tw:text-error-primary"
                data-testid="delete-task-comment"
                height={16}
                width={16}
                onClick={() => setShowDeleteDialog(true)}
              />
            )}
          </Box>
        )}
      </Box>
      {isEditing ? (
        <Box data-testid="edit-task-comment-editor" direction="col" gap={2}>
          <ActivityFeedEditorNew
            focused
            defaultValue={MarkdownToHTMLConverter.makeHtml(
              getFrontEndFormat(comment.message)
            )}
            onSave={handleEditSave}
          />
          <Box align="center" className="tw:justify-end">
            <Button
              color="link-gray"
              data-testid="cancel-edit-task-comment"
              size="sm"
              onPress={() => setIsEditing(false)}>
              {t('label.cancel')}
            </Button>
          </Box>
        </Box>
      ) : (
        <Box className="tw:rounded-lg tw:border tw:border-utility-gray-blue-100 tw:bg-utility-gray-blue-50 tw:px-4 tw:py-3">
          <RichTextEditorPreviewerV1
            className="inbox-feed-message tw:text-sm"
            markdown={getFrontEndFormat(comment.message)}
          />
        </Box>
      )}
      <Typography className="tw:text-secondary" size="text-xs">
        {getRelativeTime(comment.createdAt)}
      </Typography>

      <DeleteModal
        entityTitle={t('label.comment')}
        isDeleting={isDeleting}
        message={t('message.confirm-delete-message')}
        open={showDeleteDialog}
        onCancel={() => setShowDeleteDialog(false)}
        onDelete={handleDelete}
      />
    </Box>
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
  const { getEntityPermission } = usePermissionProvider();
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

  const actions = useMemo(() => {
    if (!task || isSyncingTransitions) {
      return [];
    }
    const effective = getTaskResolveActions(
      task,
      { approve: t('label.approve'), reject: t('label.reject') },
      formSchema
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
  }, [task, isSyncingTransitions, canResolveTask, formSchema, t]);

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
      setIsSyncingTransitions(true);
      try {
        for (const interval of TRANSITION_SYNC_INTERVALS_MS) {
          await new Promise((resolve) => {
            syncTimerRef.current = setTimeout(resolve, interval);
          });
          if (isStale()) {
            return;
          }
          const { data: fresh } = await getTaskById(taskId, {
            fields: TASK_FIELDS,
          });
          if (isStale()) {
            return;
          }
          const stillEchoed = (fresh.availableTransitions ?? []).some(
            (transition: TaskAvailableTransition) =>
              transition.id === consumedId
          );
          if (!stillEchoed) {
            consumedTransitionIdsRef.current.delete(consumedId);
            setTask(fresh);

            return;
          }
        }
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

  if (!task) {
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

  const comments = [...(task.comments ?? [])].sort(
    (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
  );
  const statusBadge = getTaskStatusBadge(task, t);
  // Titleless tasks (governance workflows) carry the taskId as their name, so
  // getTaskTitle composes a title from the task type and the entity it is about
  // instead of repeating the id.
  const titleText = getTaskTitle(task, t);
  const aboutRef = task.about;
  // Incident tasks carry no `about`; the failing test case FQN only appears in
  // the description ("New incident for test case: <fqn>") as the trailing token.
  const incidentTestCaseFqn =
    !aboutRef?.fullyQualifiedName && task.category === TaskCategory.Incident
      ? (task.description ?? '').trim().split(/\s+/).pop() ?? ''
      : '';
  // getTaskDetailPathFromTask maps the about entity to its Activity Feed → Tasks
  // tab, honouring per-type routes (glossaryTerm → /glossary, testCase, user, …).
  // Incidents fall back to the derived test case's Issues tab.
  const incidentPath = incidentTestCaseFqn.includes('.')
    ? getTestCaseDetailPagePath(incidentTestCaseFqn, TestCasePageTabs.ISSUES)
    : '';
  const aboutPath = aboutRef?.fullyQualifiedName
    ? getTaskDetailPathFromTask(task)
    : incidentPath;
  // Highlight the title token (display name, raw name, or last FQN segment)
  // that carries the asset, so both "…dim_address_clean" and
  // "…dim_address_clean_changed" colour the whole trailing identifier.
  const assetCandidates = aboutRef
    ? [
        getEntityName(aboutRef),
        aboutRef.name,
        aboutRef.fullyQualifiedName?.split('.').pop(),
      ]
    : [incidentTestCaseFqn.split('.').pop()];
  const assetMatch = aboutPath
    ? assetCandidates
        .map((candidate) =>
          candidate ? matchAssetToken(titleText, candidate) : null
        )
        .find((match) => match)
    : null;
  const assetIndex = assetMatch?.index ?? -1;
  const assetEnd = assetMatch ? assetMatch.index + assetMatch.length : -1;
  // No asset token in the title — keep the whole title in normal colour
  // (still clickable), so the header never turns fully blue.
  const plainTitleNode = aboutPath ? (
    <Link
      className="tw:text-inherit tw:no-underline! tw:hover:underline!"
      data-testid="task-about-link"
      to={aboutPath}>
      {titleText}
    </Link>
  ) : (
    titleText
  );
  const titleNode =
    assetIndex >= 0 ? (
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
    ) : (
      plainTitleNode
    );
  // Not using Typography's `ellipsis` here: it wraps content in a pressable and
  // stringifies children, which would drop the asset Link. A plain line-clamp
  // keeps the two-row clamp while preserving the inline link.
  const title = titleText ? (
    <Typography
      className="tw:line-clamp-2 tw:break-words tw:text-left"
      size="text-lg"
      weight="semibold">
      {titleNode}
    </Typography>
  ) : null;

  return (
    <Box
      className="tw:h-full tw:w-full"
      data-testid="task-detail-panel"
      direction="col"
      gap={4}>
      <Box align="start" className="tw:justify-between tw:gap-3">
        <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={1}>
          <Box align="center" gap={2}>
            <Typography className="tw:text-secondary" size="text-xs">
              {`#${task.taskId ?? ''}`}
            </Typography>
            {statusBadge && (
              <Badge
                color={statusBadge.tone}
                data-testid="task-status-badge"
                size="sm"
                type="color">
                {statusBadge.label}
              </Badge>
            )}
          </Box>
          {title}
        </Box>
        <Box align="center" className="tw:shrink-0" gap={2}>
          {actions.map((action) => {
            const approve = action.kind === 'approve';
            const reject = action.kind === 'reject';
            const isBusy = loadingTransitionId === action.id;
            const isDisabled =
              loadingTransitionId !== undefined &&
              loadingTransitionId !== action.id;

            // Native button trigger: the AntD Popover injects onClick via
            // cloneElement, which the react-aria Button would swallow.
            if (action.kind === 'assignee') {
              return (
                <UserTeamSelectableList
                  hasPermission
                  key={action.id}
                  label={t('label.assignee-plural')}
                  multiple={{ user: false, team: false }}
                  owner={task.assignees ?? []}
                  onUpdate={handleAssigneeTransition(action)}>
                  <button
                    className={
                      'tw:cursor-pointer tw:rounded-md tw:border tw:border-secondary ' +
                      'tw:bg-primary tw:px-3 tw:py-1.5 tw:text-sm tw:font-semibold ' +
                      'tw:text-secondary tw:shadow-xs tw:hover:bg-secondary ' +
                      'tw:disabled:cursor-not-allowed tw:disabled:opacity-50'
                    }
                    data-testid={`task-transition-${action.id}`}
                    disabled={isDisabled || isBusy}
                    type="button">
                    {action.label}
                  </button>
                </UserTeamSelectableList>
              );
            }

            const nonRejectColor =
              approve || action.id === 'resolve' ? 'primary' : 'secondary';
            const buttonColor = reject
              ? 'secondary-destructive'
              : nonRejectColor;
            const nonApproveTestId = reject
              ? 'task-reject'
              : `task-transition-${action.id}`;
            const buttonTestId = approve ? 'task-approve' : nonApproveTestId;
            const nonApproveIcon = reject ? (
              <XCircle height={16} width={16} />
            ) : undefined;
            const buttonIcon = approve ? (
              <CheckCircle height={16} width={16} />
            ) : (
              nonApproveIcon
            );

            return (
              <Button
                color={buttonColor}
                data-testid={buttonTestId}
                iconLeading={buttonIcon}
                isDisabled={isDisabled}
                isLoading={isBusy}
                key={action.id}
                size="sm"
                onClick={handleTransition(action)}>
                {action.label}
              </Button>
            );
          })}
        </Box>
      </Box>

      <Tabs defaultSelectedKey="overview">
        <Tabs.List
          className="tw:bg-primary tw:-mx-5 tw:px-5"
          size="sm"
          type="underline">
          <Tabs.Item id="overview" label={t('label.overview')} />
          <Tabs.Item id="activity" label={t('label.activity')} />
        </Tabs.List>

        <Tabs.Panel id="overview">
          <Box className="tw:pb-6 tw:pt-5" direction="col" gap={5}>
            <TaskOverview task={task} />

            <Box direction="col" gap={4}>
              <Typography weight="medium">
                {t('label.comment-plural')}
              </Typography>
              <InboxCommentComposer onSave={handleAddComment} />
              {comments.map((comment: TaskComment) => (
                <TaskCommentRow
                  comment={comment}
                  key={comment.id}
                  taskId={task.id}
                  onChanged={handleCommentMutated}
                />
              ))}
            </Box>
          </Box>
        </Tabs.Panel>

        <Tabs.Panel id="activity">
          <Box className="tw:pt-5">
            <TaskActivityTimeline task={task} />
          </Box>
        </Tabs.Panel>
      </Tabs>

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
