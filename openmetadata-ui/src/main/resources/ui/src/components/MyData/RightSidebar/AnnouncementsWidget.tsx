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
import { Alert, Col, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AnnouncementIcon from '../../../assets/svg/announcements-v1.svg?react';
import AnnouncementsEmptyIcon from '../../../assets/svg/announcment-no-data-placeholder.svg?react';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { Thread } from '../../../generated/entity/feed/thread';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getEntityFQN } from '../../../utils/FeedUtils';
import FeedCardBodyV1 from '../../ActivityFeed/ActivityFeedCard/FeedCardBody/FeedCardBodyV1';
import FeedCardHeaderV2 from '../../ActivityFeed/ActivityFeedCardV2/FeedCardHeader/FeedCardHeaderV2';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import './announcements-widget.less';

export interface AnnouncementsWidgetProps extends WidgetCommonProps {
  isAnnouncementLoading?: boolean;
  announcements?: Thread[];
}

function AnnouncementsWidget({
  announcements = [],
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
            const fqn = getEntityFQN(item.about);

            return (
              <Col data-testid={`announcement-${fqn}`} key={item.id} span={24}>
                <Alert
                  className="right-panel-announcement"
                  description={
                    <>
                      <FeedCardHeaderV2
                        isAnnouncement
                        about={item.about}
                        className="d-inline"
                        createdBy={item.createdBy}
                        feed={item}
                        fieldName={item.feedInfo?.fieldName}
                        timeStamp={item.threadTs}
                      />
                      <FeedCardBodyV1
                        isOpenInDrawer
                        announcement={item.announcement}
                        className="p-t-xs"
                        feed={item}
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
    <div
      className="announcement-container card-widget h-full"
      data-testid="announcement-container">
      <Row justify="space-between">
        <Col>
          <Typography.Paragraph className="font-medium m-b-sm">
            {t('label.recent-announcement-plural')}
          </Typography.Paragraph>
        </Col>
      </Row>
      {announcement}
    </div>
  );
}

export default AnnouncementsWidget;
