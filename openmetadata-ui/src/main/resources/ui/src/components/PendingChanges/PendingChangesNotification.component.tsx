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
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { Badge, Button, Popover, Select, Spin, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isArray, isNil, startCase } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../enums/entity.enum';
import { EntityReference } from '../../generated/type/entityReference';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  getPendingChanges,
  PendingChange,
  PendingChangeField,
} from '../../rest/pendingChangesAPI';
import {
  listTasks,
  resolveTask,
  Task,
  TaskEntityStatus,
  TaskResolutionType,
} from '../../rest/tasksAPI';
import { getEntityFeedLink } from '../../utils/EntityPureUtils';
import { getUserPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './pending-changes-notification.less';

const { Text } = Typography;

// Maps an entity type to its REST collection so the bell can fetch that entity's held changes.
// Only mapped types show the bell; unmapped ones render nothing (harmless).
const ENTITY_COLLECTION: Record<string, string> = {
  table: 'tables',
  glossary: 'glossaries',
  glossaryTerm: 'glossaryTerms',
  dashboard: 'dashboards',
  dashboardDataModel: 'dashboard/datamodels',
  topic: 'topics',
  pipeline: 'pipelines',
  mlmodel: 'mlmodels',
  container: 'containers',
  searchIndex: 'searchIndexes',
  apiEndpoint: 'apiEndpoints',
  apiCollection: 'apiCollections',
  storedProcedure: 'storedProcedures',
  metric: 'metrics',
  chart: 'charts',
  database: 'databases',
  databaseSchema: 'databaseSchemas',
  dataProduct: 'dataProducts',
  domain: 'domains',
  directory: 'directories',
  file: 'files',
  spreadsheet: 'spreadsheets',
  worksheet: 'worksheets',
  databaseService: 'services/databaseServices',
  messagingService: 'services/messagingServices',
  dashboardService: 'services/dashboardServices',
  pipelineService: 'services/pipelineServices',
  mlmodelService: 'services/mlmodelServices',
  metadataService: 'services/metadataServices',
  storageService: 'services/storageServices',
  searchService: 'services/searchServices',
  apiService: 'services/apiServices',
  securityService: 'services/securityServices',
  driveService: 'services/driveServices',
};

const stripHtmlTags = (value: string): string =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// A held value can be an array (tags, owners), a nested object, or a plain
// string/rich-text (description). Flatten each into display chips so the diff
// reads the same way as the task "Proposed Changes" panel.
const toChips = (value: unknown): string[] => {
  if (isNil(value) || value === '') {
    return [];
  }
  if (isArray(value)) {
    return value.map((item) =>
      typeof item === 'object' && item !== null
        ? (item as Record<string, string>).tagFQN ??
          (item as Record<string, string>).displayName ??
          (item as Record<string, string>).name ??
          (item as Record<string, string>).fullyQualifiedName ??
          JSON.stringify(item)
        : String(item)
    );
  }
  if (typeof value === 'object') {
    return [JSON.stringify(value)];
  }

  return [stripHtmlTags(String(value))].filter(Boolean);
};

const FieldDiffRow = ({
  field,
  kind,
}: {
  field: PendingChangeField;
  kind: 'updated' | 'added' | 'deleted';
}) => {
  const removed = kind === 'added' ? [] : toChips(field.oldValue);
  const added = kind === 'deleted' ? [] : toChips(field.newValue);

  return (
    <div className="pending-changes-field-row">
      <Text className="pending-changes-field-name">{startCase(field.name)}</Text>
      <div className="pending-changes-chips">
        {removed.map((val) => (
          <span
            className="pending-changes-chip pending-changes-chip--removed"
            key={`removed-${val}`}>
            {val}
          </span>
        ))}
        {added.map((val) => (
          <span
            className="pending-changes-chip pending-changes-chip--added"
            key={`added-${val}`}>
            {val}
          </span>
        ))}
        {removed.length === 0 && added.length === 0 && (
          <span className="pending-changes-empty">—</span>
        )}
      </div>
    </div>
  );
};

interface PendingChangesNotificationProps {
  entityType: EntityType;
  entityId: string;
  entityFqn: string;
}

const assigneeNames = (task?: Task): string =>
  (task?.assignees ?? [])
    .map((a) => a.displayName ?? a.name ?? '')
    .filter(Boolean)
    .join(', ');

const PendingChangesNotification = ({
  entityType,
  entityId,
  entityFqn,
}: PendingChangesNotificationProps) => {
  const { t } = useTranslation();
  const collection = ENTITY_COLLECTION[entityType];
  const { currentUser } = useApplicationStore();
  const [changes, setChanges] = useState<PendingChange[]>([]);
  // requester -> their open approval task, so the diff can be shown to everyone
  // but Accept/Discard only to that task's assignees/reviewers.
  const [tasksByRequester, setTasksByRequester] = useState<Record<string, Task>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolvingFor, setResolvingFor] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState<string | null>(null);
  // Default the filter to the viewer's own proposal once loaded; if they have none, leave it on
  // "All". Guarded so a manual selection (including clearing back to All) is not overwritten.
  const filterDefaulted = useRef(false);
  // Post-resolve refresh timer, tracked so it is cleared on unmount (no setState after unmount).
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchChanges = useCallback(() => {
    if (!collection || !entityId) {
      return;
    }
    setLoading(true);
    const entityLink = getEntityFeedLink(entityType, entityFqn);
    Promise.all([
      getPendingChanges(collection, entityId),
      listTasks({
        aboutEntity: entityLink,
        status: TaskEntityStatus.Open,
      }).catch(() => ({ data: [] as Task[] })),
    ])
      .then(([data, taskResponse]) => {
        setChanges(data ?? []);
        const map: Record<string, Task> = {};
        (taskResponse?.data ?? []).forEach((task) => {
          const creator = task.createdBy?.name ?? '';
          if (task.status === TaskEntityStatus.Open && creator && !map[creator]) {
            map[creator] = task;
          }
        });
        setTasksByRequester(map);
      })
      .catch((error) => showErrorToast(error as AxiosError))
      .finally(() => setLoading(false));
  }, [collection, entityId, entityType, entityFqn]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  useEffect(
    () => () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!filterDefaulted.current && changes.length > 0) {
      const hasOwn = changes.some(
        (item) => item.requester === currentUser?.name
      );
      setFilterUser(hasOwn ? currentUser?.name ?? null : null);
      filterDefaulted.current = true;
    }
  }, [changes, currentUser]);

  // Only a task's assignees/reviewers (directly or via their team) may resolve it.
  // Admins are intentionally not granted a bypass: the workflow's status transitions
  // are reviewer-gated, so a non-reviewer resolve fails the instance downstream.
  const canResolve = (requester: string): boolean => {
    const task = tasksByRequester[requester];
    let allowed = false;
    if (task && currentUser?.id) {
      const teamIds = new Set((currentUser.teams ?? []).map((team) => team.id));
      const matchesUser = (refs?: EntityReference[]) =>
        (refs ?? []).some((ref) => ref.id === currentUser.id);
      const matchesTeam = (refs?: EntityReference[]) =>
        (refs ?? []).some((ref) => teamIds.has(ref.id));
      allowed =
        matchesUser(task.assignees) ||
        matchesUser(task.reviewers) ||
        matchesTeam(task.assignees) ||
        matchesTeam(task.reviewers);
    }

    return allowed;
  };

  const resolveForRequester = async (
    requester: string,
    transitionId: 'approve' | 'reject',
    resolutionType: TaskResolutionType
  ) => {
    const task = tasksByRequester[requester];
    if (!task?.id) {
      showErrorToast(t('message.no-open-approval-task', { user: requester }));

      return;
    }
    try {
      setResolvingFor(requester);
      await resolveTask(task.id, {
        transitionId,
        resolutionType,
        comment: t('message.resolved-from-pending-change'),
      });
      showSuccessToast(
        resolutionType === TaskResolutionType.Approved
          ? t('message.approved-change-from', { user: requester })
          : t('message.rejected-change-from', { user: requester })
      );
      // Give the async workflow a moment, then refresh. Tracked so an unmount within the
      // window cancels it instead of calling setState on an unmounted component.
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      refreshTimer.current = setTimeout(fetchChanges, 1500);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setResolvingFor(null);
    }
  };

  if (!collection || (!loading && changes.length === 0)) {
    return null;
  }

  const requesters = Array.from(new Set(changes.map((item) => item.requester)));
  // Surface the viewer's own proposal first, then everyone else's.
  const orderedChanges = [...changes].sort(
    (a, b) =>
      (a.requester === currentUser?.name ? 0 : 1) -
      (b.requester === currentUser?.name ? 0 : 1)
  );
  const visibleChanges = filterUser
    ? orderedChanges.filter((item) => item.requester === filterUser)
    : orderedChanges;

  const titleNode = (
    <div className="pending-changes-title-bar">
      <span className="pending-changes-title">
        {t('label.pending-changes')}
      </span>
      {requesters.length > 1 && (
        <Select
          allowClear
          className="pending-changes-filter"
          options={requesters.map((requester) => ({
            label: requester === currentUser?.name ? t('label.you') : requester,
            value: requester,
          }))}
          placeholder={t('message.all-users')}
          size="small"
          value={filterUser ?? undefined}
          onChange={(value) => setFilterUser(value ?? null)}
        />
      )}
    </div>
  );

  const popoverContent = (
    <div className="pending-changes-popover">
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : (
        visibleChanges.map((change) => {
          const cd = change.changeDescription ?? {};
          const busy = resolvingFor === change.requester;
          const resolvable = canResolve(change.requester);
          const task = tasksByRequester[change.requester];
          const isSelf = currentUser?.name === change.requester;
          const reviewers = assigneeNames(task);

          return (
            <div className="pending-changes-requester" key={change.requester}>
              <div className="pending-changes-requester-header">
                {isSelf ? (
                  <span className="pending-changes-requester-name pending-changes-requester-name--self">
                    {t('label.you')}
                  </span>
                ) : (
                  <Link
                    className="pending-changes-requester-name"
                    to={getUserPath(change.requester)}>
                    {change.requester}
                  </Link>
                )}
                <span className="pending-changes-requester-caption">
                  {isSelf
                    ? t('message.proposed-this-change')
                    : t('message.proposed-changes')}
                </span>
              </div>
              {task?.assignees?.length ? (
                <div className="pending-changes-assignees">
                  <span className="pending-changes-assignees-label">
                    {t('label.reviewer-plural')}
                  </span>
                  <span className="pending-changes-assignees-list">
                    {task.assignees.map((assignee, i) => {
                      const label =
                        assignee.displayName ?? assignee.name ?? '';

                      return (
                        <span key={assignee.id ?? assignee.name ?? label}>
                          {i > 0 && (
                            <span className="pending-changes-assignees-sep">
                              {', '}
                            </span>
                          )}
                          {assignee.type === 'user' ? (
                            <Link to={getUserPath(assignee.name ?? '')}>
                              {label}
                            </Link>
                          ) : (
                            label
                          )}
                        </span>
                      );
                    })}
                  </span>
                </div>
              ) : null}
              <div className="pending-changes-fields">
                {(cd.fieldsUpdated ?? []).map((field) => (
                  <FieldDiffRow
                    field={field}
                    key={`updated-${field.name}`}
                    kind="updated"
                  />
                ))}
                {(cd.fieldsAdded ?? []).map((field) => (
                  <FieldDiffRow
                    field={field}
                    key={`added-${field.name}`}
                    kind="added"
                  />
                ))}
                {(cd.fieldsDeleted ?? []).map((field) => (
                  <FieldDiffRow
                    field={field}
                    key={`deleted-${field.name}`}
                    kind="deleted"
                  />
                ))}
              </div>
              {resolvable ? (
                <div className="pending-changes-actions">
                  <Button
                    icon={<CheckOutlined />}
                    loading={busy}
                    size="small"
                    type="primary"
                    onClick={() =>
                      resolveForRequester(
                        change.requester,
                        'approve',
                        TaskResolutionType.Approved
                      )
                    }>
                    {t('label.accept')}
                  </Button>
                  <Button
                    danger
                    disabled={busy}
                    icon={<CloseOutlined />}
                    size="small"
                    onClick={() =>
                      resolveForRequester(
                        change.requester,
                        'reject',
                        TaskResolutionType.Rejected
                      )
                    }>
                    {t('label.discard')}
                  </Button>
                </div>
              ) : (
                <Text className="pending-changes-awaiting" type="secondary">
                  {reviewers
                    ? t('message.awaiting-review-by', { reviewers })
                    : t('message.awaiting-review')}
                </Text>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      open={open}
      placement="bottomRight"
      title={titleNode}
      trigger="click"
      onOpenChange={setOpen}>
      <Tooltip title={t('label.pending-changes')}>
        <Badge count={changes.length} size="small">
          <Button
            data-testid="pending-changes-bell"
            icon={<BellOutlined />}
            shape="circle"
          />
        </Badge>
      </Tooltip>
    </Popover>
  );
};

export default PendingChangesNotification;
