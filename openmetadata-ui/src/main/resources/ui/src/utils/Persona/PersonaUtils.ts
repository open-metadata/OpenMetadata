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
import { camelCase, map, startCase } from 'lodash';
import { ReactComponent as DashboardIcon } from '../../assets/svg/dashboard-colored.svg';
import { ReactComponent as DataAssetsIcon } from '../../assets/svg/data-assets.svg';
import { ReactComponent as DatabaseIcon } from '../../assets/svg/database-colored.svg';
import { ReactComponent as GlossaryIcon } from '../../assets/svg/glossary-colored.svg';
import { ReactComponent as GovernIcon } from '../../assets/svg/governance.svg';
import { ReactComponent as HomepageIcon } from '../../assets/svg/homepage.svg';
import { ReactComponent as APICollectionIcon } from '../../assets/svg/ic-api-collection.svg';
import { ReactComponent as APIEndpointIcon } from '../../assets/svg/ic-api-endpoint.svg';
import { ReactComponent as DashboardDataModelIcon } from '../../assets/svg/ic-dashboard-data-model-colored.svg';
import { ReactComponent as SchemaIcon } from '../../assets/svg/ic-database-schema-colored.svg';
import { ReactComponent as MessagingIcon } from '../../assets/svg/messaging-colored.svg';
import { ReactComponent as MetricColoredIcon } from '../../assets/svg/metric-colored.svg';
import { ReactComponent as MlModelIcon } from '../../assets/svg/ml-model-colored.svg';
import { ReactComponent as NavigationIcon } from '../../assets/svg/navigation.svg';
import { ReactComponent as PipelineIcon } from '../../assets/svg/pipeline-colored.svg';
import { ReactComponent as SearchIcon } from '../../assets/svg/search-colored.svg';
import { ReactComponent as StorageIcon } from '../../assets/svg/storage-colored.svg';
import { ReactComponent as StoredProcedureIcon } from '../../assets/svg/stored-procedure-colored.svg';
import { ReactComponent as TableIcon } from '../../assets/svg/table-colored.svg';
import { PageType } from '../../generated/system/ui/uiCustomization';
import { SettingMenuItem } from '../GlobalSettingsUtils';
import i18n from '../i18next/LocalUtil';

const ENTITY_ICONS: Record<string, SvgComponent> = {
  [PageType.Table]: TableIcon,
  [PageType.Container]: StorageIcon,
  [PageType.Dashboard]: DashboardIcon,
  [PageType.DashboardDataModel]: DashboardDataModelIcon,
  [PageType.Database]: DatabaseIcon,
  [PageType.DatabaseSchema]: SchemaIcon,
  [PageType.Domain]: SchemaIcon,
  [PageType.Glossary]: GlossaryIcon,
  [PageType.GlossaryTerm]: GlossaryIcon,
  [PageType.Pipeline]: PipelineIcon,
  [PageType.SearchIndex]: SearchIcon,
  [PageType.StoredProcedure]: StoredProcedureIcon,
  [PageType.Topic]: MessagingIcon,
  ['govern']: GovernIcon,
  ['dataAssets']: DataAssetsIcon,
  ['homepage']: HomepageIcon,
  ['navigation']: NavigationIcon,
  [PageType.APICollection]: APICollectionIcon,
  [PageType.APIEndpoint]: APIEndpointIcon,
  [PageType.MlModel]: MlModelIcon,
  [PageType.Metric]: MetricColoredIcon,
};

export const getCustomizePageCategories = (): SettingMenuItem[] => {
  return [
    {
      key: 'navigation',
      label: i18n.t('label.navigation'),
      description: 'Customize left sidebar ',
      icon: ENTITY_ICONS[camelCase('Navigation')],
    },
    {
      key: PageType.LandingPage,
      label: i18n.t('label.homepage'),
      description: 'Customize the My data page with widget of your preference',
      icon: ENTITY_ICONS[camelCase('Homepage')],
    },
    {
      key: 'governance',
      label: i18n.t('label.governance'),
      description: 'Customize the Govern pages with widget of your preference',
      icon: ENTITY_ICONS[camelCase('GOVERN')],
    },
    {
      key: 'data-assets',
      label: i18n.t('label.data-asset-plural'),
      description:
        'Customize the entity detail page with widget of your preference',
      icon: ENTITY_ICONS[camelCase('data-assets')],
    },
  ];
};

const generateSettingItems = (pageType: PageType): SettingMenuItem => ({
  key: pageType,
  label: startCase(pageType),
  description: i18n.t('message.entity-customize-description', {
    entity: startCase(pageType),
  }),
  icon: ENTITY_ICONS[pageType],
});

export const getCustomizePageOptions = (
  category: string
): SettingMenuItem[] => {
  const list = map(PageType);

  switch (category) {
    case 'governance':
      return list.reduce((acc, item) => {
        if (
          [PageType.Glossary, PageType.GlossaryTerm, PageType.Domain].includes(
            item
          )
        ) {
          acc.push(generateSettingItems(item));
        }

        return acc;
      }, [] as SettingMenuItem[]);
    case 'data-assets':
      return list.reduce((acc, item) => {
        if (
          ![
            PageType.Glossary,
            PageType.GlossaryTerm,
            PageType.Domain,
            PageType.LandingPage,
          ].includes(item)
        ) {
          acc.push(generateSettingItems(item));
        }

        return acc;
      }, [] as SettingMenuItem[]);
    default:
      return [];
  }
};
