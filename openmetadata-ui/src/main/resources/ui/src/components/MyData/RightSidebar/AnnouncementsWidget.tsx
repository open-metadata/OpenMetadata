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
import { Alert, Box, Typography } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { lazy, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AnnouncementIcon } from '../../../assets/svg/announcements-v1.svg';
import { ReactComponent as AnnouncementsEmptyIcon } from '../../../assets/svg/announcment-no-data-placeholder.svg';
import { SIZE } from '../../../enums/common.enum';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityFQN } from '../../../utils/FeedUtilsPure';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import NoDataPlaceholder from '../../common/EmptyPlaceholder/NoDataPlaceholder';
import Loader from '../../common/Loader/Loader';
import './announcements-widget.less';

const RichTextEditorPreviewerV1 = withSuspenseFallback(
  lazy(() => import('../../common/RichTextEditor/RichTextEditorPreviewerV1'))
);

export interface AnnouncementsWidgetProps extends WidgetCommonProps {
  isAnnouncementLoading?: boolean;
  announcements?: AnnouncementEntity[];
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
          <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
            <NoDataPlaceholder
              data-testid="no-data-placeholder"
              icon={
                <AnnouncementsEmptyIcon
                  height={SIZE.X_SMALL}
                  width={SIZE.X_SMALL}
                />
              }
              title={t('message.no-entity-data-available', {
                entity: t('label.announcement-lowercase'),
              })}
            />
          </div>
        </div>
      );
    }

    return (
      <Box className="announcement-container-list" direction="col" gap={2}>
        {announcements.map((item) => {
          const fqn = getEntityFQN(item.entityLink ?? '');

          return (
            <Alert
              className="right-panel-announcement"
              data-testid={`announcement-${fqn}`}
              key={item.id}
              showIcon={false}
              title={
                <Box align="center" className="announcement-alert-heading">
                  <AnnouncementIcon width={20} />
                  <span className="text-sm p-l-xss">
                    {t('label.announcement')}
                  </span>
                </Box>
              }
              variant="brand">
              <Typography className="d-block text-sm font-medium tw:text-primary">
                {item.displayName ?? item.name}
              </Typography>
              <Typography className="d-block text-xs m-t-xs" color="secondary">
                {formatDateTime(item.updatedAt ?? item.createdAt)}
              </Typography>
              <RichTextEditorPreviewerV1
                className="p-t-xs"
                markdown={item.description}
                reducePreviewLineClass="max-three-lines"
                showReadMoreBtn={false}
              />
            </Alert>
          );
        })}
      </Box>
    );
  }, [isAnnouncementLoading, announcements]);

  return (
    <div
      className="announcement-container card-widget h-full"
      data-testid="announcement-container">
      <Typography as="p" className="font-medium m-b-sm">
        {t('label.recent-announcement-plural')}
      </Typography>
      {announcement}
    </div>
  );
}

export default AnnouncementsWidget;
