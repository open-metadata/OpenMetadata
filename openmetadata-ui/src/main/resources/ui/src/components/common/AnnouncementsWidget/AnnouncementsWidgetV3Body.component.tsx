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
  Button,
  ButtonUtility,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Announcement02, ChevronLeft, ChevronRight } from '@untitledui/icons';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AnnouncementItemV3 from './AnnouncementItemV3.component';
import { AnnouncementsWidgetV3BodyProps } from './AnnouncementsWidgetV3Body.interface';

const CARD_CLASSNAME =
  'tw:rounded-[10px] tw:border tw:border-gray-blue-100 tw:bg-linear-to-b tw:from-[#f2f8fb] tw:to-white tw:px-4 tw:py-3.5';

const AnnouncementsWidgetV3Body = ({
  announcements,
  onItemClick,
  onViewAll,
  loading = false,
  testId = 'announcements-widget-v3',
  className,
}: AnnouncementsWidgetV3BodyProps) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [announcements]);

  if (loading) {
    return (
      <div
        className={classNames(CARD_CLASSNAME, className)}
        data-testid={testId}>
        <div
          className="tw:flex tw:flex-col tw:gap-[9px] tw:pl-[3px]"
          data-testid={`${testId}-loading`}>
          <div className="tw:flex tw:items-center tw:gap-[9px]">
            <Skeleton
              className="tw:shrink-0 tw:rounded-[1px]"
              height={35}
              variant="rectangular"
              width={4}
            />
            <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-[4px]">
              <Skeleton height={14} variant="text" width="55%" />
              <Skeleton height={12} variant="text" width="90%" />
            </div>
          </div>
          <div className="tw:flex tw:items-center tw:gap-1.5">
            <Skeleton variant="circular" width={14} />
            <Skeleton height={12} variant="text" width={120} />
          </div>
        </div>
      </div>
    );
  }

  if (announcements.length === 0) {
    return null;
  }

  const total = announcements.length;
  const index = Math.min(currentIndex, total - 1);
  const current = announcements[index];

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
          {total > 1 && (
            <div className="tw:flex tw:items-center tw:gap-px">
              <ButtonUtility
                className="tw:p-1 tw:pr-0"
                color="tertiary"
                data-testid="announcement-prev-btn"
                icon={ChevronLeft}
                isDisabled={index === 0}
                size="xs"
                tooltip={t('label.previous')}
                onClick={() => setCurrentIndex(Math.max(0, index - 1))}
              />
              <Typography
                as="span"
                className="tw:text-text-primary"
                size="text-xs"
                weight="medium">
                {`${index + 1}/${total}`}
              </Typography>
              <ButtonUtility
                className="tw:p-1 tw:pl-0"
                color="tertiary"
                data-testid="announcement-next-btn"
                icon={ChevronRight}
                isDisabled={index === total - 1}
                size="xs"
                tooltip={t('label.next')}
                onClick={() => setCurrentIndex(Math.min(total - 1, index + 1))}
              />
            </div>
          )}
        </div>

        {onViewAll && (
          <Button
            color="link-color"
            data-testid="view-all-btn"
            size="sm"
            onClick={onViewAll}>
            {t('label.view-all')}
          </Button>
        )}
      </div>

      <AnnouncementItemV3
        announcement={current}
        onClick={() => onItemClick(current)}
      />
    </div>
  );
};

export default AnnouncementsWidgetV3Body;
