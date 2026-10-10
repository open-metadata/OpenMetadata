/*
 *  Copyright 2025 Collate.
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
  Box,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { DotsGrid, Edit01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { ReactNode } from 'react';
import { Layout } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { WidgetConfig } from '../../../../../pages/CustomizablePage/CustomizablePage.interface';
import WidgetMoreOptions from '../WidgetMoreOptions/WidgetMoreOptions';
import WidgetSortFilter from '../WidgetSortFilter/WidgetSortFilter';
import './widget-header.less';
import { WIDGET_MORE_MENU_ITEMS } from './WidgetHeader.constants';

export interface WidgetHeaderProps {
  className?: string;
  currentLayout?: Layout[];
  disableEdit?: boolean;
  handleLayoutUpdate?: (layout: Layout[]) => void;
  handleRemoveWidget?: (widgetKey: string) => void;
  icon?: ReactNode;
  isEditView?: boolean;
  onEditClick?: () => void;
  onSortChange?: (key: string) => void;
  onTitleClick?: () => void;
  selectedSortBy?: string;
  sortOptions?: Array<{
    key: string;
    label: string;
  }>;
  title: ReactNode;
  widgetKey: string;
}

const WidgetHeader = ({
  className = '',
  currentLayout,
  disableEdit = false,
  handleLayoutUpdate,
  handleRemoveWidget,
  icon,
  isEditView = false,
  onEditClick,
  onSortChange,
  onTitleClick,
  selectedSortBy,
  sortOptions,
  title,
  widgetKey,
}: WidgetHeaderProps) => {
  const { t } = useTranslation();

  const handleSizeChange = (value: number) => {
    if (handleLayoutUpdate) {
      const updatedLayout = currentLayout?.map((layout: WidgetConfig) =>
        layout.i === widgetKey ? { ...layout, w: value } : layout
      );

      handleLayoutUpdate(updatedLayout as Layout[]);
    }
  };

  const handleMoreClick = (key: string) => {
    if (key === 'remove') {
      handleRemoveWidget?.(widgetKey);
    } else if (key === 'half_size') {
      handleSizeChange(1);
    } else if (key === 'full_size') {
      handleSizeChange(2);
    }
  };

  const sortFilter = sortOptions && selectedSortBy && (
    <WidgetSortFilter
      selectedSortBy={selectedSortBy}
      sortOptions={sortOptions}
      onSortChange={(key) => onSortChange?.(key)}
    />
  );

  return (
    <Box
      align="center"
      className={classNames('widget-header tw:px-5 tw:py-3', className)}
      data-testid="widget-header"
      gap={2}
      justify="between">
      <Box align="center" className="tw:h-full tw:min-h-8 tw:min-w-0 tw:flex-1">
        {icon && (
          <Box className="header-title-icon tw:mr-2 tw:size-6 tw:shrink-0 tw:text-fg-tertiary">
            {icon}
          </Box>
        )}
        <Typography
          as="p"
          className="widget-title tw:cursor-pointer tw:text-secondary"
          data-testid="widget-title"
          ellipsis={{ tooltip: true }}
          onClick={onTitleClick}>
          {title}
        </Typography>
      </Box>

      <Box align="center" className="tw:shrink-0" gap={2}>
        {isEditView ? (
          <>
            {/* Grid drag handle: react-grid-layout starts a drag on mousedown here. */}
            <span
              aria-hidden
              className="drag-widget-icon tw:flex tw:cursor-grab tw:rounded-md tw:border tw:border-primary tw:bg-surface tw:p-1.5 tw:text-fg-quaternary tw:select-none tw:active:cursor-grabbing"
              data-testid="drag-widget-button">
              <DotsGrid className="tw:size-5" />
            </span>
            {onEditClick && (
              <ButtonUtility
                aria-label={t('label.edit-widget')}
                color="secondary"
                data-testid="edit-widget-button"
                icon={Edit01}
                isDisabled={disableEdit}
                size="sm"
                onPress={onEditClick}
              />
            )}

            <WidgetMoreOptions
              menuItems={WIDGET_MORE_MENU_ITEMS}
              onMenuClick={handleMoreClick}
            />
          </>
        ) : (
          sortFilter
        )}
      </Box>
    </Box>
  );
};

export default WidgetHeader;
