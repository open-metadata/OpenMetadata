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
import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { isUndefined } from 'lodash';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import AddPlaceHolderIcon from '../../../../assets/svg/add-placeholder.svg?react';
import { SIZE } from '../../../../enums/common.enum';
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
      <Row className="h-full">
        {isEditable && (
          <Col span={24}>
            <Row gutter={8} justify="end">
              <Col>
                <DragOutlined
                  className="drag-widget-icon cursor-pointer"
                  data-testid="drag-widget-button"
                  size={14}
                />
              </Col>
              <Col>
                <CloseOutlined
                  data-testid="remove-widget-button"
                  size={14}
                  onClick={handleCloseClick}
                />
              </Col>
            </Row>
          </Col>
        )}
        <Col className="h-full" span={24}>
          <Row align="middle" className="h-full" justify="center">
            <Col>
              <Space
                align="center"
                className="w-full"
                direction="vertical"
                size={0}>
                <AddPlaceHolderIcon
                  data-testid="no-data-image"
                  height={iconHeight}
                  width={iconWidth}
                />
                <Typography.Text>
                  {t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
                    entity: t('label.widget'),
                  })}
                </Typography.Text>
                <Button
                  ghost
                  className="add-button"
                  data-testid="add-widget-button"
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={handleAddClick}>
                  {t('label.add')}
                </Button>
              </Space>
            </Col>
          </Row>
        </Col>
      </Row>
    </Card>
  );
}

export default EmptyWidgetPlaceholder;
