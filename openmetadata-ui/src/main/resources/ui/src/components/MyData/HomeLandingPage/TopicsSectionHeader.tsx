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
  ButtonGroup,
  ButtonGroupItem,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronSelectorVertical02,
  LayoutColumns,
  LayoutRows,
  Settings01,
} from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  getSegmentedItemClasses,
  SEGMENTED_GROUP_CLASSES,
} from './TopicsSectionHeader.constants';

export type TopicsViewMode = 'grid' | 'list';

export interface TopicsSectionHeaderProps {
  isEveryWidgetCollapsed: boolean;
  isToggleAllDisabled: boolean;
  onToggleAll: () => void;
  viewMode: TopicsViewMode;
  onViewModeChange: (mode: TopicsViewMode) => void;
  /** Opens the persona's landing-page editor; omitted when no persona is set. */
  onCustomize?: () => void;
}

/**
 * The "Topics to catch up on" heading, its two view controls and the entry
 * point to the persona's layout editor.
 *
 * Split from the page so the page keeps one job — owning collapse and view
 * state — rather than also carrying this markup's share of the branching.
 */
const TopicsSectionHeader: React.FC<TopicsSectionHeaderProps> = ({
  isEveryWidgetCollapsed,
  isToggleAllDisabled,
  onToggleAll,
  viewMode,
  onViewModeChange,
  onCustomize,
}) => {
  const { t } = useTranslation();

  return (
    <div className="tw:mb-4 tw:flex tw:flex-wrap tw:items-end tw:justify-between tw:gap-4">
      <div>
        <Typography size="text-md" weight="semibold">
          {t('label.topics-to-catch-up-on')}
        </Typography>
        {/* `!` on the colour: Typography renders `.prose`, whose unlayered
          `color` rule is emitted after the Tailwind utilities and would
          otherwise silently win. */}
        <Typography
          className="tw:mt-0.5 tw:block tw:text-text-tertiary!"
          size="text-xs">
          {t('message.topics-to-catch-up-on-subtitle')}
        </Typography>
      </div>

      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2.5">
        {/* The design draws this control's icon smaller and its label darker
          and bolder than a secondary button's own, so both come in styled. */}
        <Button
          color="secondary"
          data-testid="toggle-all-widgets"
          iconLeading={
            <ChevronSelectorVertical02 className="tw:size-3.5 tw:text-fg-primary tw:group-disabled:text-fg-disabled" />
          }
          isDisabled={isToggleAllDisabled}
          size="md"
          onPress={onToggleAll}>
          <span className="tw:ml-1 tw:font-semibold tw:text-primary tw:group-disabled:text-fg-disabled">
            {t(
              isEveryWidgetCollapsed ? 'label.expand-all' : 'label.collapse-all'
            )}
          </span>
        </Button>

        <ButtonGroup
          disallowEmptySelection
          aria-label={t('label.view')}
          className={SEGMENTED_GROUP_CLASSES}
          selectedKeys={[viewMode]}
          size="sm"
          onSelectionChange={(keys) => {
            const [selected] = [...keys] as TopicsViewMode[];
            onViewModeChange(selected);
          }}>
          <ButtonGroupItem
            aria-label={t('label.list')}
            className={getSegmentedItemClasses(viewMode === 'list')}
            data-testid="topics-list-view"
            id="list">
            <LayoutRows className="tw:size-4" />
          </ButtonGroupItem>
          <ButtonGroupItem
            aria-label={t('label.grid')}
            className={getSegmentedItemClasses(viewMode === 'grid')}
            data-testid="topics-grid-view"
            id="grid">
            <LayoutColumns className="tw:size-4" />
          </ButtonGroupItem>
        </ButtonGroup>

        {onCustomize && (
          <Button
            color="secondary"
            data-testid="customize-home-page"
            iconLeading={Settings01}
            size="md"
            onPress={onCustomize}>
            {t('label.customize')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default TopicsSectionHeader;
