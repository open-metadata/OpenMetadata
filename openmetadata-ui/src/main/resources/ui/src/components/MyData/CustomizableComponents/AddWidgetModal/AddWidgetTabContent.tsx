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

import { PlusOutlined } from '@ant-design/icons';
import { Box, Grid, Typography } from '@openmetadata/ui-core-components';
import { Button, Image, Radio, RadioChangeEvent, Tooltip } from 'antd';
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

  const handleSizeChange = useCallback((e: RadioChangeEvent) => {
    setSelectedWidgetSize(e.target.value);
  }, []);

  return (
    <Grid className="layout-row layout-grid" data-testid={widget.id}>
      <Grid.Item className="layout-column" span={24}>
        <Box
          inline
          align="center"
          className="layout-space layout-space-horizontal"
          gap={2}
          itemClassName="layout-space-item">
          <Typography>{`${t('label.size')}:`}</Typography>
          <Radio.Group
            data-testid="size-selector-button"
            defaultValue={selectedWidgetSize}
            optionType="button"
            options={widgetSizeOptions}
            onChange={handleSizeChange}
          />
        </Box>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <Box className="layout-row h-min-480" justify="center" wrap="wrap">
          <Box className="layout-column tw:block">
            <Box
              inline
              align="center"
              className="layout-space"
              direction="col"
              gap={2}
              itemClassName="layout-space-item">
              <Image
                className="p-y-md"
                data-testid="widget-image"
                preview={false}
                src={widgetImage}
              />
              <Typography
                as="p"
                className="d-block text-center"
                data-testid="widget-description">
                {widget.description}
              </Typography>
              <Tooltip
                placement="bottom"
                title={widgetAddable ? '' : t('message.can-not-add-widget')}>
                <Button
                  className="p-x-lg m-t-md"
                  data-testid="add-widget-button"
                  disabled={!widgetAddable}
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={getAddWidgetHandler(widget, selectedWidgetSize)}>
                  {t('label.add')}
                </Button>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Grid.Item>
    </Grid>
  );
}

export default AddWidgetTabContent;
