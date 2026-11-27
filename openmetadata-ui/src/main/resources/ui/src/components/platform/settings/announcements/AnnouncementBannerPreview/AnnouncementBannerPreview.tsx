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
  BadgeWithDot,
  Box,
  Typography,
} from '@openmetadata/ui-core-components';
import { DateTime } from 'luxon';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SYSTEM_ANNOUNCEMENT_STATUS_LABEL_KEYS } from '../../../../../constants/platform/systemAnnouncements.constants';
import { AnnouncementEntity } from '../../../../../rest/announcementsAPI';
import {
  ANNOUNCEMENT_STATUS_COLORS,
  getAnnouncementStatus,
} from '../../../../../utils/AnnouncementsUtils';
import { isDescriptionContentEmpty } from '../../../../../utils/BlockEditorPureUtils';
import AnnouncementBanner from '../../../../common/AnnouncementsWidget/AnnouncementBanner.component';
import { toAnnouncementTypeFields } from '../../../../Modals/AnnouncementModal/announcementFormUtils';
import { AnnouncementFormValues } from '../../../../Modals/AnnouncementModal/AnnouncementModal.interface';

interface AnnouncementBannerPreviewProps {
  /** Shown in the banner footer, as it will be once saved. */
  createdBy?: string;
  values: AnnouncementFormValues;
}

/**
 * The banner as the organization will see it, from the form's live values. The
 * status is derived from the window the same way the server derives it, so the
 * author sees whether saving puts it live now or schedules it.
 */
const AnnouncementBannerPreview = ({
  createdBy,
  values,
}: AnnouncementBannerPreviewProps) => {
  const { t } = useTranslation();
  const { startTime, endTime } = values;
  const hasWindow = startTime != null && endTime != null;

  const preview = useMemo<AnnouncementEntity>(
    () => ({
      id: 'preview',
      name: 'preview',
      displayName: values.title?.trim() || t('label.announcement-title'),
      description: isDescriptionContentEmpty(values.description)
        ? t('message.enter-a-description')
        : values.description,
      startTime: startTime ?? 0,
      endTime: endTime ?? 0,
      createdBy,
      ...toAnnouncementTypeFields(values),
    }),
    [values, startTime, endTime, createdBy, t]
  );

  const status = hasWindow ? getAnnouncementStatus(preview) : undefined;

  return (
    <Box
      className="tw:gap-3 tw:rounded-xl tw:border tw:border-secondary tw:bg-secondary tw:p-4"
      data-testid="announcement-preview"
      direction="col">
      <Box align="center" justify="between">
        <Typography
          className="tw:text-secondary"
          size="text-sm"
          weight="semibold">
          {t('label.preview')}
        </Typography>
        {status && (
          <span data-testid="announcement-preview-status">
            <BadgeWithDot
              color={ANNOUNCEMENT_STATUS_COLORS[status]}
              size="sm"
              type="pill-color">
              {t(SYSTEM_ANNOUNCEMENT_STATUS_LABEL_KEYS[status])}
            </BadgeWithDot>
          </span>
        )}
      </Box>
      <AnnouncementBanner
        announcement={preview}
        testId="announcement-preview-banner"
      />
      {hasWindow && (
        <Typography
          className="tw:text-tertiary"
          data-testid="announcement-preview-window"
          size="text-xs">
          {`${DateTime.fromMillis(startTime).toLocaleString(
            DateTime.DATE_MED
          )} → ${DateTime.fromMillis(endTime).toLocaleString(
            DateTime.DATE_MED
          )}`}
        </Typography>
      )}
      <Typography className="tw:text-tertiary" size="text-xs">
        {t('message.system-announcement-preview-hint')}
      </Typography>
    </Box>
  );
};

export default AnnouncementBannerPreview;
