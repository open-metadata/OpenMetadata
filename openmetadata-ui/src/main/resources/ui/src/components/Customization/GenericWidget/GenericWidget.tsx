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
import { Button, Card, Space } from 'antd';
import { startCase } from 'lodash';
import React, { useMemo } from 'react';
import { GlossaryTermDetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import customizeGlossaryTermPageClassBase from '../../../utils/CustomizeGlossaryTerm/CustomizeGlossaryTermBaseClass';
import { WIDGET_COMPONENTS } from '../../../utils/GenericWidget/GenericWidgetUtils';
import { useGlossaryStore } from '../../Glossary/useGlossary.store';

export const GenericWidget = (props: WidgetCommonProps) => {
  const handleRemoveClick = () => {
    if (props.handleRemoveWidget) {
      props.handleRemoveWidget(props.widgetKey);
    }
  };

  const { setGlossaryChildTerms } = useGlossaryStore();

  useMemo(() => {
    if (
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.TERMS_TABLE)
    ) {
      setGlossaryChildTerms(
        customizeGlossaryTermPageClassBase.getGlossaryChildTerms()
      );
    }

    return () => setGlossaryChildTerms([]);
  }, [props.widgetKey]);

  const widgetName = startCase(props.widgetKey.replace('KnowledgePanel.', ''));

  const cardContent = useMemo(() => {
    // Find the matching widget component based on prefix matching
    const matchingWidget = Object.entries(WIDGET_COMPONENTS).find(([key]) =>
      props.widgetKey.startsWith(key)
    );

    if (matchingWidget) {
      const [, Component] = matchingWidget;

      return Component();
    }

    return widgetName;
  }, [props.widgetKey]);

  return (
    <Card
      bodyStyle={{ height: '100%' }}
      className="h-full"
      title={
        <div className="d-flex justify-between align-center">
          <span>{widgetName}</span>
          {props.isEditView && (
            <Space size={8}>
              <DragOutlined
                className="drag-widget-icon cursor-pointer"
                data-testid="drag-widget-button"
                size={14}
              />
              <Button
                data-testid="remove-widget-button"
                icon={<CloseOutlined size={14} />}
                size="small"
                onClick={handleRemoveClick}
              />
            </Space>
          )}
        </div>
      }>
      {cardContent}
    </Card>
  );
};
