/*
 *  Copyright 2025 Collate.
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
  Skeleton,
  Table,
  TableCard,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { capitalize } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import NextPrevious from '../../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../components/common/NextPrevious/NextPrevious.interface';
import { StatusType } from '../../../components/common/StatusBadge/StatusBadge.interface';
import StatusBadgeV2 from '../../../components/common/StatusBadge/StatusBadgeV2.component';
import { getStatusMapping } from '../../../constants/WorkflowBuilder.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { CursorType } from '../../../enums/pagination.enum';
import {
  WorkflowInstance,
  WorkflowStatus,
} from '../../../generated/governance/workflows/workflowInstance';
import { WorkflowInstanceState } from '../../../generated/governance/workflows/workflowInstanceState';
import { Paging } from '../../../generated/type/paging';
import { useFqn } from '../../../hooks/useFqn';
import {
  getWorkflowInstanceDetails,
  getWorkflowInstancesByFQN,
} from '../../../rest/workflowDefinitionsAPI';
import {
  convertMillisecondsToHumanReadableFormat,
  formatDateTime,
} from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

// ----- Constants ------------------------------------------------------------

const PAGE_SIZE = 50;
const CLEAR_FILTER_SYMBOL = '✕';

// ----- Types ----------------------------------------------------------------

type RunGroup = {
  scheduleRunId: string;
  instances: WorkflowInstance[];
  earliestStartedAt: number | undefined;
  totalEntities: number;
  aggregatedStatus: WorkflowStatus | undefined;
  updatedBy: string | undefined;
};

type RowItem =
  | { id: string; kind: 'group-parent'; group: RunGroup }
  | {
      id: string;
      kind: 'group-child';
      instance: WorkflowInstance;
      scheduleRunId: string;
    }
  | { id: string; kind: 'flat'; instance: WorkflowInstance }
  | { id: string; kind: 'stage-loading'; instanceId: string }
  | { id: string; kind: 'stage-empty'; instanceId: string }
  | {
      id: string;
      kind: 'stage-state-row';
      state: WorkflowInstanceState;
    };

// ----- Helpers ---------------------------------------------------------------

const STATUS_PRIORITY: Record<WorkflowStatus, number> = {
  [WorkflowStatus.Running]: 4,
  [WorkflowStatus.Exception]: 3,
  [WorkflowStatus.Failure]: 2,
  [WorkflowStatus.Finished]: 1,
};

const aggregateStatus = (
  instances: WorkflowInstance[]
): WorkflowStatus | undefined => {
  const statuses = instances
    .map((i) => i.status)
    .filter((s): s is WorkflowStatus => s !== undefined);

  if (statuses.length === 0) {
    return undefined;
  }

  return statuses.reduce((worst, current) => {
    return (STATUS_PRIORITY[current] ?? 0) > (STATUS_PRIORITY[worst] ?? 0)
      ? current
      : worst;
  });
};

const shortId = (id: string): string => id.slice(0, 8);

// Entity references are encoded as "<#E::entityType::fqn>" — extract the FQN part
const parseEntityRef = (ref: string): string => {
  const match = ref.match(/^<#E::[^:]+::(.+)>$/);
  if (match) {
    const fqn = match[1];

    return fqn.split('.').pop() ?? fqn;
  }

  return ref.split('.').pop() ?? ref;
};

const formatEntityList = (entityList: string[]): string => {
  const names = entityList.map(parseEntityRef);
  const preview = names.slice(0, 5).join('\n');

  return names.length > 5 ? `${preview}\n+${names.length - 5} more` : preview;
};

// ----- Main component -------------------------------------------------------

export const WorkflowExecutionHistory: React.FC = () => {
  const { t } = useTranslation();
  const { fqn: workflowFqn } = useFqn();

  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [paging, setPaging] = useState<Paging>({ total: 0 });
  const [currentPage, setCurrentPage] = useState(1);

  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [expandedInstances, setExpandedInstances] = useState<Set<string>>(
    new Set()
  );
  const [instanceStates, setInstanceStates] = useState<
    Map<string, WorkflowInstanceState[]>
  >(new Map());
  const [loadingInstanceStates, setLoadingInstanceStates] = useState<
    Set<string>
  >(new Set());
  const fetchedInstanceIds = useRef<Set<string>>(new Set());

  const [filteredScheduleRunId, setFilteredScheduleRunId] = useState<
    string | null
  >(null);

  const statusMapping = useMemo(() => getStatusMapping(t), [t]);

  const getStatusInfo = useCallback(
    (status?: WorkflowStatus) => {
      if (status && status in statusMapping) {
        return statusMapping[status as keyof typeof statusMapping];
      }

      return {
        displayLabel: status ? capitalize(status) : 'Unknown',
        statusType: StatusType.Warning,
      };
    },
    [statusMapping]
  );

  const fetchExecutionHistory = useCallback(
    async (opts: { cursor?: string; scheduleRunId?: string | null } = {}) => {
      if (!workflowFqn) {
        return;
      }

      const { cursor, scheduleRunId } = opts;

      try {
        setLoading(true);
        const response = await getWorkflowInstancesByFQN(workflowFqn, {
          limit: PAGE_SIZE,
          ...(cursor ? { offset: cursor } : {}),
          ...(scheduleRunId ? { scheduleRunId } : {}),
        });
        setInstances(response.data || []);
        setPaging(response.paging ?? { total: 0 });
      } catch (error) {
        showErrorToast(error as AxiosError);
        setInstances([]);
        setPaging({ total: 0 });
      } finally {
        setLoading(false);
      }
    },
    [workflowFqn]
  );

  useEffect(() => {
    setCurrentPage(1);
    setPaging({ total: 0 });
    setInstanceStates(new Map());
    setExpandedInstances(new Set());
    setExpandedRuns(new Set());
    fetchedInstanceIds.current = new Set();
    fetchExecutionHistory({ scheduleRunId: filteredScheduleRunId });
  }, [workflowFqn, filteredScheduleRunId, fetchExecutionHistory]);

  const fetchInstanceStates = useCallback(
    async (instance: WorkflowInstance) => {
      const instanceId = instance.id;
      if (
        !workflowFqn ||
        !instanceId ||
        fetchedInstanceIds.current.has(instanceId)
      ) {
        return;
      }
      fetchedInstanceIds.current.add(instanceId);

      setLoadingInstanceStates((prev) => new Set([...prev, instanceId]));
      try {
        const data = await getWorkflowInstanceDetails(workflowFqn, instanceId);
        const states: WorkflowInstanceState[] = Array.isArray(data)
          ? data
          : data?.data ?? [];
        setInstanceStates((prev) => new Map([...prev, [instanceId, states]]));
      } catch (error) {
        showErrorToast(error as AxiosError);
        fetchedInstanceIds.current.delete(instanceId);
        setInstanceStates((prev) => new Map([...prev, [instanceId, []]]));
      } finally {
        setLoadingInstanceStates((prev) => {
          const next = new Set(prev);
          next.delete(instanceId);

          return next;
        });
      }
    },
    [workflowFqn]
  );

  const toggleRunExpanded = useCallback((scheduleRunId: string) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(scheduleRunId)) {
        next.delete(scheduleRunId);
      } else {
        next.add(scheduleRunId);
      }

      return next;
    });
  }, []);

  const toggleInstanceExpanded = useCallback(
    (instance: WorkflowInstance) => {
      const instanceId = instance.id;
      if (!instanceId) {
        return;
      }

      setExpandedInstances((prev) => {
        const next = new Set(prev);
        if (next.has(instanceId)) {
          next.delete(instanceId);
        } else {
          next.add(instanceId);
          fetchInstanceStates(instance);
        }

        return next;
      });
    },
    [fetchInstanceStates]
  );

  const handlePageNavigation = useCallback(
    ({ currentPage: page, cursorType }: PagingHandlerParams) => {
      setCurrentPage(page);
      const cursor =
        cursorType === CursorType.BEFORE ? paging.before : paging.after;
      fetchExecutionHistory({
        cursor: cursor ?? undefined,
        scheduleRunId: filteredScheduleRunId,
      });
      setExpandedRuns(new Set());
      setExpandedInstances(new Set());
    },
    [paging, fetchExecutionHistory, filteredScheduleRunId]
  );

  const handleScheduleRunFilter = useCallback((scheduleRunId: string) => {
    setFilteredScheduleRunId(scheduleRunId);
    setCurrentPage(1);
    setPaging({ total: 0 });
    setExpandedRuns(new Set());
    setExpandedInstances(new Set());
  }, []);

  const clearFilter = useCallback(() => {
    setFilteredScheduleRunId(null);
    setCurrentPage(1);
    setPaging({ total: 0 });
    setExpandedRuns(new Set());
    setExpandedInstances(new Set());
  }, []);

  const scheduleRunGroups = useMemo(() => {
    const groups = new Map<string | null, WorkflowInstance[]>();

    instances.forEach((instance) => {
      const key = instance.scheduleRunId ?? null;
      const existing = groups.get(key);

      if (existing) {
        existing.push(instance);
      } else {
        groups.set(key, [instance]);
      }
    });

    return groups;
  }, [instances]);

  const pushStageRows = useCallback(
    (result: RowItem[], instanceId: string) => {
      if (loadingInstanceStates.has(instanceId)) {
        result.push({
          id: `stage-loading-${instanceId}`,
          kind: 'stage-loading',
          instanceId,
        });

        return;
      }
      const states = instanceStates.get(instanceId) ?? [];
      if (states.length > 0) {
        states.forEach((state, idx) => {
          result.push({
            id: `stage-state-${instanceId}-${idx}`,
            kind: 'stage-state-row',
            state,
          });
        });
      } else {
        result.push({
          id: `stage-empty-${instanceId}`,
          kind: 'stage-empty',
          instanceId,
        });
      }
    },
    [instanceStates, loadingInstanceStates]
  );

  const rowItems = useMemo((): RowItem[] => {
    const result: RowItem[] = [];

    scheduleRunGroups.forEach((groupInstances, scheduleRunId) => {
      if (scheduleRunId === null) {
        groupInstances.forEach((instance) => {
          const flatId = `flat-${instance.id ?? instance.timestamp}`;
          result.push({ id: flatId, kind: 'flat', instance });

          if (instance.id && expandedInstances.has(instance.id)) {
            pushStageRows(result, instance.id);
          }
        });
      } else {
        const group: RunGroup = {
          scheduleRunId,
          instances: groupInstances,
          earliestStartedAt: groupInstances.reduce<number | undefined>(
            (min, i) =>
              i.startedAt !== undefined
                ? min === undefined
                  ? i.startedAt
                  : Math.min(min, i.startedAt)
                : min,
            undefined
          ),
          totalEntities: groupInstances.reduce(
            (sum, i) => sum + (i.entityList?.length ?? 0),
            0
          ),
          aggregatedStatus: aggregateStatus(groupInstances),
          updatedBy: groupInstances.find((i) => i.updatedBy)?.updatedBy,
        };
        result.push({
          id: `group-${scheduleRunId}`,
          kind: 'group-parent',
          group,
        });

        if (expandedRuns.has(scheduleRunId)) {
          groupInstances.forEach((instance) => {
            const childId = `child-${scheduleRunId}-${
              instance.id ?? instance.timestamp
            }`;
            result.push({
              id: childId,
              kind: 'group-child',
              instance,
              scheduleRunId,
            });

            if (instance.id && expandedInstances.has(instance.id)) {
              pushStageRows(result, instance.id);
            }
          });
        }
      }
    });

    return result;
  }, [scheduleRunGroups, expandedRuns, expandedInstances, pushStageRows]);

  if (!workflowFqn) {
    return (
      <div className="tw:flex tw:justify-center tw:items-center tw:min-h-100">
        <Typography as="p" className="tw:m-0 tw:text-secondary">
          {t('message.workflow-fqn-required')}
        </Typography>
      </div>
    );
  }

  if (instances.length === 0) {
    if (loading) {
      return (
        <div className="tw:flex tw:justify-center tw:items-center tw:min-h-100">
          <Loader />
        </div>
      );
    }

    return (
      <div className="tw:flex tw:justify-center tw:items-center tw:min-h-100">
        <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.NO_DATA} />
      </div>
    );
  }

  const renderDuration = (
    startedAt?: number,
    endedAt?: number
  ): React.ReactNode => {
    if (startedAt != null && endedAt != null) {
      return convertMillisecondsToHumanReadableFormat(endedAt - startedAt);
    }

    if (startedAt != null && endedAt == null) {
      return t('label.running-ellipsis');
    }

    return '-';
  };

  const renderEntityCell = (
    entityList?: string[],
    totalOverride?: number
  ): React.ReactNode => {
    const count = totalOverride ?? entityList?.length ?? 0;

    if (count === 0) {
      return '-';
    }

    const label = `${count} ${t(
      count === 1 ? 'label.entity' : 'label.entities'
    ).toLowerCase()}`;

    if (!entityList || entityList.length === 0) {
      return <span className="tw:text-secondary">{label}</span>;
    }

    return (
      <Tooltip
        arrow
        placement="bottom"
        title={
          <span className="tw:whitespace-pre-wrap tw:text-xs">
            {formatEntityList(entityList)}
          </span>
        }>
        <TooltipTrigger>
          <span className="tw:cursor-pointer tw:underline tw:decoration-dotted tw:text-primary-600">
            {label}
          </span>
        </TooltipTrigger>
      </Tooltip>
    );
  };

  const renderScheduleRunBadge = (
    scheduleRunId: string | undefined,
    onClick?: () => void
  ): React.ReactNode => {
    if (!scheduleRunId) {
      return (
        <span className="tw:text-tertiary tw:text-xs">
          {t('message.no-schedule-run-id')}
        </span>
      );
    }

    return (
      <button
        className={[
          'tw:font-mono tw:text-xs tw:rounded tw:bg-primary-50',
          'tw:text-primary-700 tw:px-1.5 tw:py-0.5 tw:border',
          'tw:border-primary-200 tw:cursor-pointer tw:hover:bg-primary-100 tw:transition-colors',
        ].join(' ')}
        data-testid={`schedule-run-badge-${scheduleRunId}`}
        onClick={onClick}>
        {shortId(scheduleRunId)}
      </button>
    );
  };

  const renderStageLoadingRow = (): React.ReactNode => (
    <Table.Row className="tw:bg-bg-primary">
      <Table.Cell colSpan={6}>
        <div className="tw:flex tw:items-center tw:gap-2 tw:pl-14 tw:py-2">
          <Skeleton className="tw:h-4 tw:w-24" />
          <Skeleton className="tw:h-4 tw:w-48" />
          <Skeleton className="tw:h-4 tw:w-16" />
        </div>
      </Table.Cell>
    </Table.Row>
  );

  const renderStageEmptyRow = (): React.ReactNode => (
    <Table.Row className="tw:bg-bg-primary">
      <Table.Cell colSpan={6}>
        <Typography
          as="p"
          className="tw:m-0 tw:pl-14 tw:py-2 tw:text-sm tw:text-secondary tw:italic">
          {t('message.no-stage-history')}
        </Typography>
      </Table.Cell>
    </Table.Row>
  );

  const renderSingleStageRow = (
    state: WorkflowInstanceState
  ): React.ReactNode => {
    const { displayLabel, statusType } = getStatusInfo(state.status);

    return (
      <Table.Row
        className="tw:bg-bg-primary"
        id={state.id ?? String(state.timestamp)}>
        <Table.Cell>
          <span className="tw:pl-14 tw:block tw:text-sm tw:text-secondary">
            {state.stage?.displayName ?? state.stage?.name ?? '-'}
          </span>
        </Table.Cell>
        <Table.Cell>
          <StatusBadgeV2
            dataTestId={`stage-status-${state.id}`}
            label={displayLabel}
            showIcon={false}
            status={statusType}
          />
        </Table.Cell>
        <Table.Cell>
          <span className="tw:text-sm">
            {renderDuration(state.stage?.startedAt, state.stage?.endedAt)}
          </span>
        </Table.Cell>
        <Table.Cell>
          {state.stage?.updatedBy ? (
            <span className="tw:text-sm">{state.stage.updatedBy}</span>
          ) : (
            <span className="tw:text-tertiary">-</span>
          )}
        </Table.Cell>
        <Table.Cell>{renderEntityCell(state.stage?.entityList)}</Table.Cell>
        <Table.Cell>
          <span className="tw:text-tertiary tw:text-xs">-</span>
        </Table.Cell>
      </Table.Row>
    );
  };

  const renderParentRow = (group: RunGroup, rowId: string): React.ReactNode => {
    const isExpanded = expandedRuns.has(group.scheduleRunId);
    const { displayLabel, statusType } = getStatusInfo(group.aggregatedStatus);

    return (
      <Table.Row className="tw:bg-bg-secondary tw:font-medium" id={rowId}>
        <Table.Cell>
          <div className="tw:flex tw:items-center tw:gap-2">
            <button
              aria-expanded={isExpanded}
              aria-label={isExpanded ? t('label.collapse') : t('label.expand')}
              className="tw:relative tw:z-10 tw:inline-flex tw:items-center tw:justify-center tw:w-5 tw:h-5 tw:rounded tw:text-secondary tw:hover:bg-bg-tertiary tw:transition-colors tw:flex-shrink-0"
              data-testid={`expand-group-${group.scheduleRunId}`}
              onClick={() => toggleRunExpanded(group.scheduleRunId)}>
              <span
                className={`tw:inline-block tw:transition-transform tw:duration-150 ${
                  isExpanded ? 'tw:rotate-90' : 'tw:rotate-0'
                }`}>
                ▶
              </span>
            </button>
            <span className="tw:text-sm">
              {group.earliestStartedAt
                ? formatDateTime(group.earliestStartedAt)
                : '-'}
            </span>
          </div>
        </Table.Cell>
        <Table.Cell>
          <StatusBadgeV2
            dataTestId={`workflow-group-status-${group.scheduleRunId}`}
            label={displayLabel}
            showIcon={false}
            status={statusType}
          />
        </Table.Cell>
        <Table.Cell>
          <span className="tw:text-secondary tw:text-sm">
            {group.instances.length} {t('label.instance-plural').toLowerCase()}
          </span>
        </Table.Cell>
        <Table.Cell>
          {group.updatedBy ? (
            <span className="tw:text-sm">{group.updatedBy}</span>
          ) : (
            <span className="tw:text-tertiary">-</span>
          )}
        </Table.Cell>
        <Table.Cell>
          {renderEntityCell(undefined, group.totalEntities)}
        </Table.Cell>
        <Table.Cell>
          {renderScheduleRunBadge(group.scheduleRunId, () =>
            handleScheduleRunFilter(group.scheduleRunId)
          )}
        </Table.Cell>
      </Table.Row>
    );
  };

  const renderInstanceRow = (
    instance: WorkflowInstance,
    isChild: boolean,
    rowId: string
  ): React.ReactNode => {
    const { displayLabel, statusType } = getStatusInfo(instance.status);
    const instanceId = instance.id;
    const isExpanded = instanceId ? expandedInstances.has(instanceId) : false;

    return (
      <Table.Row
        className={isChild ? 'tw:bg-bg-primary' : undefined}
        id={rowId}>
        <Table.Cell>
          <div className="tw:flex tw:items-center tw:gap-1">
            {instanceId && (
              <button
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded ? t('label.collapse') : t('label.expand')
                }
                className="tw:relative tw:z-10 tw:inline-flex tw:items-center tw:justify-center tw:w-4 tw:h-4 tw:rounded tw:text-tertiary tw:hover:bg-bg-tertiary tw:transition-colors tw:flex-shrink-0"
                data-testid={`expand-instance-${instanceId}`}
                onClick={() => toggleInstanceExpanded(instance)}>
                <span
                  className={`tw:text-xs tw:inline-block tw:transition-transform tw:duration-150 ${
                    isExpanded ? 'tw:rotate-90' : 'tw:rotate-0'
                  }`}>
                  ▶
                </span>
              </button>
            )}
            <span className={isChild ? 'tw:pl-6 tw:block' : undefined}>
              {instance.startedAt ? formatDateTime(instance.startedAt) : '-'}
            </span>
          </div>
        </Table.Cell>
        <Table.Cell>
          <StatusBadgeV2
            dataTestId={`workflow-status-badge-${instance.id}`}
            label={displayLabel}
            showIcon={false}
            status={statusType}
          />
        </Table.Cell>
        <Table.Cell>
          {renderDuration(instance.startedAt, instance.endedAt)}
        </Table.Cell>
        <Table.Cell>
          {instance.updatedBy ? (
            <span className="tw:text-sm">{instance.updatedBy}</span>
          ) : (
            <span className="tw:text-tertiary">-</span>
          )}
        </Table.Cell>
        <Table.Cell>{renderEntityCell(instance.entityList)}</Table.Cell>
        <Table.Cell>
          {renderScheduleRunBadge(instance.scheduleRunId, () =>
            instance.scheduleRunId
              ? handleScheduleRunFilter(instance.scheduleRunId)
              : undefined
          )}
        </Table.Cell>
      </Table.Row>
    );
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      {loading && (
        <div className="tw:flex tw:items-center tw:gap-2 tw:px-1 tw:py-0.5">
          <Loader size="small" />
          <Typography as="span" className="tw:text-xs tw:text-secondary">
            {t('label.loading')}
          </Typography>
        </div>
      )}
      {filteredScheduleRunId && (
        <div className="tw:sticky tw:top-0 tw:z-20 tw:bg-bg-primary tw:flex tw:items-center tw:gap-2 tw:px-1 tw:py-1">
          <Typography as="span" className="tw:text-sm tw:text-secondary">
            {t('message.viewing-schedule-run', {
              id: shortId(filteredScheduleRunId),
            })}
          </Typography>
          <button
            className="tw:text-xs tw:text-primary-600 tw:hover:underline tw:cursor-pointer"
            data-testid="clear-schedule-run-filter"
            onClick={clearFilter}>
            {CLEAR_FILTER_SYMBOL}
          </button>
        </div>
      )}

      <div className="tw:overflow-y-auto tw:max-h-[600px]">
        <TableCard.Root>
          <Table
            aria-label={t('label.execution-history')}
            data-testid="workflow-execution-history-table">
            <Table.Header>
              <Table.Row>
                <Table.Head
                  isRowHeader
                  id="executionDate"
                  label={t('label.execution-date')}
                />
                <Table.Head id="status" label={t('label.status')} />
                <Table.Head id="duration" label={t('label.duration')} />
                <Table.Head id="updatedBy" label={t('label.updated-by')} />
                <Table.Head id="entities" label={t('label.entities')} />
                <Table.Head id="scheduleRun" label={t('label.schedule-run')} />
              </Table.Row>
            </Table.Header>
            <Table.Body
              data-testid="workflow-execution-history-table-body"
              items={rowItems}>
              {(item) => {
                if (item.kind === 'group-parent') {
                  return renderParentRow(item.group, item.id);
                }

                if (item.kind === 'group-child') {
                  return renderInstanceRow(item.instance, true, item.id);
                }

                if (item.kind === 'stage-loading') {
                  return renderStageLoadingRow();
                }

                if (item.kind === 'stage-empty') {
                  return renderStageEmptyRow();
                }

                if (item.kind === 'stage-state-row') {
                  return renderSingleStageRow(item.state);
                }

                return renderInstanceRow(item.instance, false, item.id);
              }}
            </Table.Body>
          </Table>
        </TableCard.Root>
      </div>

      {paging.total > PAGE_SIZE && (
        <NextPrevious
          currentPage={currentPage}
          isLoading={loading}
          pageSize={PAGE_SIZE}
          paging={paging}
          pagingHandler={handlePageNavigation}
        />
      )}
    </div>
  );
};
