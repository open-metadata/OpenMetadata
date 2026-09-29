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
import {
  Box,
  ButtonUtility,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  DotsGrid,
  MinusCircle,
  Settings,
} from '@openmetadata/ui-core-components/icons';
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
import { CUSTOM_PROPERTIES_WIDGET_GRID_WIDTH } from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.constants';
import {
  CustomPropertiesWidgetSettings,
  CustomPropertiesWidgetStyle,
} from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.types';
import { getCustomPropertiesWidgetSettings } from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidget.utils';
import {
  CustomPropertiesWidgetEditor,
  CustomPropertiesWidgetHeaderInfo,
} from '../../common/CustomPropertyTable/CustomPropertiesWidget/CustomPropertiesWidgetEditor';
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

  const entityType = getEntityTypeFromPageType(currentPageType);
  const customPropertiesSettings = useMemo(
    () => getCustomPropertiesWidgetSettings(props.widgetConfig?.config),
    [props.widgetConfig?.config]
  );

  const saveCustomPropertiesSettings = (
    settings: CustomPropertiesWidgetSettings,
    width?: number
  ) =>
    props.handleWidgetConfigChange?.(
      props.widgetKey,
      { ...props.widgetConfig?.config, ...settings },
      width
    );

  const handleSettingsSave = (
    settings: CustomPropertiesWidgetSettings,
    style: CustomPropertiesWidgetStyle
  ) => {
    saveCustomPropertiesSettings(
      settings,
      CUSTOM_PROPERTIES_WIDGET_GRID_WIDTH[style]
    );
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
      <Box
        align="center"
        className="tw:-mb-px tw:min-h-12 tw:rounded-xl tw:bg-utility-gray-100 tw:px-4 tw:py-2"
        gap={2}>
        {/* Grid drag handle: react-grid-layout starts a drag on mousedown here. */}
        <span
          aria-hidden
          className="drag-widget-icon tw:flex tw:shrink-0 tw:cursor-grab tw:rounded-md tw:border tw:border-secondary tw:bg-primary tw:p-1.5 tw:text-fg-quaternary tw:active:cursor-grabbing"
          data-testid="drag-widget-button">
          <DotsGrid className="tw:size-4" />
        </span>
        <Typography
          className="tw:min-w-0 tw:truncate tw:font-medium tw:text-primary"
          size="text-sm">
          {widgetName}
        </Typography>
        <Box align="center" className="tw:ml-auto tw:shrink-0" gap={2}>
          {isCustomPropertiesWidget && (
            <CustomPropertiesWidgetHeaderInfo
              entityType={entityType}
              settings={customPropertiesSettings}
            />
          )}
          {props.handleRemoveWidget && (
            <ButtonUtility
              color="secondary"
              data-testid="remove-widget-button"
              icon={MinusCircle}
              size="xs"
              tooltip={t('label.remove-entity', {
                entity: t('label.widget'),
              })}
              onClick={handleRemoveClick}
            />
          )}
          {isConfigurable && (
            <ButtonUtility
              color="secondary"
              data-testid="widget-settings-button"
              icon={Settings}
              size="xs"
              tooltip={t('label.configure-entity', { entity: widgetName })}
              onClick={() => setIsSettingsOpen(true)}
            />
          )}
        </Box>
      </Box>
      {isCustomPropertiesWidget ? (
        <div className="tw:max-h-[calc(100%-48px)] tw:overflow-y-auto tw:p-4">
          <CustomPropertiesWidgetEditor
            entityType={entityType}
            settings={customPropertiesSettings}
            onChange={saveCustomPropertiesSettings}
          />
        </div>
      ) : (
        <div className="tw:pointer-events-none tw:max-h-[calc(100%-48px)] tw:overflow-y-auto tw:px-6 tw:py-4">
          {cardContent}
        </div>
      )}
      {isSettingsOpen && (
        <CustomPropertiesWidgetSettingsModal
          entityType={entityType}
          settings={customPropertiesSettings}
          onCancel={() => setIsSettingsOpen(false)}
          onSave={handleSettingsSave}
        />
      )}
    </Card>
  );
};
