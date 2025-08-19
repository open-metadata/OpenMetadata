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

import { Button, Col, Collapse, Dropdown, Row, Skeleton, Typography,  } from 'antd';
import { Tooltip } from '../../../common/AntdCompat';;
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FilterIcon } from '../../../../assets/svg/ic-feeds-filter.svg';
import { AlertRecentEventFilters } from '../../../../enums/Alerts.enum';
import { CSMode } from '../../../../enums/codemirror.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import {
  Status,
  TypedEvent,
} from '../../../../generated/events/api/typedEvent';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { getAlertEventsFromId } from '../../../../rest/alertsAPI';
import {
  getAlertEventsFilterLabels,
  getAlertRecentEventsFilterOptions,
  getAlertStatusIcon,
  getChangeEventDataFromTypedEvent,
  getLabelsForEventDetails,
} from '../../../../utils/Alerts/AlertsUtil';
import { Transi18next } from '../../../../utils/CommonUtils';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPreviousWithOffset from '../../../common/NextPreviousWithOffset/NextPreviousWithOffset';
import { PagingHandlerParams } from '../../../common/NextPreviousWithOffset/NextPreviousWithOffset.interface';
import SchemaEditor from '../../../Database/SchemaEditor/SchemaEditor';
import './alert-recent-events-tab.less';
import {
  AlertEventDetailsToDisplay,
  AlertRecentEventsTabProps,
} from './AlertRecentEventsTab.interface';

const { Panel } = Collapse;

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
    (item: MenuInfo) => setFilter(item.key as AlertRecentEventFilters),
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
        <Collapse className="recent-events-collapse" expandIconPosition="end">
          {Array.from({ length: 5 }).map((_, index) => (
            <Panel
              data-testid="skeleton-loading-panel"
              header={<Skeleton active paragraph={false} />}
              key={index}
            />
          ))}
        </Collapse>
      );
    }

    if (isEmpty(alertRecentEvents)) {
      return (
        <ErrorPlaceHolder
          className="p-y-lg"
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography.Paragraph className="w-max-500">
            {filter === AlertRecentEventFilters.ALL ? (
              <Transi18next
                i18nKey="message.no-data-available-entity"
                renderElement={<b />}
                values={{
                  entity: t('label.recent-event-plural'),
                }}
              />
            ) : (
              t('message.no-data-available-for-selected-filter')
            )}
          </Typography.Paragraph>
        </ErrorPlaceHolder>
      );
    }

    return (
      <Row gutter={[16, 16]}>
        <Col data-testid="recent-events-list" span={24}>
          <Collapse
            className="recent-events-collapse"
            defaultActiveKey={['1']}
            expandIconPosition="end">
            {alertRecentEvents?.map((typedEvent) => {
              // Get the change event data from the typedEvent object
              const { changeEventData, changeEventDataToDisplay } =
                getChangeEventDataFromTypedEvent(typedEvent);

              return (
                <Panel
                  header={
                    <Row
                      data-testid={`event-collapse-${changeEventData.id}`}
                      justify="space-between">
                      <Col>
                        <Row align="middle" gutter={[16, 16]}>
                          <Col>
                            {/* Display icon for the status of the alert event */}
                            <Tooltip
                              className="flex-center"
                              title={startCase(typedEvent.status)}>
                              {getAlertStatusIcon(typedEvent.status)}{' '}
                            </Tooltip>
                          </Col>
                          <Col>
                            {/* Display icon for the asset the change event is related to */}
                            <Tooltip
                              className="flex-center"
                              title={startCase(changeEventData.entityType)}>
                              {searchClassBase.getEntityIcon(
                                changeEventData.entityType ?? '',
                                'h-4 w-4'
                              )}
                            </Tooltip>
                          </Col>
                          <Col>
                            {/* Display the change event id */}
                            <Typography.Text>
                              {changeEventData.id}
                            </Typography.Text>
                          </Col>
                        </Row>
                      </Col>
                      <Col>
                        {/* Display the event timestamp */}
                        <Typography.Text className="text-grey-muted">
                          {formatDateTime(typedEvent.timestamp)}
                        </Typography.Text>
                      </Col>
                    </Row>
                  }
                  key={`${changeEventData.id}-${changeEventData.timestamp}`}>
                  <Row
                    data-testid={`event-details-${changeEventData.id}`}
                    gutter={[16, 16]}>
                    <Col>
                      <Row gutter={[16, 16]}>
                        {Object.entries(changeEventDataToDisplay).map(
                          ([key, value]) =>
                            isUndefined(value) ? null : (
                              <Col key={key} span={key === 'reason' ? 24 : 8}>
                                <Row
                                  data-testid={`event-data-${key}`}
                                  gutter={[4, 4]}>
                                  <Col span={24}>
                                    <Typography.Text
                                      className="text-grey-muted"
                                      data-testid="event-data-key">
                                      {`${getLabelsForEventDetails(
                                        key as keyof AlertEventDetailsToDisplay
                                      )}:`}
                                    </Typography.Text>
                                  </Col>
                                  <Col span={24}>
                                    <Typography.Text
                                      className="font-medium"
                                      data-testid="event-data-value">
                                      {value}
                                    </Typography.Text>
                                  </Col>
                                </Row>
                              </Col>
                            )
                        )}
                      </Row>
                    </Col>
                    {!isEmpty(changeEventData.changeDescription) && (
                      <>
                        <Col span={24}>
                          <Typography.Text className="font-medium">
                            {`${t('label.change-entity', {
                              entity: t('label.description'),
                            })}:`}
                          </Typography.Text>
                        </Col>
                        <Col span={24}>
                          <SchemaEditor
                            className="border"
                            mode={{ name: CSMode.JAVASCRIPT }}
                            options={{ readOnly: true }}
                            showCopyButton={false}
                            value={JSON.stringify(
                              changeEventData.changeDescription
                            )}
                          />
                        </Col>
                      </>
                    )}
                  </Row>
                </Panel>
              );
            })}
          </Collapse>
        </Col>
        {showPagination && (
          <Col span={24}>
            <NextPreviousWithOffset
              currentPage={currentPage}
              isLoading={loading}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={pagingHandler}
              onShowSizeChange={handlePageSizeChange}
            />
          </Col>
        )}
      </Row>
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
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Row justify="space-between">
          <Col>
            <Row gutter={[8, 8]}>
              <Col span={24}>
                <Typography.Text className="font-medium">
                  {`${t('label.description')}:`}
                </Typography.Text>
              </Col>
              <Col span={24}>
                <Typography.Text className="text-grey-muted">
                  {t('message.alert-recent-events-description', { alertName })}
                </Typography.Text>
              </Col>
            </Row>
          </Col>
          <Col>
            <Dropdown
              menu={{
                items: filterMenuItems,
                selectedKeys: [filter],
                onClick: handleFilterSelect,
              }}
              placement="bottomRight"
              trigger={['click']}>
              <Button
                className="flex-center"
                data-testid="filter-button"
                icon={<FilterIcon height={16} />}>
                {filter !== AlertRecentEventFilters.ALL && (
                  <Typography.Text
                    className="font-medium"
                    data-testid="applied-filter-text">{` : ${getAlertEventsFilterLabels(
                    filter as AlertRecentEventFilters
                  )}`}</Typography.Text>
                )}
              </Button>
            </Dropdown>
          </Col>
        </Row>
      </Col>
      <Col span={24}>{recentEventsList}</Col>
    </Row>
  );
}

export default AlertRecentEventsTab;
