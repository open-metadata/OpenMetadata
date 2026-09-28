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
import { ButtonUtility } from '@openmetadata/ui-core-components';
import { Settings } from '@openmetadata/ui-core-components/icons';
import { Button, Card, Space } from 'antd';
import { noop, startCase } from 'lodash';
import { useLayoutEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../enums/entity.enum';
import { PageType } from '../../../generated/system/ui/page';
import type { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../pages/CustomizablePage/CustomizeStore';
import { getEntityTypeFromPageType } from '../../../pages/CustomizeDetailsPage/CustomizeDetailPage.interface';
import { getGlossaryChildTermsForCustomization } from '../../../utils/CustomizeGlossaryTerm/CustomizeGlossaryTermPureUtils';
import { getDummyDataByPage } from '../../../utils/CustomizePage/CustomizePageDispatchUtils';
import { WIDGET_COMPONENTS } from '../../../utils/GenericWidget/GenericWidgetUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { CustomPropertiesWidgetSettings } from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.types';
import { getCustomPropertiesWidgetSettings } from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.utils';
import { CustomPropertiesWidgetPreview } from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidgetPreview';
import { CustomPropertiesWidgetSettingsModal } from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidgetSettingsModal';
import { resolveWidgetKey } from '../../DataAssets/CommonWidgets/CommonWidgets.utils';
import type { EntityUnion } from '../../Explore/ExplorePage.interface';
import { useGlossaryStore } from '../../Glossary/useGlossary.store';
import { GenericProvider } from '../GenericProvider/GenericProvider';
import './generic-widget.less';

const CONFIGURABLE_WIDGET_KEYS = [DetailPageWidgetKeys.CUSTOM_PROPERTIES];

export const GenericWidget = (props: WidgetCommonProps) => {
  const { t } = useTranslation();
  const { currentPageType } = useCustomizeStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isCustomPropertiesWidget = Boolean(
    resolveWidgetKey(props.widgetKey, CONFIGURABLE_WIDGET_KEYS)
  );
  const isConfigurable =
    isCustomPropertiesWidget && Boolean(props.handleWidgetConfigChange);

  const handleSettingsSave = (settings: CustomPropertiesWidgetSettings) => {
    props.handleWidgetConfigChange?.(props.widgetKey, {
      ...props.widgetConfig?.config,
      ...settings,
    });
    setIsSettingsOpen(false);
  };
  const handleRemoveClick = () => {
    if (props.handleRemoveWidget) {
      props.handleRemoveWidget(props.widgetKey);
    }
  };

  const { setGlossaryChildTerms } = useGlossaryStore();
  const data = getDummyDataByPage(currentPageType as PageType);

  useLayoutEffect(() => {
    if (
      props.isEditView &&
      props.widgetKey.startsWith(GlossaryTermDetailPageWidgetKeys.TERMS_TABLE)
    ) {
      setGlossaryChildTerms(getGlossaryChildTermsForCustomization());
    }
  }, [props.widgetKey, props.isEditView, setGlossaryChildTerms]);

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
        <Space size={4}>
          {isConfigurable && (
            <ButtonUtility
              color="tertiary"
              data-testid="widget-settings-button"
              icon={Settings}
              size="xs"
              tooltip={t('label.configure-entity', { entity: widgetName })}
              onClick={() => setIsSettingsOpen(true)}
            />
          )}
          {props.handleRemoveWidget && (
            <Button
              data-testid="remove-widget-button"
              icon={<MinusCircleOutlined size={16} />}
              size="small"
              onClick={handleRemoveClick}
            />
          )}
        </Space>
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
      {isCustomPropertiesWidget ? (
        <CustomPropertiesWidgetPreview
          config={props.widgetConfig?.config}
          entityType={getEntityTypeFromPageType(currentPageType)}
        />
      ) : (
        cardContent
      )}
      {isSettingsOpen && (
        <CustomPropertiesWidgetSettingsModal
          entityType={getEntityTypeFromPageType(currentPageType)}
          settings={getCustomPropertiesWidgetSettings(
            props.widgetConfig?.config
          )}
          onCancel={() => setIsSettingsOpen(false)}
          onSave={handleSettingsSave}
        />
      )}
    </Card>
  );
};
