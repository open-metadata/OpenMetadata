/*
 *  Copyright 2025 Collate.
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
  Dot,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import {
  ANNOUNCEMENT_STATUS_COLORS,
  ANNOUNCEMENT_STATUS_LABEL_KEYS,
  ANNOUNCEMENT_SURFACE_CLASSES,
  getAnnouncementTypeConfig,
  getAnnouncementTypeLabel,
} from '../../../utils/AnnouncementsUtils';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import {
  getEntityFQN,
  getEntityType,
  prepareFeedLink,
} from '../../../utils/FeedUtilsPure';
import { stripMarkdown } from '../../../utils/RichTextStringUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import UserChip from '../../common/UserChip/UserChip';
import { getAnnouncementLifecycle } from './announcementLifecycle';

export interface AnnouncementCardProps {
  announcement: AnnouncementEntity;
  /** Sizing/snap classes — the rail sits cards two-up, the dialog stacks them. */
  className?: string;
  onDismiss: (id: string) => void;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  announcement,
  className,
  onDismiss,
}) => {
  const { t } = useTranslation();

  // The type table lives in OpenMetadata so a Critical announcement reads the
  // same here as it does on an entity page — Collate defines no colours of its own.
  const typeConfig = useMemo(
    () => getAnnouncementTypeConfig(announcement),
    [announcement]
  );
  const { color, icon: TypeIcon } = typeConfig;
  const surface = ANNOUNCEMENT_SURFACE_CLASSES[color];

  const { isDismissible, status, timestamp } = useMemo(
    () => getAnnouncementLifecycle(announcement),
    [announcement]
  );

  const { description, entityFQN, entityType, href, title, userName } =
    useMemo(() => {
      const fqn = getEntityFQN(announcement.entityLink ?? '');
      const type = getEntityType(announcement.entityLink ?? '');

      return {
        title: announcement.displayName ?? announcement.name,
        // The body is clamped to two lines, where markdown structure reads as
        // noise anyway — flatten it rather than mount an editor per card.
        description: stripMarkdown(announcement.description ?? ''),
        userName: announcement.createdBy || '',
        entityFQN: fqn,
        entityType: type,
        // An announcement with no entityLink has nowhere to navigate to.
        href: type && fqn ? prepareFeedLink(type, fqn) : undefined,
      };
    }, [announcement]);

  const entityIcon = useMemo(
    () => searchClassBase.getEntityIcon(entityType),
    [entityType]
  );

  return (
    <div
      className={classNames(
        'tw:relative tw:box-border tw:flex tw:flex-col tw:rounded-xl tw:p-3.5',
        // The type's surface carries its border as an `outline`, so the focus
        // ring re-colours that same outline rather than adding a second edge —
        // a `tw:border` here would double it up.
        'tw:outline-1 tw:-outline-offset-1',
        surface.surface,
        // The title's stretched ::after makes the whole card the hit target, so
        // the focus ring belongs on the card, not on the title text alone.
        'tw:has-[a:focus-visible]:outline-2 tw:has-[a:focus-visible]:outline-brand',
        // Past/future announcements read as context, not as today's news.
        { 'tw:opacity-70': !isDismissible },
        className
      )}
      data-testid={`announcement-card-${announcement.id}`}>
      {/* Type icon + badge on the left, lifecycle on the right — the same
        header the drawer card and the banner use. 16px beside 12px label text,
        as on the banner. */}
      <div className="tw:flex tw:items-center tw:gap-2">
        <TypeIcon
          className={classNames('tw:shrink-0 tw:size-4', surface.icon)}
        />
        <Badge
          className="tw:bg-primary!"
          color={color}
          data-testid="announcement-type-badge"
          size="sm"
          type="color">
          {getAnnouncementTypeLabel(typeConfig, t)}
        </Badge>

        <div className="tw:ml-auto tw:flex tw:shrink-0 tw:items-center tw:gap-1">
          {/* A live announcement is self-evidently live — only the ones the
            rail would not have shown need naming. */}
          {!isDismissible && (
            // Same Badge the drawer card uses, so one status reads identically
            // on both surfaces.
            <Badge
              color={ANNOUNCEMENT_STATUS_COLORS[status]}
              data-testid="announcement-status"
              size="sm"
              type="color">
              {t(ANNOUNCEMENT_STATUS_LABEL_KEYS[status])}
            </Badge>
          )}

          {isDismissible && (
            // z-10 keeps the dismiss target above the title's stretched ::after.
            <ButtonUtility
              // Bare glyph — no filled container. size-6 keeps the hit target at
              // the 24px minimum even though the glyph itself is 14px.
              className={classNames(
                'tw:z-10 tw:size-6 tw:shrink-0 tw:rounded-md tw:p-0 tw:*:data-icon:size-3.5',
                surface.icon
              )}
              color="tertiary"
              icon={XClose}
              size="xs"
              tooltip={t('label.close')}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                onDismiss(announcement.id);
              }}
            />
          )}
        </div>
      </div>

      {href ? (
        // `after:inset-0` stretches the anchor over the whole card: one tab
        // stop, real link semantics (⌘/middle click), no nested interactives.
        <Link
          className="tw:mt-2 tw:truncate tw:text-sm tw:font-semibold tw:text-primary tw:after:absolute tw:after:inset-0 tw:after:rounded-xl"
          to={href}>
          {title}
        </Link>
      ) : (
        // `!` on the colours below: Typography renders `.prose`, whose unlayered
        // `color` rule is emitted after the Tailwind utilities and would
        // otherwise silently win over anything set here.
        <Typography
          className="tw:mt-2 tw:text-primary!"
          ellipsis={{ rows: 1 }}
          size="text-sm"
          weight="semibold">
          {title}
        </Typography>
      )}

      {description && (
        <Tooltip title={description}>
          <Typography
            className="tw:mt-1 tw:text-pretty tw:text-secondary!"
            ellipsis={{ rows: 2 }}
            size="text-xs">
            {description}
          </Typography>
        </Tooltip>
      )}

      {/* Footer — author, the asset it is about, and when it happened. */}
      <div className="tw:mt-2.5 tw:flex tw:min-w-0 tw:items-center tw:gap-1.5">
        {userName && (
          <UserChip
            avatarSize={16}
            className="tw:text-xs tw:text-secondary"
            user={userName}
          />
        )}

        {entityFQN && (
          <>
            <Dot className="tw:text-placeholder_subtle" size="xs" />
            <span
              aria-hidden
              className="tw:flex tw:size-3.5 tw:shrink-0 tw:items-center tw:text-tertiary tw:[&_svg]:size-full">
              {entityIcon}
            </span>
            <Typography
              className="tw:min-w-0 tw:text-secondary!"
              ellipsis={{ rows: 1 }}
              size="text-xs">
              {entityFQN}
            </Typography>
          </>
        )}

        {timestamp && (
          <time
            className="tw:ml-auto tw:shrink-0 tw:text-xs tw:text-tertiary"
            dateTime={new Date(timestamp).toISOString()}>
            {getRelativeTime(timestamp)}
          </time>
        )}
      </div>
    </div>
  );
};

export default AnnouncementCard;
