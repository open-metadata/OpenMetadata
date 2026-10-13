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
  Avatar,
  Badge,
  Box,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import {
  DATE_TIME_12_HOUR_FORMAT,
  formatDateTimeLong,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import Loader from '../Loader/Loader';
import {
  VersionHistoryItem,
  VersionHistorySlideoutProps,
} from './VersionHistorySlideout.interface';

const RELATIVE_TIME_THRESHOLD = 24 * 60 * 60 * 1000;
const SLIDEOUT_WIDTH = 520;

const formatUpdatedAt = (updatedAt?: number): string => {
  if (!updatedAt) {
    return '';
  }

  return Date.now() - updatedAt < RELATIVE_TIME_THRESHOLD
    ? getRelativeTime(updatedAt)
    : formatDateTimeLong(updatedAt, DATE_TIME_12_HOUR_FORMAT);
};

/**
 * The version-history side panel: a newest-first timeline of versions, each with what changed,
 * who changed it and when. The caller loads the versions and supplies any per-version action.
 */
export const VersionHistorySlideout = <T extends VersionHistoryItem>({
  isOpen,
  isLoading,
  entries,
  subtitle,
  emptyMessage,
  testId,
  renderAction,
  onClose,
}: VersionHistorySlideoutProps<T>) => {
  const { t } = useTranslation();

  const renderTimeline = () => (
    <Box direction="col">
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        const initials = (entry.updatedBy ?? '?').charAt(0).toUpperCase();

        return (
          <Box gap={4} key={entry.version}>
            <Box align="center" className="tw:shrink-0" direction="col">
              <span
                className={`tw:mt-1.5 tw:size-3.5 tw:shrink-0 tw:rounded-full tw:border-2 ${
                  entry.isCurrent
                    ? 'tw:border-brand tw:bg-brand-solid'
                    : 'tw:border-primary tw:bg-primary'
                }`}
                data-testid={`version-dot-${entry.version}`}
              />
              {!isLast && (
                <span className="tw:my-1 tw:w-0 tw:flex-1 tw:border-l tw:border-secondary" />
              )}
            </Box>

            <Box className="tw:min-w-0 tw:flex-1 tw:pb-5.5" direction="col">
              <Box
                align="center"
                className="tw:mb-1.5"
                gap={2}
                justify="between">
                <Box align="center" gap={2}>
                  <Typography
                    className="tw:text-primary"
                    size="text-sm"
                    weight="semibold">
                    {t('label.version-short', { version: entry.version })}
                  </Typography>
                  {entry.isCurrent && (
                    <Badge color="brand" size="sm">
                      {t('label.current')}
                    </Badge>
                  )}
                </Box>
                {renderAction?.(entry)}
              </Box>

              {entry.summary}

              {entry.updatedBy && (
                <Box align="center" className="tw:mt-2" gap={2}>
                  <Avatar initials={initials} size="xs" />
                  <Typography
                    className="tw:text-brand-secondary"
                    size="text-xs"
                    weight="medium">
                    {entry.updatedBy}
                  </Typography>
                  <Typography className="tw:text-quaternary" size="text-xs">
                    ·
                  </Typography>
                  <Typography className="tw:text-quaternary" size="text-xs">
                    {formatUpdatedAt(entry.updatedAt)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );

  const renderBody = () => {
    if (isLoading && entries.length === 0) {
      return (
        <Box align="center" className="tw:min-h-40 tw:flex-1" justify="center">
          <Loader />
        </Box>
      );
    }

    if (entries.length === 0) {
      return (
        <Box
          align="center"
          className="tw:min-h-40 tw:flex-1 tw:p-10"
          justify="center">
          <Typography className="tw:text-tertiary" size="text-sm">
            {emptyMessage}
          </Typography>
        </Box>
      );
    }

    return renderTimeline();
  };

  return (
    <SlideoutMenu
      isOpen={isOpen}
      width={SLIDEOUT_WIDTH}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}>
      <SlideoutMenu.Header
        className="tw:border-b tw:border-secondary tw:px-6! tw:py-5!"
        onClose={onClose}>
        <Box direction="col" gap={1}>
          <Typography
            className="tw:text-primary"
            size="text-lg"
            weight="semibold">
            {t('label.version-history')}
          </Typography>
          {subtitle && (
            <Typography className="tw:text-secondary" size="text-sm">
              {subtitle}
            </Typography>
          )}
        </Box>
      </SlideoutMenu.Header>
      <SlideoutMenu.Content
        className="tw:flex tw:flex-col tw:overflow-auto"
        data-testid={testId}>
        {renderBody()}
      </SlideoutMenu.Content>
    </SlideoutMenu>
  );
};
