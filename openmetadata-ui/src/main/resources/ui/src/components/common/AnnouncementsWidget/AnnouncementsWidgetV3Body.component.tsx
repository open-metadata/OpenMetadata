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

import { Box, ButtonUtility, Skeleton } from '@openmetadata/ui-core-components';
import { ChevronLeft, ChevronRight } from '@untitledui/icons';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AnnouncementBanner from './AnnouncementBanner.component';
import { AnnouncementsWidgetV3BodyProps } from './AnnouncementsWidgetV3Body.interface';

// The frame draws the carousel arrows as circular white buttons. `secondary`
// carries the white fill and the border, but that border is painted on ::after,
// so the radius has to be set there too or the button rounds and its edge stays
// square.
const ARROW_CLASS = 'tw:size-7 tw:rounded-full tw:after:rounded-full';

const AnnouncementsWidgetV3Body = ({
  announcements,
  onItemClick,
  loading = false,
  testId = 'announcements-widget-v3',
  className,
}: AnnouncementsWidgetV3BodyProps) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  // Dismissal is for this page view only — announcements have no per-user
  // read state to persist it to.
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const visible = useMemo(
    () => announcements.filter(({ id }) => !dismissedIds.includes(id)),
    [announcements, dismissedIds]
  );

  useEffect(() => {
    setCurrentIndex(0);
    setExpanded(false);
  }, [announcements]);

  const total = visible.length;
  const index = Math.min(currentIndex, Math.max(total - 1, 0));
  const current = visible[index];

  const handleStep = useCallback(
    (step: number) => {
      setCurrentIndex((prev) =>
        Math.min(Math.max(prev + step, 0), Math.max(total - 1, 0))
      );
      setExpanded(false);
    },
    [total]
  );

  const handleDismiss = useCallback(() => {
    setDismissedIds((prev) => [...prev, current.id]);
    setExpanded(false);
  }, [current]);

  if (loading) {
    return (
      <Skeleton
        className={classNames('tw:rounded-lg', className)}
        data-testid={`${testId}-loading`}
        height={40}
        variant="rectangular"
        width="100%"
      />
    );
  }

  if (total === 0) {
    return null;
  }

  return (
    <Box
      align="center"
      className={classNames('tw:gap-1', className)}
      data-testid={testId}>
      {total > 1 && (
        <ButtonUtility
          aria-label={t('label.previous')}
          className={ARROW_CLASS}
          color="secondary"
          data-testid="announcement-prev-btn"
          icon={ChevronLeft}
          isDisabled={index === 0}
          size="xs"
          onClick={() => handleStep(-1)}
        />
      )}

      <AnnouncementBanner
        announcement={current}
        className="tw:min-w-0 tw:flex-1"
        expanded={expanded}
        testId="announcement-banner"
        onClick={() => onItemClick(current)}
        onDismiss={handleDismiss}
        onToggleExpand={() => setExpanded((prev) => !prev)}
      />

      {total > 1 && (
        <ButtonUtility
          aria-label={t('label.next')}
          className={ARROW_CLASS}
          color="secondary"
          data-testid="announcement-next-btn"
          icon={ChevronRight}
          isDisabled={index === total - 1}
          size="xs"
          onClick={() => handleStep(1)}
        />
      )}
    </Box>
  );
};

export default AnnouncementsWidgetV3Body;
