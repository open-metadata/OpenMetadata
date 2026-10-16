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
import { ButtonUtility, Tooltip } from '@openmetadata/ui-core-components';
import { DotsGrid, Trash01 } from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TOGGLE_ICON_CLASS } from './topics.types';

export interface TopicCardControlsProps {
  widgetKey: string;
  isEditView: boolean;
  handleRemoveWidget?: (widgetKey: string) => void;
}

/**
 * The persona editor's controls on the right of a topic card's header.
 *
 * Collapsing is deliberately not here: the whole header strip is that control,
 * so its chevron lives inside the strip (see TopicCardHeader). A sibling button
 * would either nest inside that one or leave a dead zone where the two meet.
 */
const TopicCardControls: React.FC<TopicCardControlsProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();

  if (!isEditView) {
    return null;
  }

  return (
    <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-1">
      {/* Mirrors the OSS WidgetHeader handle: `.drag-widget-icon` is the
        selector react-grid-layout is configured with as `draggableHandle`, and
        dragging is pointer-only, so this is not a focusable control --
        `excludeTriggerFromTabOrder` keeps the wrapper Tooltip generates for a
        non-focusable child out of the tab order rather than adding a stop that
        does nothing.

        `tw:flex` on the wrapper and on the handle is what lines the dots up
        with the button beside them: an inline box is sized by line-height and
        seats its icon on the baseline, which rides above the centre the row's
        `items-center` aligns to. The padding and icon size then match
        ButtonUtility's own (`p-1.5` around a 14px icon) so the two read as a
        pair and the drag target is not a 16px sliver. */}
      <Tooltip
        excludeTriggerFromTabOrder
        title={t('label.reposition')}
        triggerClassName="tw:flex">
        <span
          aria-hidden
          className="drag-widget-icon tw:flex tw:cursor-grab tw:items-center tw:p-1.5 tw:text-fg-quaternary"
          data-testid={`drag-widget-${widgetKey}`}>
          <DotsGrid size={14} />
        </span>
      </Tooltip>
      <Tooltip title={t('label.remove')}>
        <ButtonUtility
          aria-label={t('label.remove')}
          className={TOGGLE_ICON_CLASS}
          color="tertiary"
          data-testid={`remove-widget-${widgetKey}`}
          icon={Trash01}
          size="xs"
          onClick={() => handleRemoveWidget?.(widgetKey)}
        />
      </Tooltip>
    </div>
  );
};

export default TopicCardControls;
