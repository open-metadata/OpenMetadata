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
  Button,
  Col,
  Collapse,
  Dropdown,
  Row,
  Skeleton,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, startCase } from 'lodash';
import { MenuInfo } from 'rc-menu/lib/interface';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FilterIcon } from '../../../../assets/svg/ic-feeds-filter.svg';
import { PAGE_SIZE_BASE } from '../../../../constants/constants';
import { AlertRecentEventFilters } from '../../../../enums/Alerts.enum';
import { CSMode } from '../../../../enums/codemirror.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import {
  Status,
  TypedEvent,
} from '../../../../generated/events/api/typedEvent';
import { getAlertEventsFromId } from '../../../../rest/alertsAPI';
import {
  getAlertRecentEventsFilterOptions,
  getAlertStatusIcon,
  getEventDetailsToDisplay,
  getLabelsForEventDetails,
} from '../../../../utils/Alerts/AlertsUtil';
import { formatDateTime } from '../../../../utils/date-time/DateTimeUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import SchemaEditor from '../../../Database/SchemaEditor/SchemaEditor';
import './alert-recent-events-tab.less';
import {
  AlertEventDetailsToDisplay,
  AlertRecentEventsTabProps,
} from './AlertRecentEventsTab.interface';

const { Panel } = Collapse;

function AlertRecentEventsTab({ id }: AlertRecentEventsTabProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<AlertRecentEventFilters | Status>(
    AlertRecentEventFilters.ALL
  );
  const [alertRecentEvents, setAlertRecentEvents] = useState<TypedEvent[]>();
  const [loading, setLoading] = useState<boolean>(false);

  const filterMenuItems = useMemo(
    () => getAlertRecentEventsFilterOptions(),
    []
  );

  const handleFilterSelect = useCallback(
    (item: MenuInfo) => setFilter(item.key as AlertRecentEventFilters),
    [filter]
  );

  const getAlertRecentEvents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAlertEventsFromId({
        id,
        params: {
          ...(filter === AlertRecentEventFilters.ALL
            ? { limit: PAGE_SIZE_BASE }
            : { status: filter as Status, limit: PAGE_SIZE_BASE }),
        },
      });

      setAlertRecentEvents(response);
    } catch (e) {
      showErrorToast(e as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [id, filter]);

  const recentEventsList = useMemo(() => {
    if (loading) {
      return (
        <Collapse className="recent-events-collapse" expandIconPosition="end">
          {Array.from({ length: 5 }).map((_, index) => (
            <Panel header={<Skeleton active paragraph={false} />} key={index} />
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
            {filter === AlertRecentEventFilters.ALL
              ? t('message.no-data-available-entity', {
                  entity: t('label.recent-event-plural'),
                })
              : t('message.no-data-available-for-selected-filter')}
          </Typography.Paragraph>
        </ErrorPlaceHolder>
      );
    }

    return (
      <Collapse
        className="recent-events-collapse"
        defaultActiveKey={['1']}
        expandIconPosition="end">
        {alertRecentEvents?.map((typedEvent) => {
          const eventData = typedEvent.data[0];
          const eventDetailsToDisplay = getEventDetailsToDisplay(eventData);

          return (
            <Panel
              header={
                <Row justify="space-between">
                  <Col>
                    <Row align="middle" gutter={[16, 16]}>
                      <Col>
                        <Tooltip title={startCase(typedEvent.status)}>
                          {getAlertStatusIcon(typedEvent.status)}{' '}
                        </Tooltip>
                      </Col>
                      <Col>
                        <Tooltip title={startCase(eventData.entityType)}>
                          {searchClassBase.getEntityIcon(
                            eventData.entityType ?? '',
                            'h-4 w-4'
                          )}
                        </Tooltip>
                      </Col>
                      <Col>
                        <Typography.Text>{eventData.id}</Typography.Text>
                      </Col>
                    </Row>
                  </Col>
                  <Col>
                    <Typography.Text className="text-grey-muted">
                      {formatDateTime(typedEvent.timestamp)}
                    </Typography.Text>
                  </Col>
                </Row>
              }
              key={`${eventData.id}-${eventData.timestamp}`}>
              <Row gutter={[16, 16]}>
                <Col>
                  <Row gutter={[16, 16]}>
                    {Object.entries(eventDetailsToDisplay).map(
                      ([key, value]) => (
                        <Col key={key} span={8}>
                          <Row gutter={[4, 4]}>
                            <Col span={24}>
                              <Typography.Text className="text-grey-muted">
                                {`${getLabelsForEventDetails(
                                  key as keyof AlertEventDetailsToDisplay
                                )}:`}
                              </Typography.Text>
                            </Col>
                            <Col span={24}>
                              <Typography.Text className="font-medium">
                                {value}
                              </Typography.Text>
                            </Col>
                          </Row>
                        </Col>
                      )
                    )}
                  </Row>
                </Col>
                <Col span={24}>
                  <SchemaEditor
                    className="border"
                    mode={{ name: CSMode.JAVASCRIPT }}
                    options={{ readOnly: true }}
                    showCopyButton={false}
                    value={JSON.stringify(eventData)}
                  />
                </Col>
              </Row>
            </Panel>
          );
        })}
      </Collapse>
    );
  }, [loading, filter, alertRecentEvents]);

  useEffect(() => {
    getAlertRecentEvents();
  }, [filter]);

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Row justify="space-between">
          <Col>
            <Typography.Text className="text-grey-muted">
              {t('message.alert-recent-events-description')}
            </Typography.Text>
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
                icon={<FilterIcon height={16} />}
              />
            </Dropdown>
          </Col>
        </Row>
      </Col>
      <Col span={24}>{recentEventsList}</Col>
    </Row>
  );
}

export default AlertRecentEventsTab;
