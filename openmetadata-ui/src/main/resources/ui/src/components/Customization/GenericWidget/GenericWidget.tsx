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
import { ButtonUtility, Card } from '@openmetadata/ui-core-components';
import { Settings } from '@openmetadata/ui-core-components/icons';
import { Button, Space } from 'antd';
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
    // Light values reproduce the antd inner Card this replaced.
    <Card className="tw:h-full tw:overflow-visible tw:border-utility-gray-blue-100 tw:pb-4 tw:text-sm tw:leading-[1.5715] tw:text-primary tw:tabular-nums tw:dark:border-subtle">
      <div className="tw:-mb-px tw:flex tw:min-h-12 tw:items-center tw:rounded-xl tw:bg-utility-gray-100 tw:px-6 tw:font-medium tw:text-black/85 tw:dark:text-primary">
        <div className="tw:inline-block tw:flex-1 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap tw:py-3 tw:text-sm tw:leading-[1.5715]">
          <Space>
            <Button
              className="drag-widget-icon"
              data-testid="drag-widget-button"
              icon={<HolderOutlined size={16} />}
              size="small"
            />
            {widgetName}
          </Space>
        </div>
        {(isConfigurable || props.handleRemoveWidget) && (
          <div className="tw:ml-auto tw:flex tw:items-center tw:gap-1 tw:py-[13.5px] tw:text-sm tw:leading-[1.5715] tw:font-normal tw:text-primary">
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
          </div>
        )}
      </div>
      <div className="tw:pointer-events-none tw:max-h-[calc(100%-48px)] tw:overflow-y-auto tw:px-6 tw:py-4">
        {isCustomPropertiesWidget ? (
          <CustomPropertiesWidgetPreview
            config={props.widgetConfig?.config}
            entityType={getEntityTypeFromPageType(currentPageType)}
          />
        ) : (
          cardContent
        )}
      </div>
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
