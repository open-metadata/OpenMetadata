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
  EmptyPlaceholder,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { AlertCircle } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import TopicCardControls from './TopicCardControls';
import TopicCardFooter from './TopicCardFooter';
import TopicCardHeader from './TopicCardHeader';
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
  /**
   * A refetch is in flight while the previous answer is still on screen, e.g.
   * after a filter change. The body stays mounted — a filter living in the
   * body must not unmount under the pointer — and only dims to say so.
   */
  isFetching?: boolean;
  /**
   * The widget's fetch failed. Its counts then read zero, so the summary,
   * status and meta are withheld rather than reporting an empty estate, and the
   * body explains the failure instead of showing empty-state copy.
   */
  isError?: boolean;
  /** Offered as a retry action on the error body when given. */
  onRetry?: () => void;
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

/** Stands in for the body when the fetch failed, with a retry where offered. */
const TopicError = ({
  onRetry,
  title,
  topicKey,
}: Pick<TopicCardProps, 'onRetry' | 'title' | 'topicKey'>) => {
  const { t } = useTranslation();

  return (
    // `tw:static` lifts the placeholder out of its page-level absolute
    // positioning, so it sits in the card's flow instead of covering it.
    <EmptyPlaceholder
      actions={
        onRetry
          ? [
              {
                color: 'secondary',
                key: 'retry',
                label: t('label.retry'),
                onPress: onRetry,
              },
            ]
          : undefined
      }
      className="tw:static tw:py-2"
      data-testid={`topic-error-${topicKey}`}
      gap={3}
      icon={AlertCircle}
      title={t('server.entity-fetch-error', { entity: title })}
    />
  );
};

const TopicBody = ({
  children,
  isLoading,
  isError,
  onRetry,
  title,
  topicKey,
}: Pick<TopicCardProps, 'children' | 'onRetry' | 'title' | 'topicKey'> & {
  isLoading: boolean;
  isError: boolean;
}) => {
  if (isLoading) {
    return (
      <div
        className="tw:flex tw:flex-col tw:gap-3.5"
        data-testid={`topic-body-skeleton-${topicKey}`}>
        {SKELETON_ROW_WIDTHS.map((width) => (
          <Skeleton height={14} key={width} width={width} />
        ))}
      </div>
    );
  }

  return isError ? (
    <TopicError title={title} topicKey={topicKey} onRetry={onRetry} />
  ) : (
    <>{children}</>
  );
};

type TopicBodyRegionProps = Pick<
  TopicCardProps,
  'children' | 'onRetry' | 'title' | 'topicKey'
> & { isLoading: boolean; isFetching: boolean; isError: boolean };

/**
 * The scrolling body, or nothing for a card with nothing to show.
 *
 * min-h-0 is what lets this flex child scroll rather than grow past the card;
 * without it `overflow-y-auto` never engages. `*:shrink-0` stops the column
 * from compressing its own children to fit — without it a block that carries
 * `min-h-0` is squeezed and clips its text mid-line instead of scrolling.
 */
const TopicBodyRegion = ({
  children,
  isFetching,
  ...bodyProps
}: TopicBodyRegionProps) => {
  const isRefetching = isFetching && !bodyProps.isLoading;

  if (!children && !bodyProps.isLoading && !bodyProps.isError) {
    return null;
  }

  return (
    <div
      aria-busy={isRefetching}
      className={classNames(
        'tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-y-auto tw:border-t tw:border-secondary tw:p-5 tw:transition-opacity tw:*:shrink-0',
        isRefetching && 'tw:opacity-60'
      )}
      data-testid={`topic-body-${bodyProps.topicKey}`}>
      <TopicBody {...bodyProps}>{children}</TopicBody>
    </div>
  );
};

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
  isFetching = false,
  isError = false,
  onRetry,
}) => {
  const { t } = useTranslation();
  const collapse = useTopicCollapse();
  const isCollapsed = collapse.isCollapsed(widgetKey);
  // A failed fetch leaves every count at zero: the summary says so instead,
  // and the status and meta — which would only restate the zeros — are dropped.
  const hasError = isError && !isLoading;
  const shown = hasError
    ? {
        meta: undefined,
        status: undefined,
        summary: t('message.something-went-wrong'),
      }
    : { meta, status, summary };

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
          status={shown.status}
          summarySlot={
            <TopicSummary
              isLoading={isLoading}
              summary={shown.summary}
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

      {!isCollapsed && (
        <TopicBodyRegion
          isError={hasError}
          isFetching={isFetching}
          isLoading={isLoading}
          title={title}
          topicKey={topicKey}
          onRetry={onRetry}>
          {children}
        </TopicBodyRegion>
      )}

      {!isCollapsed && (
        <TopicCardFooter
          action={action}
          isLoading={isLoading}
          meta={shown.meta}
          topicKey={topicKey}
        />
      )}
    </section>
  );
};

export default TopicCard;
