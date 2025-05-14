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
import { HolderOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { Button, Card, Space } from 'antd';
import { noop, startCase } from 'lodash';
import { useMemo } from 'react';
import { GlossaryTermDetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../enums/entity.enum';
import { PageType } from '../../../generated/system/ui/page';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../pages/CustomizablePage/CustomizeStore';
import customizeGlossaryTermPageClassBase from '../../../utils/CustomizeGlossaryTerm/CustomizeGlossaryTermBaseClass';
import { getDummyDataByPage } from '../../../utils/CustomizePage/CustomizePageUtils';
import { WIDGET_COMPONENTS } from '../../../utils/GenericWidget/GenericWidgetUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { EntityUnion } from '../../Explore/ExplorePage.interface';
import { useGlossaryStore } from '../../Glossary/useGlossary.store';
import { GenericProvider } from '../GenericProvider/GenericProvider';
import './generic-widget.less';

export const GenericWidget = (props: WidgetCommonProps) => {
  const { currentPageType } = useCustomizeStore();
  const handleRemoveClick = () => {
    if (props.handleRemoveWidget) {
      props.handleRemoveWidget(props.widgetKey);
    }
  };

  const { setGlossaryChildTerms } = useGlossaryStore();
  const data = getDummyDataByPage(currentPageType as PageType);

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

  const widgetName = startCase(
    props.widgetKey.replace('KnowledgePanel.', '').replace(/\d+$/, '')
  );

  const cardContent = useMemo(() => {
    // Find the matching widget component based on prefix matching
    const matchingWidget = Object.entries(WIDGET_COMPONENTS).find(([key]) =>
      props.widgetKey.startsWith(key)
    );

    if (matchingWidget) {
      const [, Component] = matchingWidget;

      return (
        <GenericProvider
          data={data as EntityUnion & { id: string }}
          permissions={DEFAULT_ENTITY_PERMISSION}
          type={EntityType.TABLE}
          onUpdate={async () => noop()}>
          {Component(data)}
        </GenericProvider>
      );
    }

    return widgetName;
  }, [props.widgetKey]);

  return (
    <Card
      className="generic-widget-card"
      extra={
        <Button
          data-testid="remove-widget-button"
          icon={<MinusCircleOutlined size={16} />}
          size="small"
          onClick={handleRemoveClick}
        />
      }
      title={
        <Space>
          <Button
            className="drag-widget-icon"
            data-testid="drag-widget-button"
            icon={<HolderOutlined size={16} />}
            size="small"
          />
          {widgetName}
        </Space>
      }
      type="inner">
      {cardContent}
    </Card>
  );
};
