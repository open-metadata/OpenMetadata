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
import { Announcement02 } from '@untitledui/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import Loader from '../Loader/Loader';
import AnnouncementItemV3 from './AnnouncementItemV3.component';

const CARD_CLASSNAME =
  'tw:rounded-[10px] tw:border tw:border-gray-blue-100 tw:bg-linear-to-b tw:from-[#f2f8fb] tw:to-white tw:px-4 tw:py-3.5';

interface AnnouncementsWidgetV3BodyProps {
  announcements: AnnouncementEntity[];
  onItemClick: (announcement: AnnouncementEntity) => void;
  onViewAll?: () => void;
  loading?: boolean;
  testId?: string;
  className?: string;
}

const AnnouncementsWidgetV3Body = ({
  announcements,
  onItemClick,
  onViewAll,
  loading = false,
  testId = 'announcements-widget-v3',
  className,
}: AnnouncementsWidgetV3BodyProps) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div
        className={classNames(CARD_CLASSNAME, className)}
        data-testid={testId}>
        <Loader size="small" />
      </div>
    );
  }

  if (announcements.length === 0) {
    return null;
  }

  return (
    <div className={classNames(CARD_CLASSNAME, className)} data-testid={testId}>
      <div className="tw:mb-3 tw:flex tw:items-center tw:justify-between">
        <div className="tw:flex tw:items-center tw:gap-2">
          <Announcement02 className="tw:size-5 tw:text-fg-brand-primary" />
          <Typography
            as="span"
            className="tw:text-text-primary"
            size="text-sm"
            weight="semibold">
            {t('label.announcement-plural')}
          </Typography>
          <span className="tw:flex tw:items-center tw:rounded-md tw:border tw:border-gray-blue-200 tw:bg-gray-blue-50 tw:px-2 tw:py-0.5">
            <Typography
              as="span"
              className="tw:text-gray-blue-700"
              size="text-xs"
              weight="medium">
              {announcements.length}
            </Typography>
          </span>
        </div>

        {onViewAll && (
          <button
            className="tw:cursor-pointer tw:border-none tw:bg-transparent tw:text-xs tw:font-medium tw:text-fg-brand-primary"
            data-testid="view-all-btn"
            onClick={onViewAll}>
            {t('label.view-all')}
          </button>
        )}
      </div>

      <div className="tw:flex tw:flex-col tw:gap-3">
        {announcements.map((announcement) => (
          <AnnouncementItemV3
            announcement={announcement}
            key={announcement.id}
            onClick={() => onItemClick(announcement)}
          />
        ))}
      </div>
    </div>
  );
};

export default AnnouncementsWidgetV3Body;
