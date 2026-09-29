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
  Box,
  ButtonGroup,
  ButtonGroupItem,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CommonWidgetType,
  GridSizes,
} from '../../../../constants/CustomizeWidgets.constants';
import { WidgetWidths } from '../../../../enums/CustomizablePage.enum';
import { PageType } from '../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import { getWidgetWidthLabelFromKey } from '../../../../utils/CustomizableLandingPagePureUtils';
import customizeDetailPageClassBase from '../../../../utils/CustomizeDetailPage/CustomizeDetailPageClassBase';
import { AddWidgetPanel } from './AddWidgetPanel';

interface AddDetailsPageWidgetTabContentProps {
  maxGridSizeSupport: number;
  widget: CommonWidgetType;
  onAdd: (widget: CommonWidgetType, widgetSize: number) => void;
  onCancel: () => void;
}

/** Pane of a plain widget: pick its size, preview it, add it. */
export const AddDetailsPageWidgetTabContent = ({
  maxGridSizeSupport,
  widget,
  onAdd,
  onCancel,
}: AddDetailsPageWidgetTabContentProps) => {
  const { t } = useTranslation();
  const { currentPageType } = useCustomizeStore();
  const [gridSize, setGridSize] = useState<GridSizes>(widget.data.gridSizes[0]);
  const widgetSize = WidgetWidths[gridSize];
  const canAdd = widgetSize <= maxGridSizeSupport;

  const widgetImage = useMemo(
    () =>
      currentPageType === PageType.Glossary ||
      currentPageType === PageType.GlossaryTerm
        ? customizeDetailPageClassBase.getGlossaryWidgetImageFromKey(
            widget.fullyQualifiedName,
            widgetSize
          )
        : customizeDetailPageClassBase.getDetailPageWidgetImageFromKey(
            widget.fullyQualifiedName,
            widgetSize
          ),
    [currentPageType, widget.fullyQualifiedName, widgetSize]
  );

  return (
    <AddWidgetPanel
      canAdd={canAdd}
      summary={canAdd ? undefined : t('message.can-not-add-widget')}
      onAdd={() => onAdd(widget, widgetSize)}
      onCancel={onCancel}>
      <Box direction="col" gap={5}>
        <Box direction="col" gap={2}>
          <Typography
            className="tw:font-medium tw:text-secondary"
            size="text-sm">
            {t('label.size')}
          </Typography>
          <ButtonGroup
            disallowEmptySelection
            aria-label={t('label.size')}
            data-testid="size-selector-button"
            selectedKeys={new Set([gridSize])}
            size="sm"
            onSelectionChange={(keys) => {
              const [key] = [...keys];
              if (key) {
                setGridSize(key as GridSizes);
              }
            }}>
            {widget.data.gridSizes.map((size) => (
              <ButtonGroupItem
                data-testid={`${size}-size-selector`}
                id={size}
                key={size}>
                {getWidgetWidthLabelFromKey(size)}
              </ButtonGroupItem>
            ))}
          </ButtonGroup>
        </Box>
        <Box align="center" direction="col" gap={4}>
          {widgetImage && (
            <img
              alt={widget.name}
              className="tw:max-w-full"
              data-testid="widget-image"
              src={widgetImage}
            />
          )}
          {widget.description && (
            <Typography
              className="tw:text-center tw:text-tertiary"
              data-testid="widget-description"
              size="text-sm">
              {widget.description}
            </Typography>
          )}
        </Box>
      </Box>
    </AddWidgetPanel>
  );
};
