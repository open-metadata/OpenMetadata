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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Dropdown,
  EmptyPlaceholder,
  PaginationCardWithControls,
  Skeleton,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Bell01, FilterLines } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FilterOffIcon } from '../../../../../../assets/svg/ic-filter-off.svg';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../../../constants/constants';
import { AlertRecentEventFilters } from '../../../../../../enums/Alerts.enum';
import { CSMode } from '../../../../../../enums/codemirror.enum';
import {
  ChangeEvent,
  Status,
  TypedEvent,
} from '../../../../../../generated/events/api/typedEvent';
import { EventSubscription } from '../../../../../../generated/events/eventSubscription';
import { Paging } from '../../../../../../generated/type/paging';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import { getAlertEventsFromId } from '../../../../../../rest/alertsAPI';
import { getAlertStatusIcon } from '../../../../../../utils/Alerts/AlertsUtil';
import {
  getAlertEventsFilterLabels,
  getChangeEventDataFromTypedEvent,
  getLabelsForEventDetails,
} from '../../../../../../utils/Alerts/AlertsUtilPure';
import { formatDateTime } from '../../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import searchClassBase from '../../../../../../utils/SearchClassBase';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import { withSuspenseFallback } from '../../../../../AppRouter/withSuspenseFallback';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../../../../Database/SchemaEditor/SchemaEditor'))
);

type AlertEventDetailsToDisplay = Pick<
  ChangeEvent,
  | 'eventType'
  | 'entityId'
  | 'userName'
  | 'previousVersion'
  | 'currentVersion'
  | 'reason'
  | 'source'
  | 'failingSubscriptionId'
>;

interface NotificationRecentEventsProps {
  alertDetails: EventSubscription;
}

function NotificationRecentEvents({
  alertDetails,
}: NotificationRecentEventsProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<AlertRecentEventFilters | Status>(
    AlertRecentEventFilters.ALL
  );
  const { state: hashState, updateParams } = useSettingsHash();
  const initialPage = Number(hashState.params.page) || 1;
  const initialPageSize = Number(hashState.params.pageSize) || PAGE_SIZE_BASE;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [alertRecentEvents, setAlertRecentEvents] = useState<TypedEvent[]>();
  const [loading, setLoading] = useState<boolean>(false);
  const [paging, setPaging] = useState<Paging>({ total: 0 });

  const { id, alertName } = useMemo(
    () => ({
      id: alertDetails.id,
      alertName: getEntityName(alertDetails),
    }),
    [alertDetails]
  );

  const filterItems = useMemo(
    () =>
      Object.values(AlertRecentEventFilters).map((status) => ({
        id: status,
        label: getAlertEventsFilterLabels(status),
      })),
    []
  );

  const getAlertRecentEvents = useCallback(
    async (paginationOffset = 0, limit = pageSize) => {
      try {
        setLoading(true);
        const { data, paging } = await getAlertEventsFromId({
          id,
          params: {
            ...(filter === AlertRecentEventFilters.ALL
              ? { limit, paginationOffset }
              : {
                  status: filter as Status,
                  limit,
                  paginationOffset,
                }),
          },
        });

        setAlertRecentEvents(data);
        setPaging(paging);
      } catch (e) {
        showErrorToast(e as AxiosError);
      } finally {
        setLoading(false);
      }
    },
    [id, filter, pageSize]
  );

  const handlePageNavigation = useCallback(
    (page: number) => {
      setCurrentPage(page);
      updateParams({ page: String(page), pageSize: String(pageSize) });
      getAlertRecentEvents((page - 1) * pageSize);
    },
    [pageSize, getAlertRecentEvents, updateParams]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setCurrentPage(1);
      setPageSize(size);
      updateParams({ page: '1', pageSize: String(size) });
      getAlertRecentEvents(0, size);
    },
    [updateParams, getAlertRecentEvents]
  );

  const showPagination = useMemo(
    () =>
      Boolean(paging.before || paging.after) ||
      paging.total > pageSize ||
      pageSize !== PAGE_SIZE_BASE,
    [paging, pageSize]
  );

  const totalPages = Math.max(1, Math.ceil((paging.total ?? 0) / pageSize));

  useEffect(() => {
    const offset = (currentPage - 1) * pageSize;
    getAlertRecentEvents(offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const renderLoading = () => (
    <Box direction="col" gap={2}>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton height={48} key={i} variant="rounded" />
      ))}
    </Box>
  );

  const renderEmpty = () => {
    const isFiltered = filter !== AlertRecentEventFilters.ALL;

    return (
      <Box className="tw:relative tw:min-h-80 tw:w-full">
        <EmptyPlaceholder
          description={t(
            isFiltered
              ? 'message.no-data-available-for-selected-filter'
              : 'message.no-recent-events-description'
          )}
          icon={
            isFiltered ? (
              <FilterOffIcon className="tw:text-fg-quaternary" />
            ) : (
              <Bell01 className="tw:text-fg-brand-primary" />
            )
          }
          title={t(
            isFiltered
              ? 'message.no-results-for-filters'
              : 'message.no-recent-events'
          )}
          variant="blank"
        />
      </Box>
    );
  };

  const renderEventsList = () => {
    if (loading) {
      return renderLoading();
    }

    if (isEmpty(alertRecentEvents)) {
      return renderEmpty();
    }

    return (
      <Box direction="col">
        <Box data-testid="recent-events-list" direction="col" gap={2}>
          <Accordion
            allowsMultipleExpanded
            className="tw:w-full tw:rounded-b-none">
            {alertRecentEvents?.map((typedEvent) => {
              const { changeEventData, changeEventDataToDisplay } =
                getChangeEventDataFromTypedEvent(typedEvent);

              const eventKey = `${changeEventData.id}-${changeEventData.timestamp}`;

              return (
                <AccordionItem id={eventKey} key={eventKey}>
                  <AccordionHeader>
                    <Box
                      align="center"
                      className="tw:flex-1"
                      data-testid={`event-collapse-${changeEventData.id}`}
                      direction="row"
                      justify="between">
                      <Box align="center" direction="row" gap={3}>
                        <Tooltip
                          placement="top"
                          title={startCase(typedEvent.status)}>
                          <Box className="tw:flex-center">
                            {getAlertStatusIcon(typedEvent.status)}
                          </Box>
                        </Tooltip>
                        <Tooltip
                          placement="top"
                          title={startCase(changeEventData.entityType)}>
                          <Box className="tw:flex-center">
                            {searchClassBase.getEntityIcon(
                              changeEventData.entityType ?? '',
                              'h-4 w-4'
                            )}
                          </Box>
                        </Tooltip>
                        <Typography size="text-sm">
                          {changeEventData.id}
                        </Typography>
                      </Box>
                      <Typography className="tw:text-tertiary!" size="text-sm">
                        {formatDateTime(typedEvent.timestamp)}
                      </Typography>
                    </Box>
                  </AccordionHeader>
                  <AccordionPanel>
                    <Box
                      data-testid={`event-details-${changeEventData.id}`}
                      direction="col"
                      gap={3}>
                      <Box direction="row" gap={4} wrap="wrap">
                        {Object.entries(changeEventDataToDisplay).map(
                          ([key, value]) =>
                            isUndefined(value) ? null : (
                              <Box
                                className={
                                  key === 'reason' ? 'tw:w-full' : 'tw:min-w-48'
                                }
                                data-testid={`event-data-${key}`}
                                direction="col"
                                gap={1}
                                key={key}>
                                <Typography
                                  className="tw:text-tertiary!"
                                  data-testid="event-data-key"
                                  size="text-sm">
                                  {`${getLabelsForEventDetails(
                                    key as keyof AlertEventDetailsToDisplay
                                  )}:`}
                                </Typography>
                                <Typography
                                  data-testid="event-data-value"
                                  size="text-sm"
                                  weight="medium">
                                  {value}
                                </Typography>
                              </Box>
                            )
                        )}
                      </Box>
                      {!isEmpty(changeEventData.changeDescription) && (
                        <Box direction="col" gap={2}>
                          <Typography size="text-sm" weight="medium">
                            {`${t('label.change-entity', {
                              entity: t('label.description'),
                            })}:`}
                          </Typography>
                          <SchemaEditor
                            className="border"
                            mode={{ name: CSMode.JAVASCRIPT }}
                            options={{ readOnly: true }}
                            showCopyButton={false}
                            value={JSON.stringify(
                              changeEventData.changeDescription
                            )}
                          />
                        </Box>
                      )}
                    </Box>
                  </AccordionPanel>
                </AccordionItem>
              );
            })}
          </Accordion>
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
      </Box>
    );
  };

  return (
    <Box className="tw:w-full" direction="col" gap={4}>
      <Box align="start" direction="row" justify="between">
        <Box direction="col" gap={2}>
          <Typography size="text-sm" weight="medium">
            {`${t('label.description')}:`}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.alert-recent-events-description', { alertName })}
          </Typography>
        </Box>
        <Dropdown.Root>
          <Button
            color="secondary"
            data-testid="filter-button"
            iconLeading={FilterLines}
            size="sm">
            {filter !== AlertRecentEventFilters.ALL && (
              <Typography
                data-testid="applied-filter-text"
                size="text-sm"
                weight="medium">
                {` : ${getAlertEventsFilterLabels(
                  filter as AlertRecentEventFilters
                )}`}
              </Typography>
            )}
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              selectedKeys={new Set([filter])}
              selectionMode="single"
              onAction={(key) =>
                setFilter(String(key) as AlertRecentEventFilters)
              }>
              {filterItems.map((item) => (
                <Dropdown.Item id={item.id} key={item.id}>
                  {item.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </Box>
      {renderEventsList()}
    </Box>
  );
}

export default NotificationRecentEvents;
