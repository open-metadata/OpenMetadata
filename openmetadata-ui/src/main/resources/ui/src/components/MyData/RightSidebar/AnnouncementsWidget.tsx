/*
 *  Copyright 2023 Collate.
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
import { CloseOutlined, DragOutlined } from '@ant-design/icons';
import { Alert, Col, Row, Space, Typography } from 'antd';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AnnouncementIcon } from '../../../assets/svg/announcements-v1.svg';
import { Thread } from '../../../generated/entity/feed/thread';
import { WidgetCommonProps } from '../../../pages/CustomisablePages/CustomisablePage.interface';
import FeedCardBodyV1 from '../../ActivityFeed/ActivityFeedCard/FeedCardBody/FeedCardBodyV1';
import FeedCardHeaderV1 from '../../ActivityFeed/ActivityFeedCard/FeedCardHeader/FeedCardHeaderV1';

export interface AnnouncementsWidgetProps extends WidgetCommonProps {
  announcements: Thread[];
}

function AnnouncementsWidget({
  announcements,
  isEditView,
  handleRemoveWidget,
  widgetKey,
}: Readonly<AnnouncementsWidgetProps>) {
  const { t } = useTranslation();

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, [widgetKey]);

  return (
    <div className="bg-white h-full">
      <Row justify="space-between">
        <Col>
          <Typography.Paragraph className="right-panel-label m-b-sm">
            {t('label.recent-announcement-plural')}
          </Typography.Paragraph>
        </Col>
        {isEditView && (
          <Col>
            <Space>
              <DragOutlined
                className="drag-widget-icon cursor-pointer"
                size={14}
              />
              <CloseOutlined size={14} onClick={handleCloseClick} />
            </Space>
          </Col>
        )}
      </Row>
      <div className="announcement-container-list">
        {isEmpty(announcements) && (
          <Typography.Text className="text-xs">
            {t('message.no-entity-data-available', {
              entity: t('label.announcement-lowercase'),
            })}
          </Typography.Text>
        )}
        {announcements.map((item) => {
          return (
            <Alert
              className="m-b-xs right-panel-announcement"
              description={
                <>
                  <FeedCardHeaderV1
                    about={item.about}
                    className="d-inline"
                    createdBy={item.createdBy}
                    showUserAvatar={false}
                    timeStamp={item.threadTs}
                  />
                  <FeedCardBodyV1
                    isOpenInDrawer
                    announcement={item.announcement}
                    className="p-t-xs"
                    isEditPost={false}
                    message={item.message}
                    showSchedule={false}
                  />
                </>
              }
              key={item.id}
              message={
                <div className="d-flex announcement-alert-heading">
                  <AnnouncementIcon width={20} />
                  <span className="text-sm p-l-xss">
                    {t('label.announcement')}
                  </span>
                </div>
              }
              type="info"
            />
          );
        })}
      </div>
    </div>
  );
}

export default AnnouncementsWidget;
