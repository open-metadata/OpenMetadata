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
import { XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { MouseEvent, ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import {
  ANNOUNCEMENT_SURFACE_CLASSES,
  getAnnouncementTypeConfig,
  getAnnouncementTypeLabel,
} from '../../../utils/AnnouncementsUtils';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorPureUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityFQN } from '../../../utils/FeedUtilsPure';
import { stripMarkdown } from '../../../utils/RichTextStringUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import { AnnouncementBannerProps } from './AnnouncementBanner.interface';

const stopAnd = (handler?: () => void) => (e: MouseEvent) => {
  e.stopPropagation();
  handler?.();
};

/**
 * The banner cannot *be* the button: it holds the dismiss and expand controls,
 * and ARIA makes a button's descendants presentational, which would hide those
 * from a screen reader. A bare `onClick` on the container is no better — a
 * static element with a click handler and no keyboard path, which three lint
 * rules reject.
 *
 * So the click target is its own transparent control stretched across the
 * banner. It carries no tooltip, which is the point: an earlier version hung
 * the overlay off the title's tooltip trigger, and then hovering anywhere on
 * the banner popped the title's tooltip and the description never got to show
 * its own. Everything that needs its own hover or click sits above it on
 * `OVER_OVERLAY_CLASS`; the chip, the badge and the padding stay beneath it, so
 * a pointer there still opens the announcement.
 *
 * A raw `<button>` rather than core's `Button`: this one draws nothing at all,
 * and `Button`'s padding, fill and `::before` gradient would all have to be
 * overridden away.
 */
// Kept as whole literals so Tailwind still sees each class.
const OVERLAY_CLASS = [
  'tw:absolute tw:inset-0 tw:z-10 tw:cursor-pointer',
  'tw:rounded-[10px] tw:border-none tw:bg-transparent tw:p-0',
  'tw:focus-visible:outline-2 tw:focus-visible:-outline-offset-2 tw:focus-visible:outline-brand',
].join(' ');

/** Sits above the overlay, so it keeps its own hover and clicks. */
const OVER_OVERLAY_CLASS = 'tw:relative tw:z-20';

/**
 * The trigger `Typography` generates for `ellipsis.tooltip` is a `<button>`, and
 * the host is the only handle on it — `className` reaches the innermost span.
 *
 * `min-w-0` lets the trigger shrink below its content and actually ellipsize.
 * `text-start` is what positions it: core gives the trigger
 * `[text-align:inherit]`, which cures the UA `text-align: center` a button is
 * born with but then follows whatever the ancestors say. The trigger is
 * `inline-flex`, so once it is narrower than this host — which happens the
 * moment the host stretches, as it does in the expanded and landing layouts —
 * that inherited value decides where it sits, and the expanded title drifted to
 * the middle. Stating it here keeps the label left wherever the banner is
 * dropped, rather than depending on the page around it.
 */
const ELLIPSIS_HOST_CLASS = 'tw:block tw:min-w-0 tw:text-start';

/**
 * Collapsed, the title shares one line with the description, so it truncates and
 * carries the overflow tooltip. Expanded there is room to wrap, so it shows in
 * full — no ellipsis, and no tooltip repeating text that is already on screen.
 *
 * That also means no generated trigger in the expanded layouts: `Typography`
 * only builds the `<button>` when it has a tooltip to anchor, so the untruncated
 * title is a plain span and needs none of the trigger plumbing below.
 *
 * The `onClick` is a pointer convenience for the text itself — it sits above the
 * overlay, so it would otherwise be the one place on the banner that did not
 * open it. Keyboard users reach the action through the overlay button.
 */
const AnnouncementTitle = ({
  className,
  size = 'text-sm',
  truncate = true,
  onClick,
  title,
}: {
  className: string;
  size?: 'text-sm' | 'text-xl';
  truncate?: boolean;
  onClick?: () => void;
  title: string;
}) => {
  const clickable = onClick && 'tw:cursor-pointer';

  if (!truncate) {
    return (
      <Typography
        as="span"
        // Nothing clips this one, so it has to fit by wrapping. A flex item's
        // minimum is its min-content width, so without `min-w-0` a title with no
        // break points — an FQN, a URL, a bare identifier — cannot shrink, and
        // without `break-words` it has nowhere to break: on the landing banner it
        // pushed itself and the badge beside it past the banner's edge.
        className={classNames(
          className,
          OVER_OVERLAY_CLASS,
          'tw:min-w-0 tw:break-words',
          clickable
        )}
        data-testid="announcement-title-btn"
        size={size}
        weight="semibold"
        onClick={onClick}>
        {title}
      </Typography>
    );
  }

  return (
    <span
      className={classNames(
        ELLIPSIS_HOST_CLASS,
        OVER_OVERLAY_CLASS,
        clickable
      )}>
      <Typography
        as="span"
        className={className}
        data-testid="announcement-title-btn"
        ellipsis={{ tooltip: title }}
        size={size}
        weight="semibold"
        onClick={onClick}>
        {title}
      </Typography>
    </span>
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
    <Box
      align="center"
      className={classNames('tw:gap-1.5', OVER_OVERLAY_CLASS)}>
      {/* The hover profile card comes from UserPopOverCard; ProfilePicture on
          its own is just an avatar image and has no popover of its own. */}
      <UserPopOverCard userName={createdBy}>
        <span className="tw:flex tw:items-center tw:gap-1.5">
          <ProfilePicture displayName={postedBy} name={createdBy} width="16" />
          <Typography as="span" className="tw:text-secondary" size="text-xs">
            <Link
              className="tw:text-secondary tw:no-underline!"
              to={getUserPath(createdBy)}
              onClick={(e) => e.stopPropagation()}>
              {postedBy}
            </Link>
          </Typography>
        </span>
      </UserPopOverCard>
      {showEntity && entityFQN && (
        <>
          <span className="tw:text-placeholder_subtle">&middot;</span>
          <span className={ELLIPSIS_HOST_CLASS}>
            <Typography
              as="span"
              className="tw:text-secondary"
              ellipsis={{ tooltip: entityFQN }}
              size="text-xs">
              {entityFQN}
            </Typography>
          </span>
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
    <Box
      align="center"
      className={classNames(
        'tw:ml-auto tw:shrink-0 tw:gap-1',
        OVER_OVERLAY_CLASS
      )}>
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
  label: string;
  plainDescription: string;
  showEntity: boolean;
  title: string;
  titleClassName: string;
  typeChip: ReactNode;
  onClick?: () => void;
}

/**
 * `bg-primary` overrides the badge's own `50` fill: the banner behind it is
 * already tinted in the same family, so the badge would otherwise dissolve into
 * it. Only the fill is replaced — the label and edge stay the type's colour.
 */
const TypeBadge = ({
  badgeColor,
  label,
}: {
  badgeColor: BadgeColors;
  label: string;
}) => (
  <Badge
    className="tw:bg-primary!"
    color={badgeColor}
    data-testid="announcement-type-badge"
    size="sm"
    type="color">
    {label}
  </Badge>
);

/** One line: chip, badge, title and a flattened description, then the actions. */
const CollapsedBody = ({
  badgeColor,
  hasDescription,
  label,
  plainDescription,
  title,
  titleClassName,
  typeChip,
  onClick,
}: Omit<AnnouncementBodyProps, 'announcement' | 'showEntity'>) => (
  <>
    {typeChip}
    <TypeBadge badgeColor={badgeColor} label={label} />
    {/* An ellipsis tooltip puts a `w-full min-w-0` trigger around its text, so
        the title would otherwise become a second flexible item and split the
        row evenly with the description. These two spans size the row instead:
        the title to its natural width, capped so a very long one truncates
        rather than pushing the description out, and the description to
        whatever is left. */}
    <span className="tw:min-w-0 tw:max-w-[50%] tw:shrink-0">
      <AnnouncementTitle
        className={titleClassName}
        title={title}
        onClick={onClick}
      />
    </span>
    {hasDescription && (
      <span
        className={classNames(
          'tw:flex-1',
          ELLIPSIS_HOST_CLASS,
          OVER_OVERLAY_CLASS,
          onClick && 'tw:cursor-pointer'
        )}>
        <Typography
          as="span"
          className="tw:text-secondary"
          data-testid="announcement-description"
          ellipsis={{ tooltip: plainDescription }}
          size="text-sm"
          onClick={onClick}>
          {plainDescription}
        </Typography>
      </span>
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
  label,
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
      <TypeBadge badgeColor={badgeColor} label={label} />
      {actions}
    </Box>

    <AnnouncementTitle
      className={titleClassName}
      title={title}
      truncate={false}
      onClick={onClick}
    />

    {/* Raised like the rest: rendered markdown is real content — it carries
          links and mentions, and people select and copy it — so it must not
          sit under the overlay, which would turn every click into "open the
          announcement". Unlike the collapsed strip it gets no `onClick` of its
          own; a handler here would fire on those links too. */}
    {hasDescription && (
      <div className={OVER_OVERLAY_CLASS}>
        <RichTextEditorPreviewerV1
          className="tw:[&_p]:text-secondary tw:[&_p]:text-sm"
          data-testid="announcement-description"
          enableSeeMoreVariant={false}
          markdown={announcement.description}
          showReadMoreBtn={false}
        />
      </div>
    )}

    <AnnouncementFooter announcement={announcement} showEntity={showEntity} />
  </Box>
);

/**
 * The landing-page banner: the chip sits to the left of the whole block, and the
 * badge follows the title on the same line rather than sitting above it. The
 * title runs larger and in the type colour, and the footer carries the entity —
 * this banner is not on that entity's page.
 */
const FullBody = ({
  announcement,
  badgeColor,
  hasDescription,
  label,
  title,
  titleClassName,
  typeChip,
  actions,
  onClick,
}: Omit<AnnouncementBodyProps, 'plainDescription' | 'showEntity'> & {
  actions: ReactNode;
}) => (
  <Box align="start" className="tw:gap-3">
    {typeChip}

    <Box className="tw:min-w-0 tw:flex-1 tw:gap-1.5" direction="col">
      <Box align="center" className="tw:min-w-0 tw:gap-2">
        <AnnouncementTitle
          className={titleClassName}
          size="text-xl"
          title={title}
          truncate={false}
          onClick={onClick}
        />
        <TypeBadge badgeColor={badgeColor} label={label} />
      </Box>

      {hasDescription && (
        <div className={OVER_OVERLAY_CLASS}>
          <RichTextEditorPreviewerV1
            className="tw:[&_p]:text-primary tw:[&_p]:text-sm"
            data-testid="announcement-description"
            enableSeeMoreVariant={false}
            markdown={announcement.description}
            showReadMoreBtn={false}
          />
        </div>
      )}

      <AnnouncementFooter showEntity announcement={announcement} />
    </Box>

    {actions}
  </Box>
);

type BannerLayout = 'full' | 'expanded' | 'collapsed';

// The full variant is the landing-page banner and is always laid out expanded;
// the others expand only when asked to.
const getBannerLayout = (isFull: boolean, expanded: boolean): BannerLayout => {
  if (isFull) {
    return 'full';
  }

  return expanded ? 'expanded' : 'collapsed';
};

const BANNER_PADDING: Record<BannerLayout, string> = {
  full: 'tw:px-4 tw:py-3.5',
  expanded: 'tw:px-4 tw:py-3.5',
  collapsed: 'tw:px-3 tw:py-2',
};

const BannerBody = ({
  actions,
  announcement,
  layout,
  plainDescription,
  shared,
}: {
  actions: ReactNode;
  announcement: AnnouncementEntity;
  layout: BannerLayout;
  plainDescription: string;
  shared: Omit<
    AnnouncementBodyProps,
    'announcement' | 'plainDescription' | 'showEntity'
  >;
}) => {
  if (layout === 'full') {
    return (
      <FullBody {...shared} actions={actions} announcement={announcement} />
    );
  }

  if (layout === 'expanded') {
    return (
      <ExpandedBody
        {...shared}
        actions={actions}
        announcement={announcement}
        showEntity={false}
      />
    );
  }

  return (
    <Box align="center" className="tw:gap-2">
      <CollapsedBody {...shared} plainDescription={plainDescription} />
      {actions}
    </Box>
  );
};

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
  const { t } = useTranslation();
  const typeConfig = useMemo(
    () => getAnnouncementTypeConfig(announcement),
    [announcement]
  );
  const { color, icon: TypeIcon } = typeConfig;
  const surface = ANNOUNCEMENT_SURFACE_CLASSES[color];

  // The collapsed strip has one line for everything, so the markdown is flattened
  // rather than rendered — a previewer there would bring block spacing with it.
  const plainDescription = useMemo(
    () => stripMarkdown(announcement.description ?? ''),
    [announcement.description]
  );

  // The full variant is also the only one that tints its title with the type.
  const isFull = variant === 'full';
  const layout = getBannerLayout(isFull, expanded);

  // 16px beside the badge, 20px on the landing banner: it sits next to 12px
  // label text, and anything larger outweighs the title it annotates.
  const typeChip = (
    <TypeIcon
      className={classNames(
        'tw:shrink-0',
        isFull ? 'tw:size-5' : 'tw:size-4',
        surface.icon
      )}
    />
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
    label: getAnnouncementTypeLabel(typeConfig, t),
    title: announcement.displayName ?? announcement.name,
    titleClassName: isFull ? surface.title : 'tw:text-primary',
    typeChip,
    onClick,
  };

  return (
    // A labelled region, not `role="status"`: a live region re-announces its
    // whole contents on every change, and this one holds buttons and steps
    // through a carousel — so a screen reader would read the entire banner
    // again on each arrow press and each expand. The announcement is already on
    // the page when it loads; there is nothing to interrupt the user about.
    <section
      aria-label={`${t('label.announcement')}: ${shared.title}`}
      className={classNames(
        // `relative` so the overlay's `inset-0` resolves against the banner,
        // and `isolate` so the z-indexes it and the raised content carry stay
        // inside it. Without the stacking context they land in the root one,
        // where they beat the announcement drawer — its overlay is `fixed`
        // with no z-index, so it wins on DOM order alone and anything at
        // `z-index >= 1` paints straight through it.
        'tw:relative tw:isolate tw:rounded-[10px] tw:outline-1 tw:-outline-offset-1',
        surface.surface,
        BANNER_PADDING[layout],
        className
      )}
      data-testid={testId}>
      {onClick && (
        <button
          aria-label={t('label.view-entity', {
            entity: t('label.announcement'),
          })}
          className={OVERLAY_CLASS}
          data-testid="announcement-open-btn"
          type="button"
          onClick={onClick}
        />
      )}
      <BannerBody
        actions={actions}
        announcement={announcement}
        layout={layout}
        plainDescription={plainDescription}
        shared={shared}
      />
    </section>
  );
};

export default AnnouncementBanner;
