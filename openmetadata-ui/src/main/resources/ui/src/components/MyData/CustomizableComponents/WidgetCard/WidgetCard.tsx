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
import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CheckIcon } from '../../../../assets/svg/ic-check-circle-new.svg';
import { Document as DocStoreDocument } from '../../../../generated/entity/docStore/document';
import { PageType } from '../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import customizeDetailPageClassBase from '../../../../utils/CustomizeDetailPage/CustomizeDetailPageClassBase';
import customizePageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';

interface WidgetCardProps {
  widget: DocStoreDocument;
  isSelected: boolean;
  onSelectWidget?: (id: string) => void;
}

const WidgetCard = ({
  widget,
  isSelected,
  onSelectWidget,
}: WidgetCardProps) => {
  const { t } = useTranslation();
  const { currentPageType } = useCustomizeStore();

  const widgetImage = useMemo(() => {
    switch (currentPageType) {
      case PageType.Glossary:
      case PageType.GlossaryTerm:
        return customizeDetailPageClassBase.getGlossaryWidgetImageFromKey(
          widget.fullyQualifiedName,
          1
        );
      case PageType.LandingPage:
        return customizePageClassBase.getWidgetImageFromKey(
          widget.fullyQualifiedName
        );
      default:
        return customizeDetailPageClassBase.getDetailPageWidgetImageFromKey(
          widget.fullyQualifiedName,
          1
        );
    }
  }, [currentPageType, widget]);

  // `displayName` is what the widget is called today; `name` is the stable key
  // and lags a rename. The preview's alt text has to name the same widget the
  // caption below it does.
  const widgetLabel = widget.displayName ?? startCase(widget.name);

  const handleClick = () => {
    onSelectWidget?.(widget.id ?? '');
  };

  return (
    <Card
      isClickable
      className="widget-card tw:flex tw:h-full tw:flex-col tw:overflow-hidden"
      data-testid={widget.fullyQualifiedName}
      isSelected={isSelected}
      onClick={handleClick}>
      <Box className="widget-card-content tw:relative tw:min-h-0 tw:flex-1">
        {/* An empty src resolves against the page URL, so the browser paints a
          broken-image icon rather than nothing. Widgets added without a preview
          screenshot keep an empty tile instead. */}
        {widgetImage ? (
          <img
            alt={widgetLabel}
            className="tw:h-full tw:w-full tw:object-cover"
            data-testid="widget-image"
            src={widgetImage}
          />
        ) : (
          <div
            className="tw:h-full tw:w-full"
            data-testid="widget-image-placeholder"
          />
        )}
        {isSelected && (
          <Box
            align="center"
            className="tw:absolute tw:top-2 tw:right-2 tw:rounded-md tw:border tw:border-secondary tw:bg-surface tw:p-1.5 tw:text-fg-brand-primary"
            data-testid="widget-selected-check"
            justify="center">
            <CheckIcon className="tw:size-4" />
          </Box>
        )}
      </Box>
      <Box
        className="tw:shrink-0 tw:px-4 tw:pt-3 tw:pb-4"
        direction="col"
        gap={1}>
        <Typography className="tw:text-primary" size="text-sm" weight="medium">
          {widgetLabel}
        </Typography>
        <Typography
          as="p"
          className="widget-desc tw:m-0 tw:text-tertiary"
          data-testid="widget-description"
          size="text-xs">
          {widget.description ?? t('message.no-description-available')}
        </Typography>
      </Box>
    </Card>
  );
};

export default WidgetCard;
