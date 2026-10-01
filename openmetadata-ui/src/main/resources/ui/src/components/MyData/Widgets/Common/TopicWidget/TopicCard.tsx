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
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { DotsGrid, Trash01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TOGGLE_ICON_CLASS,
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
}

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
}) => {
  const { t } = useTranslation();
  const ToneIcon = tone.icon;

  return (
    <section
      className="tw:flex tw:h-full tw:min-w-0 tw:flex-col tw:overflow-hidden tw:rounded-2xl tw:border tw:border-secondary tw:bg-primary tw:shadow-xs"
      data-testid={`topic-card-${topicKey}`}>
      <div className="tw:flex tw:shrink-0 tw:items-start tw:gap-3.5 tw:p-5">
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
            {status && (
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
          <Typography
            className="tw:text-pretty tw:text-text-secondary!"
            size="text-sm">
            {summary}
          </Typography>
        </div>

        {/* View mode has no header control — the persona layout owns size and
          placement, so there is nothing left for the card to toggle. */}
        {isEditView && (
          <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-1">
            {/* Mirrors the OSS WidgetHeader handle: `.drag-widget-icon` is the
              selector react-grid-layout is configured with as `draggableHandle`,
              and dragging is pointer-only, so this is not a focusable control. */}
            <span
              aria-hidden
              className="drag-widget-icon tw:cursor-grab tw:text-fg-quaternary"
              data-testid={`drag-widget-${widgetKey}`}>
              <DotsGrid size={16} />
            </span>
            <ButtonUtility
              aria-label={t('label.remove')}
              className={TOGGLE_ICON_CLASS}
              color="tertiary"
              data-testid={`remove-widget-${widgetKey}`}
              icon={Trash01}
              size="xs"
              onClick={() => handleRemoveWidget?.(widgetKey)}
            />
          </div>
        )}
      </div>

      {/* min-h-0 is what lets this flex child scroll rather than grow past the
        card; without it `overflow-y-auto` never engages. `*:shrink-0` stops the
        column from compressing its own children to fit — without it a block
        that carries `min-h-0` is squeezed and clips its text mid-line instead
        of the body scrolling. */}
      {children && (
        <div className="tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:overflow-y-auto tw:border-t tw:border-secondary tw:p-5 tw:*:shrink-0">
          {children}
        </div>
      )}

      {(meta || action) && (
        <div className="tw:flex tw:min-w-0 tw:shrink-0 tw:items-center tw:gap-3 tw:border-t tw:border-secondary tw:px-5 tw:py-3.5">
          {meta && (
            <Typography
              className="tw:min-w-0 tw:text-text-tertiary!"
              ellipsis={{ rows: 1 }}
              size="text-sm">
              {meta}
            </Typography>
          )}
          {action && (
            <Button
              className="tw:ml-auto tw:shrink-0"
              color="link-color"
              data-testid={`topic-action-${topicKey}`}
              size="sm"
              onPress={action.onPress}>
              {action.label}
            </Button>
          )}
        </div>
      )}
    </section>
  );
};

export default TopicCard;
