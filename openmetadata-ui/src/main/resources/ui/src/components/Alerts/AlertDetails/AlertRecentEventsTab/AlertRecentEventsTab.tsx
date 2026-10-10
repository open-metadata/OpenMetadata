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
  EmptyPlaceholder,
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
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { withSuspenseFallback } from '../../../AppRouter/withSuspenseFallback';
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
    (key: Key) => setFilter(key as AlertRecentEventFilters),
    [filter]
  );

  const getAlertRecentEvents = useCallback(
    async (paginationOffset = 0) => {
      try {
        setLoading(true);
        const { data, paging } = await getAlertEventsFromId({
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
        });

        setAlertRecentEvents(data);
        handlePagingChange(paging);
      } catch (e) {
        showErrorToast(e as AxiosError);
      } finally {
        setLoading(false);
      }
    },
    [id, filter, pageSize, handlePagingChange]
  );

  const pagingHandler = ({ offset, page }: PagingHandlerParams) => {
    handlePageChange(page);
    handlePagingChange({ ...paging, offset });
    getAlertRecentEvents(offset);
  };

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
                <NoFilterFunnel className="tw:text-fg-quaternary" />
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
    }

    return (
      <Grid
        className="layout-row layout-grid"
        style={{ ...getLayoutGutter(16, 16) }}>
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
                  <AccordionHeader className="tw:px-3 tw:py-2 tw:font-normal">
                    <Box
                      className="layout-row"
                      data-testid={`event-collapse-${changeEventData.id}`}
                      justify="between"
                      wrap="wrap">
                      <Box className="layout-column tw:block">
                        <Box
                          align="center"
                          className="layout-row"
                          style={{ ...getLayoutGutter(16, 16) }}
                          wrap="wrap">
                          <Box className="layout-column tw:block">
                            {/* Display icon for the status of the alert event */}
                            <Tooltip
                              excludeTriggerFromTabOrder
                              title={startCase(typedEvent.status)}
                              triggerClassName="tw:inline-flex">
                              {getAlertStatusIcon(typedEvent.status)}{' '}
                            </Tooltip>
                          </Box>
                          <Box className="layout-column tw:block">
                            {/* Display icon for the asset the change event is related to */}
                            <Tooltip
                              excludeTriggerFromTabOrder
                              title={startCase(changeEventData.entityType)}
                              triggerClassName="tw:inline-flex">
                              {searchClassBase.getEntityIcon(
                                changeEventData.entityType ?? '',
                                'h-4 w-4'
                              )}
                            </Tooltip>
                          </Box>
                          <Box className="layout-column tw:block">
                            {/* Display the change event id */}
                            <Typography>{changeEventData.id}</Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box className="layout-column tw:block">
                        {/* Display the event timestamp */}
                        <Typography color="secondary">
                          {formatDateTime(typedEvent.timestamp)}
                        </Typography>
                      </Box>
                    </Box>
                  </AccordionHeader>
                  <AccordionPanel unmountOnCollapse>
                    <Box
                      className="layout-row"
                      data-testid={`event-details-${changeEventData.id}`}
                      style={{ ...getLayoutGutter(16, 16) }}
                      wrap="wrap">
                      <Box className="layout-column tw:block">
                        <Grid
                          className="layout-row layout-grid"
                          style={{ ...getLayoutGutter(16, 16) }}>
                          {Object.entries(changeEventDataToDisplay).map(
                            ([key, value]) =>
                              isUndefined(value) ? null : (
                                <Grid.Item
                                  className="layout-column"
                                  key={key}
                                  span={key === 'reason' ? 24 : 8}>
                                  <Grid
                                    className="layout-row layout-grid"
                                    data-testid={`event-data-${key}`}
                                    style={{ ...getLayoutGutter(4, 4) }}>
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
                                        className="font-medium"
                                        data-testid="event-data-value">
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
                          <Box
                            className="layout-column tw:block"
                            style={{ maxWidth: '100%', flex: '0 0 100%' }}>
                            <Typography className="font-medium">
                              {`${t('label.change-entity', {
                                entity: t('label.description'),
                              })}:`}
                            </Typography>
                          </Box>
                          <Box
                            className="layout-column tw:block"
                            style={{ maxWidth: '100%', flex: '0 0 100%' }}>
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
    pagingHandler,
    handlePageSizeChange,
    showPagination,
  ]);

  useEffect(() => {
    getAlertRecentEvents();
  }, [filter, pageSize]);

  return (
    <Grid
      className="layout-row layout-grid"
      style={{ ...getLayoutGutter(16, 16) }}>
      <Grid.Item className="layout-column" span={24}>
        <Box className="layout-row" justify="between" wrap="wrap">
          <Box className="layout-column tw:block">
            <Grid
              className="layout-row layout-grid"
              style={{ ...getLayoutGutter(8, 8) }}>
              <Grid.Item className="layout-column" span={24}>
                <Typography className="font-medium">
                  {`${t('label.description')}:`}
                </Typography>
              </Grid.Item>
              <Grid.Item className="layout-column" span={24}>
                <Typography color="secondary">
                  {t('message.alert-recent-events-description', { alertName })}
                </Typography>
              </Grid.Item>
            </Grid>
          </Box>
          <Box className="layout-column tw:block">
            <Dropdown.Root>
              <Button
                aria-label={t('label.filter-plural')}
                color="secondary"
                data-testid="filter-button"
                iconLeading={FilterLines}
                size="sm">
                {filter !== AlertRecentEventFilters.ALL && (
                  <Typography
                    className="font-medium"
                    data-testid="applied-filter-text">{` : ${getAlertEventsFilterLabels(
                    filter as AlertRecentEventFilters
                  )}`}</Typography>
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
