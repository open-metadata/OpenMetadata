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
  Button,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React from 'react';
import { TopicEmptyStateConfig, TopicKey } from './topics.types';

export type TopicEmptyStateProps = Pick<
  TopicEmptyStateConfig,
  'icon' | 'title' | 'description' | 'action'
> & {
  topicKey: TopicKey;
  /**
   * `footer`: the card keeps its footer, which carries the call to action, so
   * the body is only the message — under a larger, raised icon tile.
   */
  layout?: 'body' | 'footer';
};

// The raised tile the footer-led empty states use: larger than the outlined
// default and lifted by a soft shadow instead of a border.
const RAISED_TILE_CLASS =
  'tw:size-16.5 tw:rounded-2xl tw:shadow-md tw:outline-0 tw:*:data-icon:size-7.5';

/**
 * The body of a card with nothing in it yet: what will appear here, and the
 * one step that puts it there. Grows to fill the body so it sits centred in
 * the card rather than hugging the header.
 */
const TopicEmptyState: React.FC<TopicEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  topicKey,
  layout = 'body',
}) => (
  <div
    className="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:pb-2 tw:text-center"
    data-layout={layout}
    data-testid={`topic-empty-${topicKey}`}>
    <FeaturedIcon
      className={classNames(
        'tw:text-fg-brand-primary tw:*:data-icon:size-6',
        layout === 'footer' && RAISED_TILE_CLASS
      )}
      color="gray"
      icon={icon}
      size="xl"
      theme="modern"
    />
    {/* `!` on the colours: Typography renders `.prose`, whose unlayered
      `color` rule is emitted after the Tailwind utilities and would otherwise
      silently win. */}
    <Typography
      className={classNames(
        'tw:text-text-primary!',
        layout === 'footer' ? 'tw:mt-7' : 'tw:mt-5'
      )}
      size="text-sm"
      weight="semibold">
      {title}
    </Typography>
    <Typography
      className="tw:mt-1 tw:max-w-90 tw:text-pretty tw:text-text-secondary!"
      size="text-xs">
      {description}
    </Typography>
    {action && (
      // The regular page-action size, not the card's compact xs: an empty
      // state's one call to action should read as a primary page button.
      <Button
        className="tw:mt-5"
        color="primary"
        data-testid={`topic-empty-action-${topicKey}`}
        iconLeading={Plus}
        size="md"
        onPress={action.onPress}>
        {action.label}
      </Button>
    )}
  </div>
);

export default TopicEmptyState;
