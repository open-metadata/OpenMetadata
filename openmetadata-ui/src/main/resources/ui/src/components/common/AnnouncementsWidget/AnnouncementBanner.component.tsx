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
  BadgeColors,
  Box,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import classNames from 'classnames';
import { MouseEvent, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import {
  ANNOUNCEMENT_SURFACE_CLASSES,
  getAnnouncementTypeConfig,
} from '../../../utils/AnnouncementsUtils';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityFQN } from '../../../utils/FeedUtilsPure';
import { getUserPath } from '../../../utils/RouterUtils';
import { stripMarkdown } from '../../../utils/StringUtils';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import { AnnouncementBannerProps } from './AnnouncementBanner.interface';

const stopAnd = (handler?: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  handler?.();
};

/**
 * The title doubles as the banner's click target — a real `<button>` so the
 * whole surface doesn't have to fake one with `role` + `tabIndex`.
 */
const AnnouncementTitle = ({
  className,
  onClick,
  title,
}: {
  className: string;
  onClick?: () => void;
  title: string;
}) => {
  const text = (
    <Typography
      as="span"
      className={className}
      ellipsis={{ rows: 1, tooltip: true }}
      size="text-sm"
      weight="medium">
      {title}
    </Typography>
  );

  if (!onClick) {
    return text;
  }

  return (
    <button
      className="tw:min-w-0 tw:cursor-pointer tw:border-none tw:bg-transparent tw:p-0 tw:text-left"
      data-testid="announcement-title-btn"
      type="button"
      onClick={onClick}>
      {text}
    </button>
  );
};

const AnnouncementFooter = ({
  announcement,
  showEntity,
}: {
  announcement: AnnouncementEntity;
  showEntity: boolean;
}) => {
  const createdBy = announcement.createdBy;
  const [, , user] = useUserProfile({
    permission: true,
    name: createdBy ?? '',
  });
  const entityFQN = getEntityFQN(announcement.entityLink ?? '');

  if (!createdBy) {
    return null;
  }

  const postedBy = getEntityName(user) || createdBy;

  return (
    <Box align="center" className="tw:gap-1.5">
      <ProfilePicture displayName={postedBy} name={createdBy} width="16" />
      <Typography as="span" className="tw:text-text-secondary" size="text-xs">
        <Link
          className="tw:text-text-secondary tw:no-underline!"
          to={getUserPath(createdBy)}
          onClick={(e) => e.stopPropagation()}>
          {postedBy}
        </Link>
      </Typography>
      {showEntity && entityFQN && (
        <>
          <span className="tw:text-text-tertiary">&middot;</span>
          <Typography
            as="span"
            className="tw:text-text-secondary"
            ellipsis={{ rows: 1, tooltip: true }}
            size="text-xs">
            {entityFQN}
          </Typography>
        </>
      )}
    </Box>
  );
};

const AnnouncementActions = ({
  actionClassName,
  expanded,
  showToggle,
  onDismiss,
  onToggleExpand,
}: {
  actionClassName: string;
  expanded: boolean;
  showToggle: boolean;
  onDismiss?: () => void;
  onToggleExpand?: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:ml-auto tw:shrink-0 tw:gap-1">
      {showToggle && (
        <Button
          className={actionClassName}
          color="link-gray"
          data-testid="announcement-toggle-btn"
          size="sm"
          onClick={stopAnd(onToggleExpand)}>
          {expanded ? t('label.hide') : t('label.view')}
        </Button>
      )}
      {onDismiss && (
        <ButtonUtility
          aria-label={t('label.close')}
          className={actionClassName}
          color="tertiary"
          data-testid="announcement-dismiss-btn"
          icon={XClose}
          size="xs"
          onClick={stopAnd(onDismiss)}
        />
      )}
    </Box>
  );
};

interface AnnouncementBodyProps {
  announcement: AnnouncementEntity;
  badgeColor: BadgeColors;
  hasDescription: boolean;
  labelKey: string;
  plainDescription: string;
  showEntity: boolean;
  title: string;
  titleClassName: string;
  typeChip: ReactNode;
  onClick?: () => void;
}

const TypeBadge = ({
  badgeColor,
  labelKey,
}: {
  badgeColor: BadgeColors;
  labelKey: string;
}) => {
  const { t } = useTranslation();

  return (
    <Badge
      className="tw:bg-primary!"
      color={badgeColor}
      data-testid="announcement-type-badge"
      size="sm"
      type="color">
      {t(labelKey)}
    </Badge>
  );
};

/** One line: chip, badge, title and a flattened description, then the actions. */
const CollapsedBody = ({
  badgeColor,
  hasDescription,
  labelKey,
  plainDescription,
  title,
  titleClassName,
  typeChip,
  onClick,
}: Omit<AnnouncementBodyProps, 'announcement' | 'showEntity'>) => (
  <>
    {typeChip}
    <TypeBadge badgeColor={badgeColor} labelKey={labelKey} />
    <AnnouncementTitle
      className={titleClassName}
      title={title}
      onClick={onClick}
    />
    {hasDescription && (
      <Typography
        as="span"
        className="tw:min-w-0 tw:flex-1 tw:text-text-secondary"
        data-testid="announcement-description"
        ellipsis={{ rows: 1, tooltip: true }}
        size="text-sm">
        {plainDescription}
      </Typography>
    )}
  </>
);

/**
 * Chip and badge share a header row with the actions; the title, description and
 * footer then run the full width of the banner rather than being indented past
 * the chip, which is how the frame lays it out.
 */
const ExpandedBody = ({
  announcement,
  badgeColor,
  hasDescription,
  labelKey,
  showEntity,
  title,
  titleClassName,
  typeChip,
  actions,
  onClick,
}: Omit<AnnouncementBodyProps, 'plainDescription'> & {
  actions: ReactNode;
}) => (
  <Box className="tw:min-w-0 tw:flex-1 tw:gap-2" direction="col">
    <Box align="center" className="tw:min-w-0 tw:gap-2">
      {typeChip}
      <TypeBadge badgeColor={badgeColor} labelKey={labelKey} />
      {actions}
    </Box>

    <AnnouncementTitle
      className={titleClassName}
      title={title}
      onClick={onClick}
    />

    {hasDescription && (
      <RichTextEditorPreviewerV1
        className="tw:[&_p]:text-text-secondary tw:[&_p]:text-sm"
        data-testid="announcement-description"
        enableSeeMoreVariant={false}
        markdown={announcement.description}
        showReadMoreBtn={false}
      />
    )}

    <AnnouncementFooter announcement={announcement} showEntity={showEntity} />
  </Box>
);

const AnnouncementBanner = ({
  announcement,
  variant = 'compact',
  expanded = false,
  onToggleExpand,
  onDismiss,
  onClick,
  className,
  testId = 'announcement-banner',
}: AnnouncementBannerProps) => {
  const {
    color,
    icon: TypeIcon,
    labelKey,
  } = useMemo(() => getAnnouncementTypeConfig(announcement), [announcement]);
  const surface = ANNOUNCEMENT_SURFACE_CLASSES[color];

  // The collapsed strip has one line for everything, so the markdown is flattened
  // rather than rendered — a previewer there would bring block spacing with it.
  const plainDescription = useMemo(
    () => stripMarkdown(announcement.description ?? ''),
    [announcement.description]
  );

  // The full variant is the landing-page banner: always laid out expanded, and
  // the only one that tints its title with the announcement type.
  const isFull = variant === 'full';
  const isExpanded = isFull || expanded;

  const typeChip = (
    <span
      className={classNames(
        'tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border tw:bg-primary',
        surface.border
      )}>
      <TypeIcon className={classNames('tw:size-4', surface.icon)} />
    </span>
  );

  const actions = (
    <AnnouncementActions
      actionClassName={surface.title}
      expanded={expanded}
      showToggle={Boolean(onToggleExpand) && !isFull}
      onDismiss={onDismiss}
      onToggleExpand={onToggleExpand}
    />
  );

  const shared = {
    badgeColor: color,
    hasDescription: !isDescriptionContentEmpty(announcement.description),
    labelKey,
    title: announcement.displayName ?? announcement.name,
    titleClassName: isFull ? surface.title : 'tw:text-text-primary',
    typeChip,
    onClick,
  };

  return (
    <div
      className={classNames(
        'tw:rounded-[10px] tw:outline-1 tw:-outline-offset-1',
        surface.surface,
        isExpanded ? 'tw:px-4 tw:py-3.5' : 'tw:px-3 tw:py-2',
        className
      )}
      data-testid={testId}
      role="status">
      {isExpanded ? (
        <ExpandedBody
          {...shared}
          actions={actions}
          announcement={announcement}
          showEntity={isFull}
        />
      ) : (
        <Box align="center" className="tw:gap-2">
          <CollapsedBody {...shared} plainDescription={plainDescription} />
          {actions}
        </Box>
      )}
    </div>
  );
};

export default AnnouncementBanner;
