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

import { CloseOutlined, DragOutlined, PlusOutlined } from '@ant-design/icons';
import { Box, Grid, Typography } from '@openmetadata/ui-core-components';
import { Button, Card } from 'antd';
import { isUndefined } from 'lodash';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../../assets/svg/add-placeholder.svg';
import { SIZE } from '../../../../enums/common.enum';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';
import './empty-widget-placeholder.less';
import { EmptyWidgetPlaceholderProps } from './EmptyWidgetPlaceholder.interface';

function EmptyWidgetPlaceholder({
  iconHeight = SIZE.MEDIUM,
  iconWidth = SIZE.MEDIUM,
  widgetKey,
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
  handleRemoveWidget,
  isEditable = true,
}: Readonly<EmptyWidgetPlaceholderProps>) {
  const { t } = useTranslation();

  const handleCloseClick = useCallback(() => {
    !isUndefined(handleRemoveWidget) && handleRemoveWidget(widgetKey);
  }, []);

  const handleAddClick = useCallback(() => {
    handlePlaceholderWidgetKey(widgetKey);
    handleOpenAddWidgetModal();
  }, []);

  return (
    <Card
      bodyStyle={{ height: '100%' }}
      className="empty-widget-placeholder"
      data-testid={widgetKey}>
      <Grid className="layout-row layout-grid h-full">
        {isEditable && (
          <Grid.Item className="layout-column" span={24}>
            <Box
              className="layout-row"
              justify="end"
              style={getLayoutGutter(8)}
              wrap="wrap">
              <Box className="layout-column tw:block">
                <DragOutlined
                  className="drag-widget-icon cursor-pointer"
                  data-testid="drag-widget-button"
                  size={14}
                />
              </Box>
              <Box className="layout-column tw:block">
                <CloseOutlined
                  data-testid="remove-widget-button"
                  size={14}
                  onClick={handleCloseClick}
                />
              </Box>
            </Box>
          </Grid.Item>
        )}
        <Grid.Item className="layout-column h-full" span={24}>
          <Box
            align="center"
            className="layout-row h-full"
            justify="center"
            wrap="wrap">
            <Box className="layout-column tw:block">
              <Box
                inline
                align="center"
                className="layout-space w-full"
                direction="col"
                gap={0}
                itemClassName="layout-space-item">
                <AddPlaceHolderIcon
                  data-testid="no-data-image"
                  height={iconHeight}
                  width={iconWidth}
                />
                <Typography>
                  {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
                    entity: t('label.widget'),
                  })}
                </Typography>
                <Button
                  ghost
                  className="add-button"
                  data-testid="add-widget-button"
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={handleAddClick}>
                  {t('label.add')}
                </Button>
              </Box>
            </Box>
          </Box>
        </Grid.Item>
      </Grid>
    </Card>
  );
}

export default EmptyWidgetPlaceholder;
