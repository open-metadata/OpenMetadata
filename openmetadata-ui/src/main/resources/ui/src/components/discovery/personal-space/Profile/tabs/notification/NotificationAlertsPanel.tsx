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
  Button,
  ButtonUtility,
  EmptyPlaceholder,
  PaginationCardWithControls,
  Skeleton,
  Table,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete, Edit } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../../../constants/constants';
import { usePermissionProvider } from '../../../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../../../../enums/entity.enum';
import {
  AlertType,
  EventSubscription,
  ProviderType,
} from '../../../../../../generated/events/eventSubscription';
import { Paging } from '../../../../../../generated/type/paging';
import { useHashPagingParams } from '../../../../../../hooks/useSettingsHash';
import {
  getAlertsFromName,
  getAllAlerts,
} from '../../../../../../rest/alertsAPI';
import { hardDeleteEntity } from '../../../../../../utils/DeleteWidget/DeleteWidgetUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../../../utils/PermissionDerivation';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import DeleteModal from '../../../../../common/DeleteModal/DeleteModal';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import type { NotificationView } from './Notification.types';

const MAX_CURSOR_CACHE_PAGES = 100;

type AlertColumnId = 'name' | 'trigger' | 'description' | 'actions';
type AlertColumn = { id: AlertColumnId; label: string; className?: string };

interface NotificationAlertsPanelProps {
  onNavigate: (view: NotificationView) => void;
}

const NotificationAlertsPanel: React.FC<NotificationAlertsPanelProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const {
    page: currentPage,
    pageSize: hashPageSize,
    setPage: setHashPage,
  } = useHashPagingParams();
  const pageSize = hashPageSize || PAGE_SIZE_BASE;
  const [alerts, setAlerts] = useState<EventSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<EventSubscription>();
  const [isDeleting, setIsDeleting] = useState(false);
  const [paging, setPaging] = useState<Paging>({ total: 0 });
  const [cursorCache, setCursorCache] = useState<Map<number, Paging>>(
    new Map()
  );
  const [alertPermissions, setAlertPermissions] =
    useState<{ id: string; edit: boolean; delete: boolean }[]>();
  const fetchRequestIdRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const fetchAlertsRef = useRef<typeof fetchAlerts>(null!);

  const showPagination = useMemo(
    () =>
      Boolean(paging.before || paging.after) ||
      paging.total > pageSize ||
      pageSize !== PAGE_SIZE_BASE,
    [paging, pageSize]
  );

  const { getEntityPermissionByFqn } = usePermissionProvider();

  const columns = useMemo<AlertColumn[]>(
    () => [
      {
        id: 'name',
        label: t('label.name'),
        className: 'tw:w-70 tw:overflow-hidden',
      },
      { id: 'trigger', label: t('label.trigger'), className: 'tw:w-40' },
      { id: 'description', label: t('label.description') },
      { id: 'actions', label: t('label.action-plural'), className: 'tw:w-24' },
    ],
    [t]
  );

  const fetchAlertPermissionByFqn = async (alertDetails: EventSubscription) => {
    const permission = await getEntityPermissionByFqn(
      ResourceEntity.EVENT_SUBSCRIPTION,
      alertDetails.fullyQualifiedName ?? ''
    );

    const editPermission = getDerivedPermissionFlags(permission).canEditAll;
    const deletePermission = getDerivedPermissionFlags(permission).canDelete;

    return {
      id: alertDetails.id ?? '',
      edit: editPermission,
      delete: Boolean(deletePermission),
    };
  };

  const fetchAllAlertsPermission = async (alertList: EventSubscription[]) => {
    try {
      const responses = alertList.map((alert) =>
        fetchAlertPermissionByFqn(alert)
      );

      setAlertPermissions(await Promise.all(responses));
    } catch {
      // On error fall back to empty — avoids infinite skeleton in the actions column
      setAlertPermissions([]);
    }
  };

  const updateCursorCache = (
    prev: Map<number, Paging>,
    page: number,
    pagingData: Paging
  ) => {
    const next = new Map(prev).set(page, pagingData);

    if (next.size > MAX_CURSOR_CACHE_PAGES) {
      [...next.keys()]
        .sort((a, b) => a - b)
        .slice(0, next.size - MAX_CURSOR_CACHE_PAGES)
        .forEach((k) => next.delete(k));
    }

    return next;
  };

  const fetchAlerts = async (
    pagingParam?: Partial<Paging>,
    targetPage = 1
  ): Promise<Paging | undefined> => {
    const requestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    try {
      const { data, paging: responsePaging } = await getAllAlerts({
        alertType: AlertType.Notification,
        limit: pageSize,
        after: pagingParam?.after,
        before: pagingParam?.before,
      });

      if (requestId !== fetchRequestIdRef.current) {
        return undefined;
      }

      let alertList = data;

      if (isUndefined(pagingParam?.after) && isUndefined(pagingParam?.before)) {
        // On page 1, prepend the system ActivityFeedAlert
        try {
          const activityFeedAlert = await getAlertsFromName(
            'ActivityFeedAlert'
          );
          alertList = [activityFeedAlert, ...data];
        } catch {
          // If ActivityFeedAlert is not found, proceed without it
        }
      }

      setAlerts(alertList);
      setPaging(responsePaging);
      setCursorCache((prev) =>
        updateCursorCache(prev, targetPage, responsePaging)
      );

      if (requestId !== fetchRequestIdRef.current) {
        return undefined;
      }
      await fetchAllAlertsPermission(alertList);

      return responsePaging;
    } catch (error) {
      showErrorToast(error as AxiosError);

      return undefined;
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  fetchAlertsRef.current = fetchAlerts;

  const handleAfterDeleteAction = useCallback(() => {
    setHashPage(1, undefined, undefined, pageSize);
    setCursorCache(new Map());
    fetchAlertsRef.current(undefined, 1);
  }, [setHashPage, pageSize]);

  const handleAlertDelete = useCallback(async () => {
    setIsDeleting(true);
    const isSuccess = await hardDeleteEntity(
      getEntityName(selectedAlert).toString(),
      selectedAlert?.id ?? '',
      EntityType.SUBSCRIPTION
    );

    if (isSuccess) {
      handleAfterDeleteAction();
    }

    setSelectedAlert(undefined);
    setIsDeleting(false);
  }, [selectedAlert, handleAfterDeleteAction]);

  const navigateSequentially = async (newPage: number) => {
    const requestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    try {
      let page = currentPage;
      let currentPaging: Paging = paging;

      while (page < newPage && currentPaging.after) {
        page++;
        // eslint-disable-next-line openmetadata-imports/no-api-calls-in-iteration -- sequential page walk
        const { data, paging: responsePaging } = await getAllAlerts({
          alertType: AlertType.Notification,
          limit: pageSize,
          after: currentPaging.after,
        });

        if (requestId !== fetchRequestIdRef.current) {
          return;
        }

        currentPaging = responsePaging;
        setCursorCache((prev) => updateCursorCache(prev, page, responsePaging));

        if (page === newPage) {
          setAlerts(data);
          setPaging(responsePaging);
          setHashPage(newPage, undefined, undefined, pageSize);
          await fetchAllAlertsPermission(data);
        }
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handlePageNavigation = async (newPage: number) => {
    if (newPage === currentPage) {
      return;
    }

    if (newPage === 1) {
      setHashPage(1, undefined, undefined, pageSize);
      fetchAlerts(undefined, 1);

      return;
    }

    const cachedCursor = cursorCache.get(newPage - 1)?.after;
    if (cachedCursor) {
      setHashPage(newPage, undefined, undefined, pageSize);
      fetchAlerts({ after: cachedCursor }, newPage);

      return;
    }

    if (newPage > currentPage) {
      await navigateSequentially(newPage);
    }
  };

  const handlePageSizeChange = (size: number) => {
    setHashPage(1, undefined, undefined, size);
    setCursorCache(new Map());
  };

  useEffect(() => {
    if (currentPage <= 1) {
      fetchAlerts(undefined, 1);
    } else {
      // Cursor-based API: fetch page 1 for its cursor, then walk forward.
      (async () => {
        const page1Paging = await fetchAlerts(undefined, 1);
        if (!page1Paging?.after) {
          return;
        }
        const requestId = ++fetchRequestIdRef.current;
        setIsLoading(true);
        try {
          let pg = 1;
          let cursor: Paging = page1Paging;
          while (pg < currentPage && cursor.after) {
            pg++;
            // eslint-disable-next-line openmetadata-imports/no-api-calls-in-iteration -- sequential page walk on mount
            const { data, paging: rp } = await getAllAlerts({
              alertType: AlertType.Notification,
              limit: pageSize,
              after: cursor.after,
            });
            if (requestId !== fetchRequestIdRef.current) {
              return;
            }
            cursor = rp;
            setCursorCache((prev) => updateCursorCache(prev, pg, rp));
            if (pg === currentPage) {
              setAlerts(data);
              setPaging(rp);
              await fetchAllAlertsPermission(data);
            }
          }
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          if (requestId === fetchRequestIdRef.current) {
            setIsLoading(false);
          }
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const renderActionsCell = (alert: EventSubscription) => {
    if (isUndefined(alertPermissions)) {
      return <Skeleton height={20} variant="rounded" />;
    }

    // System alerts show placeholder — no actions (matches legacy behaviour)
    if (alert.provider === ProviderType.System) {
      return (
        <Typography className="tw:text-secondary" size="text-sm">
          --
        </Typography>
      );
    }

    const alertPermission = alertPermissions?.find((p) => p.id === alert.id);
    const hasEdit = Boolean(alertPermission?.edit);
    const hasDelete = Boolean(alertPermission?.delete);

    if (!hasEdit && !hasDelete) {
      return (
        <Typography className="tw:text-secondary" size="text-sm">
          --
        </Typography>
      );
    }

    return (
      <Box direction="row" gap={1}>
        {hasEdit && (
          <ButtonUtility
            color="tertiary"
            data-testid={`alert-edit-${getEntityName(alert)}`}
            icon={Edit}
            size="xs"
            tooltip={t('label.edit')}
            onPress={() =>
              onNavigate({
                type: 'edit',
                fqn: alert.fullyQualifiedName ?? '',
              })
            }
          />
        )}
        {hasDelete && (
          <ButtonUtility
            color="tertiary"
            data-testid={`alert-delete-${getEntityName(alert)}`}
            icon={Delete}
            size="xs"
            tooltip={t('label.delete')}
            onPress={() => setSelectedAlert(alert)}
          />
        )}
      </Box>
    );
  };

  const renderCell = (alert: EventSubscription, colId: AlertColumnId) => {
    switch (colId) {
      case 'name':
        return (
          <Button
            className="tw:max-w-full tw:truncate tw:block tw:text-left"
            color="link-color"
            data-testid="alert-name"
            size="sm"
            tooltip={getEntityName(alert)}
            onPress={() =>
              onNavigate({
                type: 'detail',
                fqn: alert.fullyQualifiedName ?? '',
                name: getEntityName(alert),
              })
            }>
            {getEntityName(alert)}
          </Button>
        );

      case 'trigger':
        return (
          <Typography size="text-sm">
            {alert.filteringRules?.resources?.join(', ') || '--'}
          </Typography>
        );

      case 'description':
        return alert.description ? (
          <RichTextEditorPreviewerV1
            markdown={alert.description}
            maxLength={200}
          />
        ) : (
          <Typography className="tw:text-secondary" size="text-sm">
            --
          </Typography>
        );

      case 'actions':
        return renderActionsCell(alert);

      default:
        return null;
    }
  };

  const renderEmptyState = useCallback(
    () =>
      isLoading ? (
        <Box className="tw:p-3" direction="col" gap={2}>
          {Array.from({ length: pageSize }, (_, i) => (
            <Skeleton height={28} key={i} variant="rounded" />
          ))}
        </Box>
      ) : (
        <Box
          align="center"
          className="tw:min-h-32 tw:relative"
          justify="center">
          <EmptyPlaceholder
            title={t('label.no-entity-found', {
              entity: t('label.alert-plural'),
            })}
          />
        </Box>
      ),
    [isLoading, pageSize, t]
  );

  const totalPages = Math.max(1, Math.ceil((paging.total ?? 0) / pageSize));

  return (
    <Box
      className="tw:pt-1 tw:h-full tw:px-8 tw:pb-8"
      data-testid="alerts-list-container"
      direction="col"
      gap={4}>
      <TableCard.Root className="tw:flex tw:flex-col" size="compact">
        <Box className="tw:overflow-y-auto">
          <Table
            aria-label={t('label.alert-plural')}
            className="tw:table-fixed"
            data-testid="alerts-list-table"
            size="compact">
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Head
                  className={col.className}
                  id={col.id}
                  isRowHeader={col.id === 'name'}
                  key={col.id}
                  label={col.label}
                />
              )}
            </Table.Header>
            <Table.Body
              items={isLoading ? [] : alerts}
              renderEmptyState={renderEmptyState}>
              {(alert) => (
                <Table.Row
                  columns={columns}
                  data-testid={`alert-${getEntityName(alert)}`}
                  id={alert.id ?? alert.name}
                  key={alert.id ?? alert.name}>
                  {(col) => (
                    <Table.Cell className={col.className} key={col.id}>
                      {renderCell(alert, col.id as AlertColumnId)}
                    </Table.Cell>
                  )}
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </Box>
        {showPagination && (
          <PaginationCardWithControls
            page={currentPage}
            pageSize={pageSize}
            pageSizeOptions={[
              PAGE_SIZE_BASE,
              PAGE_SIZE_MEDIUM,
              PAGE_SIZE_LARGE,
            ]}
            total={totalPages}
            onPageChange={handlePageNavigation}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </TableCard.Root>

      {selectedAlert && (
        <DeleteModal
          open
          entityTitle={getEntityName(selectedAlert).toString()}
          isDeleting={isDeleting}
          message={t('message.permanently-delete-common-message', {
            entity: getEntityName(selectedAlert).toString().toLowerCase(),
          })}
          onCancel={() => setSelectedAlert(undefined)}
          onDelete={handleAlertDelete}
        />
      )}
    </Box>
  );
};

export default NotificationAlertsPanel;
