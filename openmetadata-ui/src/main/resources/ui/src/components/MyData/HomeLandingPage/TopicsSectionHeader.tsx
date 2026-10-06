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
  ChevronSelectorVertical,
  Columns01,
  Rows03,
} from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type TopicsViewMode = 'grid' | 'list';

export interface TopicsSectionHeaderProps {
  isEveryWidgetCollapsed: boolean;
  isToggleAllDisabled: boolean;
  onToggleAll: () => void;
  viewMode: TopicsViewMode;
  onViewModeChange: (mode: TopicsViewMode) => void;
}

/**
 * The "Topics to catch up on" heading and its two view controls.
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
          className="tw:mt-1.5 tw:block tw:text-text-tertiary!"
          size="text-sm">
          {t('message.topics-to-catch-up-on-subtitle')}
        </Typography>
      </div>

      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2.5">
        <Button
          color="secondary"
          data-testid="toggle-all-widgets"
          iconLeading={ChevronSelectorVertical}
          isDisabled={isToggleAllDisabled}
          size="sm"
          onPress={onToggleAll}>
          {t(
            isEveryWidgetCollapsed ? 'label.expand-all' : 'label.collapse-all'
          )}
        </Button>

        <ButtonGroup
          selectedKeys={[viewMode]}
          selectionMode="single"
          size="sm"
          onSelectionChange={(keys) => {
            const [selected] = [...keys] as TopicsViewMode[];
            // react-aria allows deselecting the active item; a view has to
            // stay chosen.
            if (selected) {
              onViewModeChange(selected);
            }
          }}>
          <ButtonGroupItem
            aria-label={t('label.list')}
            data-testid="topics-list-view"
            iconLeading={Rows03}
            id="list"
          />
          <ButtonGroupItem
            aria-label={t('label.grid')}
            data-testid="topics-grid-view"
            iconLeading={Columns01}
            id="grid"
          />
        </ButtonGroup>
      </div>
    </div>
  );
};

export default TopicsSectionHeader;
