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
  EmptyPlaceholder,
  PaginationCardWithControls,
  Select,
  Skeleton,
  Tooltip,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  Bell01,
  CheckCircle,
  Clock,
  FilterLines,
} from '@untitledui/icons';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, startCase } from 'lodash';
import {
  Key,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { AlertRecentEventFilters } from '../../../enums/Alerts.enum';
import { Status, TypedEvent } from '../../../generated/events/api/typedEvent';
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { usePaging } from '../../../hooks/paging/usePaging';
import { getAlertEventsFromId } from '../../../rest/alertsAPI';
import {
  getAlertEventsFilterLabels,
  getChangeEventDataFromTypedEvent,
  getLabelsForEventDetails,
} from '../../../utils/Alerts/AlertsUtilPure';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { computeTotalPages } from '../../../utils/PaginationUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AlertEventDetailsToDisplay } from '../../Alerts/AlertDetails/AlertRecentEventsTab/AlertRecentEventsTab.interface';
import { renderSelectItem } from './AlertAiFormFieldsSelectUtils';

const PAGE_SIZE_OPTIONS = [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE];
const SKELETON_ROWS = 5;

const STATUS_ICONS: Record<
  Status,
  { Icon: typeof CheckCircle; className: string }
> = {
  [Status.Successful]: {
    Icon: CheckCircle,
    className: 'tw:text-fg-success-primary',
  },
  [Status.Failed]: { Icon: AlertCircle, className: 'tw:text-fg-error-primary' },
  [Status.Unprocessed]: {
    Icon: Clock,
    className: 'tw:text-fg-warning-primary',
  },
};

/** An icon with a hover label; the span gives the icon an accessible name. */
const LabelledIcon = ({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) => (
  <Tooltip title={label}>
    <span aria-label={label} className="tw:inline-flex" role="img">
      {children}
    </span>
  </Tooltip>
);

const EventHeader = ({ typedEvent }: { typedEvent: TypedEvent }) => {
  const { changeEventData } = getChangeEventDataFromTypedEvent(typedEvent);
  const { Icon, className } = STATUS_ICONS[typedEvent.status];

  return (
    <Box align="center" className="tw:w-full" gap={4} justify="between">
      <Box align="center" gap={4}>
        <LabelledIcon label={startCase(typedEvent.status)}>
          <Icon className={`tw:size-4 ${className}`} />
        </LabelledIcon>
        <LabelledIcon label={startCase(changeEventData.entityType)}>
          {searchClassBase.getEntityIcon(
            changeEventData.entityType ?? '',
            'tw:size-4 tw:text-fg-quaternary'
          )}
        </LabelledIcon>
        <span className="tw:text-sm tw:font-normal tw:text-primary">
          {changeEventData.id}
        </span>
      </Box>
      <span className="tw:text-sm tw:font-normal tw:text-tertiary">
        {formatDateTime(typedEvent.timestamp)}
      </span>
    </Box>
  );
};

const EventDetails = ({ typedEvent }: { typedEvent: TypedEvent }) => {
  const { t } = useTranslation();
  const { changeEventData, changeEventDataToDisplay } =
    getChangeEventDataFromTypedEvent(typedEvent);

  return (
    <Box
      data-testid={`event-details-${changeEventData.id}`}
      direction="col"
      gap={4}>
      <dl className="tw:m-0 tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-3">
        {Object.entries(changeEventDataToDisplay).map(([key, value]) =>
          isUndefined(value) ? null : (
            <div
              className={key === 'reason' ? 'tw:md:col-span-3' : undefined}
              data-testid={`event-data-${key}`}
              key={key}>
              <dt
                className="tw:text-sm tw:text-tertiary"
                data-testid="event-data-key">
                {`${getLabelsForEventDetails(
                  key as keyof AlertEventDetailsToDisplay
                )}:`}
              </dt>
              <dd
                className="tw:m-0 tw:break-all tw:text-sm tw:font-medium tw:text-primary"
                data-testid="event-data-value">
                {value}
              </dd>
            </div>
          )
        )}
      </dl>
      {!isEmpty(changeEventData.changeDescription) && (
        <Box direction="col" gap={2}>
          <span className="tw:text-sm tw:font-medium tw:text-primary">
            {`${t('label.change-entity', {
              entity: t('label.description'),
            })}:`}
          </span>
          <pre
            className="tw:m-0 tw:max-h-80 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-3 tw:font-mono tw:text-xs tw:text-secondary"
            data-testid="event-change-description">
            {JSON.stringify(changeEventData.changeDescription, null, 2)}
          </pre>
        </Box>
      )}
    </Box>
  );
};

interface AlertAiRecentEventsTabProps {
  alertDetails: EventSubscription;
}

/** Recent events of an alert, filterable by delivery status and paged by offset. */
const AlertAiRecentEventsTab = ({
  alertDetails,
}: AlertAiRecentEventsTabProps) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState(AlertRecentEventFilters.ALL);
  const [events, setEvents] = useState<TypedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const {
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    handlePagingChange,
    pageSize,
    paging,
    showPagination,
  } = usePaging(PAGE_SIZE_BASE, PAGE_SIZE_OPTIONS);
  const { id } = alertDetails;
  const isFiltered = filter !== AlertRecentEventFilters.ALL;

  const filterItems = useMemo(
    () =>
      Object.values(AlertRecentEventFilters).map((status) => ({
        id: status,
        label: getAlertEventsFilterLabels(status),
      })),
    []
  );

  const fetchEvents = useCallback(
    async (paginationOffset = 0) => {
      try {
        setLoading(true);
        const { data, paging } = await getAlertEventsFromId({
          id,
          params: {
            limit: pageSize,
            paginationOffset,
            ...(isFiltered ? { status: filter as unknown as Status } : {}),
          },
        });
        setEvents(data);
        handlePagingChange(paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoading(false);
      }
    },
    [filter, handlePagingChange, id, isFiltered, pageSize]
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleFilterChange = (key: Key | null) => {
    setFilter((key as AlertRecentEventFilters) ?? AlertRecentEventFilters.ALL);
    handlePageChange(INITIAL_PAGING_VALUE);
  };

  const handleEventsPageChange = (page: number) => {
    handlePageChange(page);
    fetchEvents((page - 1) * pageSize);
  };

  const renderEvents = () => {
    if (loading) {
      return (
        <Box direction="col" gap={2}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <div
              data-testid="skeleton-loading-panel"
              key={`alert-event-skeleton-${index}`}>
              <Skeleton height={52} variant="rounded" width="100%" />
            </div>
          ))}
        </Box>
      );
    }

    if (isEmpty(events)) {
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
                <FilterLines className="tw:text-fg-quaternary" />
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
      <Accordion allowsMultipleExpanded data-testid="recent-events-list">
        {events.map((typedEvent) => {
          const { changeEventData } =
            getChangeEventDataFromTypedEvent(typedEvent);

          return (
            <AccordionItem
              id={`${changeEventData.id}-${changeEventData.timestamp}`}
              key={`${changeEventData.id}-${changeEventData.timestamp}`}>
              <AccordionHeader
                data-testid={`event-collapse-${changeEventData.id}`}>
                <EventHeader typedEvent={typedEvent} />
              </AccordionHeader>
              <AccordionPanel unmountOnCollapse>
                <EventDetails typedEvent={typedEvent} />
              </AccordionPanel>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  return (
    <Box data-testid="alert-recent-events" direction="col" gap={4}>
      <Box align="start" gap={4} justify="between">
        <Box direction="col" gap={1}>
          <span className="tw:text-sm tw:font-medium tw:text-primary">
            {`${t('label.description')}:`}
          </span>
          <span className="tw:text-sm tw:text-tertiary">
            {t('message.alert-recent-events-description', {
              alertName: getEntityName(alertDetails),
            })}
          </span>
        </Box>
        <Select
          aria-label={t('label.filter')}
          className="tw:w-40 tw:shrink-0"
          data-testid="recent-events-filter"
          items={filterItems}
          selectedKey={filter}
          size="sm"
          onSelectionChange={handleFilterChange}>
          {renderSelectItem}
        </Select>
      </Box>
      {renderEvents()}
      {showPagination && !loading && (
        <PaginationCardWithControls
          page={currentPage}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          total={computeTotalPages(pageSize, paging.total)}
          onPageChange={handleEventsPageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </Box>
  );
};

export default AlertAiRecentEventsTab;
