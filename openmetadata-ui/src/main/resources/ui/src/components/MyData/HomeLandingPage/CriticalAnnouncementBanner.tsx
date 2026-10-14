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
  Badge,
  ButtonUtility,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import { getAnnouncementTypeConfig } from '../../../utils/AnnouncementsUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { stripMarkdown } from '../../../utils/RichTextStringUtils';

export interface CriticalAnnouncementBannerProps {
  announcement: AnnouncementEntity;
  onDismiss: () => void;
}

// FeaturedIcon's light theme fills solid red under `dark-mode`; the design
// tints the circle instead, the way the Critical surface reads elsewhere.
const ICON_CLASS = 'tw:dark:bg-utility-error-50 tw:dark:text-utility-error-500';

// A global `h2` rule outranks Typography's size, so it is restated as
// important to keep the heading at the banner's scale.
const TITLE_CLASS =
  'tw:min-w-0 tw:break-words tw:text-pretty tw:text-lg! tw:leading-7! tw:text-primary';

/**
 * One critical system announcement as the Home page's top banner.
 *
 * `dark-mode` makes the banner a dark island in either theme, as the design
 * draws it: every token and core component inside resolves to its dark value,
 * so the surface, text, badge and icon need no colour of their own.
 */
const CriticalAnnouncementBanner = ({
  announcement,
  onDismiss,
}: CriticalAnnouncementBannerProps) => {
  const { t } = useTranslation();
  const { icon } = getAnnouncementTypeConfig(announcement);
  const title = getEntityName(announcement);
  const description = stripMarkdown(announcement.description ?? '').trim();

  return (
    <div
      className="dark-mode tw:relative tw:flex tw:items-start tw:gap-4 tw:rounded-xl tw:bg-secondary tw:py-4 tw:pr-12 tw:pl-5"
      data-testid="critical-announcement-banner">
      <FeaturedIcon
        outlined
        className={ICON_CLASS}
        color="error"
        icon={icon}
        size="md"
        theme="light"
      />

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
          {/* A title with no break points (an FQN, a URL) must still wrap
              rather than push the badge past the banner's edge. */}
          <Typography
            as="h2"
            className={TITLE_CLASS}
            data-testid="critical-announcement-title"
            size="text-lg"
            weight="semibold">
            {title}
          </Typography>
          <Badge color="error" size="sm">
            {t('label.critical')}
          </Badge>
        </div>

        {description && (
          <Typography
            as="p"
            className="tw:text-pretty tw:text-secondary"
            data-testid="critical-announcement-description"
            ellipsis={{ rows: 3, tooltip: description }}
            size="text-sm">
            {description}
          </Typography>
        )}
      </div>

      <ButtonUtility
        className="tw:absolute tw:top-3 tw:right-3"
        color="tertiary"
        data-testid="critical-announcement-dismiss"
        icon={XClose}
        size="sm"
        tooltip={t('label.dismiss')}
        onClick={onDismiss}
      />
    </div>
  );
};

export default CriticalAnnouncementBanner;
