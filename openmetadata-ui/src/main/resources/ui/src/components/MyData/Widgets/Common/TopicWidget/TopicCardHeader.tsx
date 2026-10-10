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
import { Badge, Typography } from '@openmetadata/ui-core-components';
import { ChevronDown, ChevronUp } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, { ReactNode } from 'react';
import type { TopicCardProps } from './TopicCard';

const LAYOUT_CLASSES =
  'tw:flex tw:min-w-0 tw:flex-1 tw:items-start tw:gap-3.5 tw:text-left';

export type TopicCardHeaderProps = Pick<
  TopicCardProps,
  'title' | 'status' | 'tone' | 'topicKey' | 'widgetKey'
> & {
  isLoading: boolean;
  isCollapsed: boolean;
  /** Absent on surfaces that do not offer collapsing, e.g. the persona editor. */
  onToggle?: () => void;
  summarySlot: ReactNode;
};

/**
 * A topic card's title strip: tone tile, title, status chip and summary.
 *
 * Where collapsing is offered the whole strip is the control, not just the
 * chevron — the chevron is a 26px target on a card that is otherwise inert, and
 * the header is what a reader aims at. The chevron therefore renders *inside*
 * the button as decoration: a sibling button would either nest controls or
 * leave a dead zone where the two meet.
 *
 * No `aria-label`: the button's own content already names it, so a screen
 * reader announces "Your Data Estate … collapsed, button" rather than a bare
 * "Expand" that could belong to any card on the page.
 */
const TopicCardHeader: React.FC<TopicCardHeaderProps> = ({
  title,
  status,
  tone,
  topicKey,
  widgetKey,
  isLoading,
  isCollapsed,
  onToggle,
  summarySlot,
}) => {
  const ToneIcon = tone.icon;
  const Chevron = isCollapsed ? ChevronDown : ChevronUp;

  const content = (
    <>
      <div
        aria-hidden
        className={classNames(
          'tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg',
          tone.tile
        )}>
        <ToneIcon size={20} />
      </div>

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
        <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
          {/* `!` on the colour: Typography renders `.prose`, whose unlayered
            `color` rule is emitted after the Tailwind utilities and would
            otherwise silently win. */}
          <Typography
            className="tw:min-w-0 tw:text-text-primary!"
            ellipsis={{ rows: 1 }}
            size="text-md"
            weight="semibold">
            {title}
          </Typography>
          {status && !isLoading && (
            <Badge
              className="tw:shrink-0"
              color={status.color}
              data-testid={`topic-status-${topicKey}`}
              size="sm"
              type="pill-color">
              {status.label}
            </Badge>
          )}
        </div>
        {summarySlot}
      </div>
    </>
  );

  if (!onToggle) {
    return <div className={LAYOUT_CLASSES}>{content}</div>;
  }

  return (
    <button
      aria-expanded={!isCollapsed}
      className={classNames(LAYOUT_CLASSES, 'tw:cursor-pointer')}
      data-testid={`toggle-widget-${widgetKey}`}
      type="button"
      onClick={onToggle}>
      {content}
      <Chevron
        aria-hidden
        className="tw:mt-2.5 tw:size-3.5 tw:shrink-0 tw:text-fg-quaternary"
      />
    </button>
  );
};

export default TopicCardHeader;
