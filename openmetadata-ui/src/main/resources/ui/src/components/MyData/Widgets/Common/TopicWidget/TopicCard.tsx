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

import { Skeleton, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { ReactNode } from 'react';
import TopicCardControls from './TopicCardControls';
import TopicCardHeader from './TopicCardHeader';
import TopicCardFooter from './TopicCardFooter';
import { useTopicCollapse } from './TopicCollapseContext';
import {
  TopicAction,
  TopicIconTone,
  TopicKey,
  TopicStatus,
} from './topics.types';

export interface TopicCardProps {
  topicKey: TopicKey;
  tone: TopicIconTone;
  title: string;
  /** One or two lines summarising the card, readable above the fold. */
  summary: ReactNode;
  status?: TopicStatus;
  /** Left-hand footer text, e.g. "Updated 20 min ago". */
  meta?: ReactNode;
  action?: TopicAction;
  /** Omitted when the card has nothing to show beyond its header. */
  children?: ReactNode;
  /** Grid instance key — `KnowledgePanel.X` plus a uniqueId suffix. */
  widgetKey: string;
  isEditView?: boolean;
  handleRemoveWidget?: (widgetKey: string) => void;
  /**
   * The widget's own fetch is still in flight.
   *
   * Every topic widget derives its summary, status and body from counts that
   * start at zero, so without this the card renders a confident empty state —
   * "No recent team activity", "0 followed assets changed" — and then replaces
   * it once the data lands. A skeleton says "not yet" instead of saying
   * something false.
   */
  isLoading?: boolean;
}

/** Body placeholder: a few rows at the widths a populated card tends to use. */
const SKELETON_ROW_WIDTHS = ['90%', '75%', '85%', '60%'];

/**
 * The three slots a loading card has to stand in for, extracted so TopicCard
 * itself stays under the complexity ceiling rather than carrying a ternary per
 * slot inline.
 */
const TopicSummary = ({
  isLoading,
  summary,
  topicKey,
}: Pick<TopicCardProps, 'summary' | 'topicKey'> & { isLoading: boolean }) =>
  isLoading ? (
    // Wrapped rather than putting the testid on Skeleton: it takes no arbitrary
    // props, and TS does not flag a hyphenated JSX attribute, so the prop would
    // be dropped silently.
    <div data-testid={`topic-summary-skeleton-${topicKey}`}>
      <Skeleton height={14} width="70%" />
    </div>
  ) : (
    // `!` on the colour: Typography renders `.prose`, whose unlayered `color`
    // rule is emitted after the Tailwind utilities and would otherwise win.
    <Typography
      className="tw:text-pretty tw:text-text-secondary!"
      size="text-sm">
      {summary}
    </Typography>
  );

const TopicBody = ({
  children,
  isLoading,
  topicKey,
}: Pick<TopicCardProps, 'children' | 'topicKey'> & { isLoading: boolean }) =>
  isLoading ? (
    <div
      className="tw:flex tw:flex-col tw:gap-3.5"
      data-testid={`topic-body-skeleton-${topicKey}`}>
      {SKELETON_ROW_WIDTHS.map((width) => (
        <Skeleton height={14} key={width} width={width} />
      ))}
    </div>
  ) : (
    children
  );

/**
 * The shell every landing-page topic widget renders into: a summary header, the
 * widget's own body, and a footer that links out to the full view.
 *
 * The card fills its grid cell rather than sizing to content — the persona
 * layout owns height, so a long body scrolls inside the card instead of
 * dragging the row taller.
 */
const TopicCard: React.FC<TopicCardProps> = ({
  topicKey,
  tone,
  title,
  summary,
  status,
  meta,
  action,
  children,
  widgetKey,
  isEditView = false,
  handleRemoveWidget,
  isLoading = false,
}) => {
  const collapse = useTopicCollapse();
  const isCollapsed = collapse.isCollapsed(widgetKey);

  return (
    <section
      className={classNames(
        'tw:flex tw:min-w-0 tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:border tw:border-secondary tw:bg-primary tw:shadow-xs',
        // Expanded, the card fills its grid cell so the body can scroll inside
        // it. Collapsed, it is only a header — stretching would hang an empty
        // half-card below the summary, which is the cell's height showing
        // through rather than anything the card has to say.
        isCollapsed ? 'tw:h-auto' : 'tw:h-full'
      )}
      data-testid={`topic-card-${topicKey}`}>
      <div className="tw:flex tw:shrink-0 tw:items-start tw:gap-3.5 tw:p-5">
        <TopicCardHeader
          isCollapsed={isCollapsed}
          isLoading={isLoading}
          status={status}
          summarySlot={
            <TopicSummary
              isLoading={isLoading}
              summary={summary}
              topicKey={topicKey}
            />
          }
          title={title}
          tone={tone}
          topicKey={topicKey}
          widgetKey={widgetKey}
          onToggle={
            collapse.isEnabled ? () => collapse.toggle(widgetKey) : undefined
          }
        />

        <TopicCardControls
          handleRemoveWidget={handleRemoveWidget}
          isEditView={isEditView}
          widgetKey={widgetKey}
        />
      </div>

      {/* min-h-0 is what lets this flex child scroll rather than grow past the
        card; without it `overflow-y-auto` never engages. `*:shrink-0` stops the
        column from compressing its own children to fit — without it a block
        that carries `min-h-0` is squeezed and clips its text mid-line instead
        of the body scrolling. */}
      {!isCollapsed && (children || isLoading) && (
        <div className="tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-y-auto tw:border-t tw:border-secondary tw:p-5 tw:*:shrink-0">
          <TopicBody isLoading={isLoading} topicKey={topicKey}>
            {children}
          </TopicBody>
        </div>
      )}

      {!isCollapsed && (
        <TopicCardFooter
          action={action}
          isLoading={isLoading}
          meta={meta}
          topicKey={topicKey}
        />
      )}
    </section>
  );
};

export default TopicCard;
