/*
 *  Copyright 2023 Collate.
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
  Button,
  RadioButton,
  RadioGroup,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageType } from '../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import customizeDetailPageClassBase from '../../../../utils/CustomizeDetailPage/CustomizeDetailPageClassBase';
import customizePageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { AddWidgetTabContentProps } from './AddWidgetModal.interface';

function AddWidgetTabContent({
  getAddWidgetHandler,
  maxGridSizeSupport,
  widget,
  widgetSizeOptions,
}: Readonly<AddWidgetTabContentProps>) {
  const { t } = useTranslation();
  const [selectedWidgetSize, setSelectedWidgetSize] = useState<number>(
    widgetSizeOptions[0].value
  );
  const { currentPageType } = useCustomizeStore();

  const widgetAddable = useMemo(
    () => selectedWidgetSize <= maxGridSizeSupport,
    [selectedWidgetSize, maxGridSizeSupport]
  );

  const widgetImage = useMemo(() => {
    switch (currentPageType) {
      case PageType.Glossary:
      case PageType.GlossaryTerm:
        return customizeDetailPageClassBase.getGlossaryWidgetImageFromKey(
          widget.fullyQualifiedName,
          selectedWidgetSize
        );
      case PageType.LandingPage:
        return customizePageClassBase.getWidgetImageFromKey(
          widget.fullyQualifiedName
        );
      default:
        return customizeDetailPageClassBase.getDetailPageWidgetImageFromKey(
          widget.fullyQualifiedName,
          selectedWidgetSize
        );
    }
  }, [widget, selectedWidgetSize, currentPageType]);

  const handleSizeChange = useCallback((value: string) => {
    setSelectedWidgetSize(Number(value));
  }, []);

  return (
    <Box data-testid={widget.id} direction="col" gap={4}>
      <Box align="center" direction="row" gap={2}>
        <Typography>{`${t('label.size')}:`}</Typography>
        <RadioGroup
          data-testid="size-selector-button"
          orientation="horizontal"
          value={String(selectedWidgetSize)}
          onChange={handleSizeChange}>
          {widgetSizeOptions.map((opt) => (
            <RadioButton key={opt.value} value={String(opt.value)}>
              {opt.label}
            </RadioButton>
          ))}
        </RadioGroup>
      </Box>
      <Box
        align="center"
        className="tw:min-h-[480px]"
        direction="col"
        gap={4}
        justify="center">
        <img
          alt={widget.name}
          className="tw:py-4"
          data-testid="widget-image"
          src={widgetImage}
        />
        <Typography
          as="p"
          className="tw:block tw:text-center"
          data-testid="widget-description">
          {widget.description}
        </Typography>
        <Tooltip
          placement="bottom"
          title={widgetAddable ? '' : t('message.can-not-add-widget')}>
          <Button
            className="tw:px-8 tw:mt-4"
            color="primary"
            data-testid="add-widget-button"
            iconLeading={<Plus />}
            isDisabled={!widgetAddable}
            onPress={getAddWidgetHandler(widget, selectedWidgetSize)}>
            {t('label.add')}
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default AddWidgetTabContent;
