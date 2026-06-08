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

import { Typography } from '@openmetadata/ui-core-components';
import { Announcement02, ChevronDown } from '@untitledui/icons';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import Loader from '../Loader/Loader';
import AnnouncementItemV2 from './AnnouncementItemV2.component';

const DEFAULT_DISPLAY_COUNT = 4;

interface AnnouncementsWidgetV2BodyProps {
  announcements: AnnouncementEntity[];
  onItemClick: (announcement: AnnouncementEntity) => void;
  loading?: boolean;
  displayCount?: number;
  testId?: string;
  className?: string;
  hideEntityName?: boolean;
}

const AnnouncementsWidgetV2Body = ({
  announcements,
  onItemClick,
  loading = false,
  displayCount = DEFAULT_DISPLAY_COUNT,
  testId = 'announcements-widget-v2',
  className,
  hideEntityName = false,
}: AnnouncementsWidgetV2BodyProps) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const displayedAnnouncements = useMemo(
    () => (showAll ? announcements : announcements.slice(0, displayCount)),
    [announcements, showAll, displayCount]
  );

  if (loading) {
    return (
      <div
        className={classNames(
          'tw:rounded-xl tw:border tw:border-gray-blue-100 tw:bg-utility-blue-dark-50 tw:px-1 tw:pt-3 tw:pb-1',
          className
        )}
        data-testid={testId}>
        <Loader size="small" />
      </div>
    );
  }

  if (announcements.length === 0) {
    return null;
  }

  return (
    <div
      className={classNames(
        'tw:rounded-xl tw:border tw:border-gray-blue-100 tw:bg-utility-blue-dark-50 tw:px-1 tw:pt-3 tw:pb-1',
        className
      )}
      data-testid={testId}>
      <div className="tw:flex tw:items-center tw:justify-between tw:mb-2 tw:px-3">
        <div className="tw:flex tw:items-center tw:gap-2">
          <Announcement02 className="tw:size-5 tw:text-fg-brand-primary" />
          <Typography
            as="span"
            className="tw:text-text-primary"
            size="text-sm"
            weight="semibold">
            {t('label.announcement-plural')}
          </Typography>
          <Typography
            as="span"
            className="tw:rounded-md tw:bg-bg-primary tw:px-2 tw:py-0.5 tw:text-text-tertiary"
            size="text-sm"
            weight="medium">
            {announcements.length}
          </Typography>
        </div>
      </div>

      <div className="tw:rounded-lg tw:bg-bg-primary tw:px-4 tw:py-1">
        <div className="tw:divide-y tw:divide-border-primary">
          {displayedAnnouncements.map((announcement) => (
            <AnnouncementItemV2
              announcement={announcement}
              hideEntityName={hideEntityName}
              key={announcement.id}
              onClick={() => onItemClick(announcement)}
            />
          ))}
        </div>

        {announcements.length > displayCount && (
          <button
            className="tw:flex tw:items-center tw:gap-1 tw:py-3 tw:text-sm tw:font-medium tw:text-fg-brand-primary tw:cursor-pointer tw:border-none tw:bg-transparent"
            data-testid="view-all-btn"
            onClick={() => setShowAll((prev) => !prev)}>
            {showAll ? t('label.show-less') : t('label.view-all')}
            <ChevronDown
              className={classNames('tw:size-4 tw:transition-transform', {
                'tw:rotate-180': showAll,
              })}
            />
          </button>
        )}
      </div>
    </div>
  );
};

export default AnnouncementsWidgetV2Body;
