/*
 *  Copyright 2024 Collate.
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
  Grid,
  Skeleton,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Bell01,
  FilterLines,
  NoFilterFunnel,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { Key, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { INITIAL_PAGING_VALUE } from '../../../../constants/constants';
import { AlertRecentEventFilters } from '../../../../enums/Alerts.enum';
import { CSMode } from '../../../../enums/codemirror.enum';
import {
  Status,
  TypedEvent,
} from '../../../../generated/events/api/typedEvent';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { getAlertEventsFromId } from '../../../../rest/alertsAPI';
import {
  getAlertRecentEventsFilterOptions,
  getAlertStatusIcon,
} from '../../../../utils/Alerts/AlertsUtil';
import {
  getAlertEventsFilterLabels,
  getChangeEventDataFromTypedEvent,
  getLabelsForEventDetails,
} from '../../../../utils/Alerts/AlertsUtilPure';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { withSuspenseFallback } from '../../../AppRouter/withSuspenseFallback';
import NoDataPlaceholder from '../../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoFilteredResultsPlaceholder from '../../../common/EmptyPlaceholder/NoFilteredResultsPlaceholder';
import NextPreviousWithOffset from '../../../common/NextPreviousWithOffset/NextPreviousWithOffset';
import { PagingHandlerParams } from '../../../common/NextPreviousWithOffset/NextPreviousWithOffset.interface';
import {
  AlertEventDetailsToDisplay,
  AlertRecentEventsTabProps,
} from './AlertRecentEventsTab.interface';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../../Database/SchemaEditor/SchemaEditor'))
);

function AlertRecentEventsTab({ alertDetails }: AlertRecentEventsTabProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<AlertRecentEventFilters | Status>(
    AlertRecentEventFilters.ALL
  );
  const [alertRecentEvents, setAlertRecentEvents] = useState<TypedEvent[]>();
  const [loading, setLoading] = useState<boolean>(false);
  const {
    currentPage,
    pageSize,
    paging,
    handlePageChange,
    handlePageSizeChange,
    showPagination,
    handlePagingChange,
  } = usePaging();

  const { id, alertName } = useMemo(
    () => ({
      id: alertDetails.id,
      alertName: getEntityName(alertDetails),
    }),
    [alertDetails]
  );

  const filterMenuItems = useMemo(
    () => getAlertRecentEventsFilterOptions(),
    []
  );

  const handleFilterSelect = useCallback(
    (key: Key) => {
      setFilter(key as AlertRecentEventFilters);
      handlePageChange(INITIAL_PAGING_VALUE);
    },
    [handlePageChange]
  );

  const getAlertRecentEvents = useCallback(
    (paginationOffset: number, isStale: () => boolean) => {
      setLoading(true);
      getAlertEventsFromId({
        id,
        params: {
          ...(filter === AlertRecentEventFilters.ALL
            ? { limit: pageSize, paginationOffset }
            : {
                status: filter as Status,
                limit: pageSize,
                paginationOffset,
              }),
        },
      })
        .then(({ data, paging }) => {
          if (isStale()) {
            return;
          }
          // A page restored from the URL can lie past the end, where the empty state hides the paginator.
          if (isEmpty(data) && paginationOffset > 0) {
            handlePageChange(INITIAL_PAGING_VALUE);

            return;
          }

          setAlertRecentEvents(data);
          handlePagingChange(paging);
        })
        .catch((e: AxiosError) => {
          if (!isStale()) {
            showErrorToast(e);
          }
        })
        .finally(() => {
          if (!isStale()) {
            setLoading(false);
          }
        });
    },
    [id, filter, pageSize, handlePagingChange, handlePageChange]
  );

  const pagingHandler = useCallback(
    ({ page }: PagingHandlerParams) => handlePageChange(page),
    [handlePageChange]
  );

  const recentEventsList = useMemo(() => {
    if (loading) {
      return (
        <Accordion>
          {Array.from(
            { length: 5 },
            (_, index) => `alert-event-skeleton-${index}`
          ).map((skeletonKey) => (
            <AccordionItem
              isDisabled
              data-testid="skeleton-loading-panel"
              id={skeletonKey}
              key={skeletonKey}>
              <AccordionHeader>
                <Skeleton height={16} width="100%" />
              </AccordionHeader>
            </AccordionItem>
          ))}
        </Accordion>
      );
    }

    if (isEmpty(alertRecentEvents)) {
      const isFiltered = filter !== AlertRecentEventFilters.ALL;
      const EmptyStatePlaceholder = isFiltered
        ? NoFilteredResultsPlaceholder
        : NoDataPlaceholder;

      return (
        <Box className="tw:relative tw:min-h-80 tw:w-full">
          <EmptyStatePlaceholder
            description={t(
              isFiltered
                ? 'message.no-data-available-for-selected-filter'
                : 'message.no-recent-events-description'
            )}
            icon={
              isFiltered ? (
                <NoFilterFunnel />
              ) : (
                <Bell01 className="tw:text-fg-brand-primary" />
              )
            }
            title={t(
              isFiltered
                ? 'message.no-results-for-filters'
                : 'message.no-recent-events'
            )}
          />
        </Box>
      );
    }

    return (
      <Grid
        className="layout-row layout-grid tw:[--layout-gutter:var(--om-space-16)] tw:-mx-2"
        rowGap="4">
        <Grid.Item
          className="layout-column"
          data-testid="recent-events-list"
          span={24}>
          <Accordion allowsMultipleExpanded>
            {alertRecentEvents?.map((typedEvent) => {
              // Get the change event data from the typedEvent object
              const { changeEventData, changeEventDataToDisplay } =
                getChangeEventDataFromTypedEvent(typedEvent);

              return (
                <AccordionItem
                  id={`${changeEventData.id}-${changeEventData.timestamp}`}
                  key={`${changeEventData.id}-${changeEventData.timestamp}`}>
                  <AccordionHeader>
                    <Box
                      align="center"
                      className="tw:w-full"
                      data-testid={`event-collapse-${changeEventData.id}`}
                      gap={4}
                      justify="between"
                      wrap="wrap">
                      <Box align="center" gap={4}>
                        <Tooltip
                          arrow
                          excludeTriggerFromTabOrder
                          title={startCase(typedEvent.status)}
                          triggerClassName="tw:inline-flex">
                          {getAlertStatusIcon(typedEvent.status)}
                        </Tooltip>
                        <Tooltip
                          arrow
                          excludeTriggerFromTabOrder
                          title={startCase(changeEventData.entityType)}
                          triggerClassName="tw:inline-flex">
                          {searchClassBase.getEntityIcon(
                            changeEventData.entityType ?? '',
                            'h-4 w-4'
                          )}
                        </Tooltip>
                        <Typography>
                          {isEmpty(typedEvent.data)
                            ? t('label.unreadable-event')
                            : changeEventData.id}
                        </Typography>
                      </Box>
                      <Typography color="secondary">
                        {formatDateTime(typedEvent.timestamp)}
                      </Typography>
                    </Box>
                  </AccordionHeader>
                  <AccordionPanel unmountOnCollapse>
                    <Box
                      className="layout-row tw:[--layout-gutter:var(--om-space-16)] tw:-mx-2"
                      data-testid={`event-details-${changeEventData.id}`}
                      rowGap={4}
                      wrap="wrap">
                      <Box className="layout-column tw:block">
                        <Grid
                          className="layout-row layout-grid tw:[--layout-gutter:var(--om-space-16)] tw:-mx-2"
                          rowGap="4">
                          {Object.entries(changeEventDataToDisplay).map(
                            ([key, value]) =>
                              isUndefined(value) ? null : (
                                <Grid.Item
                                  className="layout-column"
                                  key={key}
                                  span={key === 'reason' ? 24 : 8}>
                                  <Grid
                                    className="layout-row layout-grid tw:[--layout-gutter:var(--om-space-4)] tw:-mx-0.5"
                                    data-testid={`event-data-${key}`}
                                    rowGap="1">
                                    <Grid.Item
                                      className="layout-column"
                                      span={24}>
                                      <Typography
                                        color="secondary"
                                        data-testid="event-data-key">
                                        {`${getLabelsForEventDetails(
                                          key as keyof AlertEventDetailsToDisplay
                                        )}:`}
                                      </Typography>
                                    </Grid.Item>
                                    <Grid.Item
                                      className="layout-column"
                                      span={24}>
                                      <Typography
                                        data-testid="event-data-value"
                                        weight="medium">
                                        {value}
                                      </Typography>
                                    </Grid.Item>
                                  </Grid>
                                </Grid.Item>
                              )
                          )}
                        </Grid>
                      </Box>
                      {!isEmpty(changeEventData.changeDescription) && (
                        <>
                          <Box className="layout-column tw:block tw:max-w-full tw:basis-full tw:grow-0 tw:shrink-0">
                            <Typography weight="medium">
                              {`${t('label.change-entity', {
                                entity: t('label.description'),
                              })}:`}
                            </Typography>
                          </Box>
                          <Box className="layout-column tw:block tw:max-w-full tw:basis-full tw:grow-0 tw:shrink-0">
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
                        </>
                      )}
                    </Box>
                  </AccordionPanel>
                </AccordionItem>
              );
            })}
          </Accordion>
        </Grid.Item>
        {showPagination && (
          <Grid.Item className="layout-column" span={24}>
            <NextPreviousWithOffset
              currentPage={currentPage}
              isLoading={loading}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={pagingHandler}
              onShowSizeChange={handlePageSizeChange}
            />
          </Grid.Item>
        )}
      </Grid>
    );
  }, [
    loading,
    filter,
    alertRecentEvents,
    pageSize,
    currentPage,
    paging,
    pagingHandler,
    handlePageSizeChange,
    showPagination,
    t,
  ]);

  useEffect(() => {
    let ignore = false;
    getAlertRecentEvents((currentPage - 1) * pageSize, () => ignore);

    return () => {
      ignore = true;
    };
  }, [currentPage, getAlertRecentEvents, pageSize]);

  const appliedFilterText =
    filter === AlertRecentEventFilters.ALL
      ? ''
      : ` : ${getAlertEventsFilterLabels(filter as AlertRecentEventFilters)}`;

  return (
    <Grid
      className="layout-row layout-grid tw:[--layout-gutter:var(--om-space-16)] tw:-mx-2"
      rowGap="4">
      <Grid.Item className="layout-column" span={24}>
        <Box align="start" gap={4} justify="between">
          <Box className="tw:min-w-0" direction="col" gap={1}>
            <Typography weight="medium">
              {`${t('label.description')}:`}
            </Typography>
            <Typography color="secondary">
              {t('message.alert-recent-events-description', { alertName })}
            </Typography>
          </Box>
          <Box className="tw:shrink-0">
            <Dropdown.Root>
              <Button
                aria-label={`${t('label.filter-plural')}${appliedFilterText}`}
                color="secondary"
                data-testid="filter-button"
                iconLeading={FilterLines}
                size="sm">
                {appliedFilterText && (
                  <Typography data-testid="applied-filter-text" weight="medium">
                    {appliedFilterText}
                  </Typography>
                )}
              </Button>
              <Dropdown.Popover className="tw:w-auto">
                <Dropdown.Menu
                  aria-label={t('label.filter-plural')}
                  selectedKeys={[filter]}
                  onAction={handleFilterSelect}>
                  {filterMenuItems.map((item) => (
                    <Dropdown.Item
                      id={item.key}
                      key={item.key}
                      label={item.label}
                    />
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </Box>
        </Box>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        {recentEventsList}
      </Grid.Item>
    </Grid>
  );
}

export default AlertRecentEventsTab;
