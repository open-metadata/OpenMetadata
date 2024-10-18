/*
 *  Copyright 2024 Collate.
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
import { CloseOutlined, DragOutlined } from '@ant-design/icons';
import { Card, Space } from 'antd';
import React from 'react';
import { WidgetCommonProps } from '../../../../pages/CustomizablePage/CustomizablePage.interface';

export const GenericWidget = (props: WidgetCommonProps) => {
  const handleRemoveClick = () => {
    if (props.handleRemoveWidget) {
      props.handleRemoveWidget(props.widgetKey);
    }
  };

  return (
    <Card
      bodyStyle={{ height: '100%' }}
      className="h-full"
      title={
        <div className="d-flex justify-between align-center">
          <span>{props.widgetKey}</span>
          {props.isEditView && (
            <Space size={8}>
              <DragOutlined
                className="drag-widget-icon cursor-pointer"
                data-testid="drag-widget-button"
                size={14}
              />
              <CloseOutlined
                data-testid="remove-widget-button"
                size={14}
                onClick={handleRemoveClick}
              />
            </Space>
          )}
        </div>
      }>
      {props.widgetKey}
    </Card>
  );
};
