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
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import { getAnnouncementTypeConfig } from '../../../utils/AnnouncementsUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { stripMarkdown } from '../../../utils/RichTextStringUtils';

export interface CriticalAnnouncementBannerProps {
  announcement: AnnouncementEntity;
  className?: string;
  onDismiss: () => void;
}

// The surface sits outside the `dark-mode` island: inside it the gray ramp is
// re-tinted, so light gray-900 (the design's banner colour) would resolve to
// the darker dark-mode step instead. The content fills the surface, so a
// short announcement stays centred when the rail matches the tallest one.
const BANNER_CLASS =
  'tw:relative tw:flex tw:rounded-xl tw:bg-utility-gray-900 ' +
  'tw:[.dark-mode_&]:border tw:[.dark-mode_&]:border-subtle tw:[.dark-mode_&]:bg-surface';

const CONTENT_CLASS =
  'dark-mode tw:flex tw:flex-1 tw:items-center tw:gap-4 tw:py-4 tw:pr-12 tw:pl-5';

// A global `h2` rule outranks Typography's size, so it is restated as
// important to keep the heading at the banner's scale.
const TITLE_CLASS =
  'tw:min-w-0 tw:break-words tw:text-pretty tw:text-lg! tw:leading-7! tw:text-primary';

/**
 * One critical system announcement as the Home page's top banner.
 *
 * `dark-mode` makes the banner's content a dark island in either theme, as the
 * design draws it: every token and core component inside resolves to its dark
 * value, so the text, badge and icon need no colour of their own.
 *
 * On a page that is itself dark the island would stand out as a lighter slab,
 * so there it takes the topic cards' surface and edge instead. `[.dark-mode_&]`
 * matches only a `dark-mode` *ancestor*: the `dark:` variant also matches the
 * banner's own class and so could not tell the two cases apart.
 */
const CriticalAnnouncementBanner = ({
  announcement,
  className,
  onDismiss,
}: CriticalAnnouncementBannerProps) => {
  const { t } = useTranslation();
  const { icon } = getAnnouncementTypeConfig(announcement);
  const title = getEntityName(announcement);
  const description = stripMarkdown(announcement.description ?? '').trim();

  return (
    <div
      className={classNames(BANNER_CLASS, className)}
      data-testid="critical-announcement-banner">
      <div className={CONTENT_CLASS}>
        <FeaturedIcon
          outlined
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
    </div>
  );
};

export default CriticalAnnouncementBanner;
