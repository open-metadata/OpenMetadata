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
import { Alert, Card, Col, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AnnouncementIcon } from '../../../assets/svg/announcements-v1.svg';
import { ReactComponent as AnnouncementsEmptyIcon } from '../../../assets/svg/announcment-no-data-placeholder.svg';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { Thread } from '../../../generated/entity/feed/thread';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import FeedCardBodyV1 from '../../ActivityFeed/ActivityFeedCard/FeedCardBody/FeedCardBodyV1';
import FeedCardHeaderV1 from '../../ActivityFeed/ActivityFeedCard/FeedCardHeader/FeedCardHeaderV1';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../Loader/Loader';
import './announcements-widget.less';

export interface AnnouncementsWidgetProps extends WidgetCommonProps {
  isAnnouncementLoading?: boolean;
  announcements: Thread[];
}

function AnnouncementsWidget({
  announcements,
  isAnnouncementLoading = false,
}: Readonly<AnnouncementsWidgetProps>) {
  const { t } = useTranslation();

  const announcement = useMemo(() => {
    if (isAnnouncementLoading) {
      return <Loader size="small" />;
    }

    if (isEmpty(announcements)) {
      return (
        <div className="flex-center h-full">
          <ErrorPlaceHolder
            icon={
              <AnnouncementsEmptyIcon
                height={SIZE.X_SMALL}
                width={SIZE.X_SMALL}
              />
            }
            type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
            <Typography.Paragraph>
              {t('message.no-entity-data-available', {
                entity: t('label.announcement-lowercase'),
              })}
            </Typography.Paragraph>
          </ErrorPlaceHolder>
        </div>
      );
    }

    return (
      <div className="announcement-container-list">
        <Row gutter={[8, 8]}>
          {announcements.map((item) => {
            return (
              <Col key={item.id} span={24}>
                <Alert
                  className="right-panel-announcement"
                  description={
                    <>
                      <FeedCardHeaderV1
                        about={item.about}
                        className="d-inline"
                        createdBy={item.createdBy}
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
              </Col>
            );
          })}
        </Row>
      </div>
    );
  }, [isAnnouncementLoading, announcements]);

  return (
    <Card className="announcement-container card-widget h-full">
      <Row justify="space-between">
        <Col>
          <Typography.Paragraph className="font-medium m-b-sm">
            {t('label.recent-announcement-plural')}
          </Typography.Paragraph>
        </Col>
      </Row>
      {announcement}
    </Card>
  );
}

export default AnnouncementsWidget;
