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
import AdminIcon from '../assets/svg/admin-colored.svg?react';
import APICollectionIcon from '../assets/svg/api-collection-colored.svg?react';
import APIEndpointIcon from '../assets/svg/api-endpoints-colored.svg?react';
import IconAPI from '../assets/svg/apis-colored.svg?react';
import ApplicationIcon from '../assets/svg/application-colored.svg?react';
import BotIcon from '../assets/svg/bot-colored.svg?react';
import ChartIcon from '../assets/svg/chart-colored.svg?react';
import DashboardIcon from '../assets/svg/dashboard-colored-new.svg?react';
import DashboardDataModelIcon from '../assets/svg/dashboard-data-models-colored.svg?react';
import DataAssetRulesIcon from '../assets/svg/data-asset-rules.svg?react';
import DataAssetsIcon from '../assets/svg/data-assets-colored-new.svg?react';
import DataProductIcon from '../assets/svg/data-product-colored.svg?react';
import DatabaseIcon from '../assets/svg/database-colored-new.svg?react';
import SchemaIcon from '../assets/svg/database-schema-colored.svg?react';
import DomainIcon from '../assets/svg/domain-colored.svg?react';
import EmailIcon from '../assets/svg/email-colored.svg?react';
import GlossaryIcon from '../assets/svg/glossary-term-colored-new.svg?react';
import HealthIcon from '../assets/svg/health-check.svg?react';
import LineageIcon from '../assets/svg/lineage-colored.svg?react';
import LoginIcon from '../assets/svg/login-colored.svg?react';
import MessagingIcon from '../assets/svg/messaging-colored-new.svg?react';
import MetadataIcon from '../assets/svg/metadata-colored-new.svg?react';
import MetricIcon from '../assets/svg/metric-colored-new.svg?react';
import MlModelIcon from '../assets/svg/ml-models-colored-new.svg?react';
import PersonasIcon from '../assets/svg/persona-colored.svg?react';
import PipelineIcon from '../assets/svg/pipelines-colored-new.svg?react';
import PoliciesIcon from '../assets/svg/policies-colored-new.svg?react';
import OpenMetadataIcon from '../assets/svg/preferences-omd.svg?react';
import ProfilerConfigIcon from '../assets/svg/profiler-configuration-colored.svg?react';
import QueryIcon from '../assets/svg/query-colored-new.svg?react';
import RolesIcon from '../assets/svg/roles-colored-new.svg?react';
import SearchIconV1 from '../assets/svg/search-colored-new.svg?react';
import SearchIndexIcon from '../assets/svg/search-index-colored-new.svg?react';
import AccessControlIcon from '../assets/svg/setting-access-control.svg?react';
import CustomProperties from '../assets/svg/setting-custom-properties.svg?react';
import DataObservability from '../assets/svg/setting-data-observability.svg?react';
import ManagementIcon from '../assets/svg/setting-management.svg?react';
import NotificationIcon from '../assets/svg/setting-notification.svg?react';
import ServiceIcon from '../assets/svg/setting-services-omd.svg?react';
import StorageIcon from '../assets/svg/storage-colored-new.svg?react';
import StoredProcedureIcon from '../assets/svg/stored-procedures-colored-new.svg?react';
import TableIcon from '../assets/svg/table-colored-new.svg?react';
import TagIcon from '../assets/svg/tags-colored.svg?react';
import TeamsIcon from '../assets/svg/teams-colored.svg?react';
import AppearanceIcon from '../assets/svg/theme-colored-new.svg?react';
import LinkIcon from '../assets/svg/url-link-colored.svg?react';
import UsersIcon from '../assets/svg/user-colored.svg?react';
import { SettingMenuItem } from './GlobalSettingsUtils';

import PreferencesSearchIcon from '../assets/svg/preferences-search.svg?react';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import {
  ResourceEntity,
  UIPermission,
} from '../context/PermissionProvider/PermissionProvider.interface';
import { userPermissions } from '../utils/PermissionsUtils';
import brandClassBase from './BrandData/BrandClassBase';
import { t } from './i18next/LocalUtil';

class GlobalSettingsClassBase {
  settingCategories: Record<string, { name: string; url: string }> = {
    [GlobalSettingsMenuCategory.SERVICES]: {
      name: t('label.service-plural'),
      url: GlobalSettingsMenuCategory.SERVICES,
    },
    [GlobalSettingsMenuCategory.NOTIFICATIONS]: {
      name: t('label.notification-plural'),
      url: GlobalSettingsMenuCategory.NOTIFICATIONS,
    },
    [GlobalSettingsMenuCategory.MEMBERS]: {
      name: t('label.member-plural'),
      url: GlobalSettingsMenuCategory.MEMBERS,
    },
    [GlobalSettingsMenuCategory.ACCESS]: {
      name: t('label.access-control'),
      url: GlobalSettingsMenuCategory.ACCESS,
    },
    [GlobalSettingsMenuCategory.PREFERENCES]: {
      name: t('label.preference-plural'),
      url: GlobalSettingsMenuCategory.PREFERENCES,
    },
    [GlobalSettingOptions.SEARCH_SETTINGS]: {
      name: t('label.search'),
      url: `${GlobalSettingsMenuCategory.PREFERENCES}/${GlobalSettingOptions.SEARCH_SETTINGS}`,
    },
    [GlobalSettingsMenuCategory.CUSTOM_PROPERTIES]: {
      name: t('label.custom-property-plural'),
      url: GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
    },
    [GlobalSettingsMenuCategory.BOTS]: {
      name: t('label.bot-plural'),
      url: GlobalSettingsMenuCategory.BOTS,
    },
    [GlobalSettingsMenuCategory.APPLICATIONS]: {
      name: t('label.application-plural'),
      url: GlobalSettingsMenuCategory.APPLICATIONS,
    },
    [GlobalSettingsMenuCategory.PERSONA]: {
      name: t('label.persona'),
      url: GlobalSettingsMenuCategory.PERSONA,
    },
  };

  protected updateSettingCategories(
    categories: Record<string, { name: string; url: string }>
  ) {
    this.settingCategories = categories;
  }

  public getServiceIcon() {
    return ServiceIcon;
  }

  public getPreferenceIcon() {
    return OpenMetadataIcon;
  }

  /**
   * getSidebarItems
   */
  public getGlobalSettingsMenuWithPermission(
    permissions: UIPermission,
    isAdminUser?: boolean
  ): Array<SettingMenuItem> {
    return [
      {
        category: t('label.service-plural'),
        key: GlobalSettingsMenuCategory.SERVICES,
        icon: this.getServiceIcon(),
        description: t('message.service-description'),
        items: [
          {
            label: t('label.api-uppercase-plural'),
            description: t('message.page-sub-header-for-apis'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.API_SERVICE,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.APIS}`,
            icon: IconAPI,
          },
          {
            label: t('label.database-plural'),
            description: t('message.page-sub-header-for-databases'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.DATABASE_SERVICE,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.DATABASES}`,
            icon: DatabaseIcon,
          },
          {
            label: t('label.messaging'),
            description: t('message.page-sub-header-for-messagings'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.MESSAGING_SERVICE,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.MESSAGING}`,
            icon: MessagingIcon,
          },
          {
            label: t('label.dashboard-plural'),
            description: t('message.page-sub-header-for-dashboards'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.DASHBOARD_SERVICE,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.DASHBOARDS}`,
            icon: DashboardIcon,
          },
          {
            label: t('label.pipeline-plural'),
            description: t('message.page-sub-header-for-pipelines'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.PIPELINE_SERVICE,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.PIPELINES}`,
            icon: PipelineIcon,
          },
          {
            label: t('label.ml-model-plural'),
            description: t('message.page-sub-header-for-ml-models'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.ML_MODEL_SERVICE,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.MLMODELS}`,
            icon: MlModelIcon,
          },
          {
            label: t('label.storage-plural'),
            description: t('message.page-sub-header-for-storages'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.STORAGE_SERVICE,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.STORAGES}`,
            icon: StorageIcon,
          },
          {
            label: t('label.search'),
            description: t('message.page-sub-header-for-search'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.SEARCH_SERVICE,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.SEARCH}`,
            icon: SearchIconV1,
          },
          {
            label: t('label.metadata'),
            description: t('message.page-sub-header-for-metadata'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.METADATA_SERVICE,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.METADATA}`,
            icon: MetadataIcon,
          },
          {
            label: t('label.data-observability'),
            description: t('message.page-sub-header-for-data-observability'),
            isProtected: true,
            key: `${GlobalSettingsMenuCategory.SERVICES}.${GlobalSettingOptions.DATA_OBSERVABILITY}`,
            icon: DataObservability,
          },
        ],
      },
      {
        category: t('label.application-plural'),
        isProtected: Boolean(isAdminUser),
        key: GlobalSettingOptions.APPLICATIONS,
        icon: ApplicationIcon,
        description: t('message.application-to-improve-data'),
      },
      {
        category: t('label.notification-plural'),
        key: GlobalSettingsMenuCategory.NOTIFICATIONS,
        icon: NotificationIcon,
        description: t('message.notification-description'),
        isProtected: userPermissions.hasViewPermissions(
          ResourceEntity.EVENT_SUBSCRIPTION,
          permissions
        ),
      },
      {
        category: t('label.team-user-management'),
        key: GlobalSettingsMenuCategory.MEMBERS,
        icon: ManagementIcon,
        description: t('message.team-member-management-description', {
          brandName: brandClassBase.getPageTitle(),
        }),
        items: [
          {
            label: t('label.team-plural'),
            description: t('message.page-sub-header-for-teams'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.TEAM,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.TEAMS}`,
            icon: TeamsIcon,
          },
          {
            label: t('label.user-plural'),
            description: t('message.page-sub-header-for-users'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.USER,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.USERS}`,
            icon: UsersIcon,
          },
          {
            label: t('label.admin-plural'),
            description: t('message.page-sub-header-for-admins'),
            isProtected: userPermissions.hasViewPermissions(
              ResourceEntity.USER,
              permissions
            ),
            key: `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.ADMINS}`,
            icon: AdminIcon,
          },
          {
            label: t('label.online-user-plural'),
            description: t('message.page-sub-header-for-online-users'),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.MEMBERS}.${GlobalSettingOptions.ONLINE_USERS}`,
            icon: UsersIcon,
          },
        ],
      },
      {
        category: t('label.access-control'),
        key: GlobalSettingsMenuCategory.ACCESS,
        icon: AccessControlIcon,
        description: t('message.access-control-description'),
        items: [
          {
            label: t('label.role-plural'),
            description: t('message.page-sub-header-for-roles'),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.ACCESS}.${GlobalSettingOptions.ROLES}`,
            icon: RolesIcon,
          },
          {
            label: t('label.policy-plural'),
            description: t('message.page-sub-header-for-policies'),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.ACCESS}.${GlobalSettingOptions.POLICIES}`,
            icon: PoliciesIcon,
          },
          {
            label: t('label.permission-debugger'),
            description: t('message.page-sub-header-for-permission-debugger'),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.ACCESS}.${GlobalSettingOptions.PERMISSION_DEBUGGER}`,
            icon: AccessControlIcon,
          },
        ],
      },
      {
        category: t('label.preference-plural'),
        key: GlobalSettingsMenuCategory.PREFERENCES,
        icon: this.getPreferenceIcon(),
        description: t('message.customize-brand-description', {
          brandName: brandClassBase.getPageTitle(),
        }),
        items: [
          {
            label: t('label.theme'),
            description: t('message.appearance-configuration-message'),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.APPEARANCE}`,
            icon: AppearanceIcon,
          },
          {
            label: t('label.email'),
            description: t('message.email-configuration-message'),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.EMAIL}`,
            icon: EmailIcon,
          },
          {
            label: t('label.login-configuration'),
            description: t('message.page-sub-header-for-login-configuration'),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.LOGIN_CONFIGURATION}`,
            icon: LoginIcon,
          },
          {
            label: t('label.health-check'),
            description: t(
              'message.page-sub-header-for-om-health-configuration'
            ),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.OM_HEALTH}`,
            icon: HealthIcon,
          },
          {
            label: t('label.profiler-configuration'),
            description: t(
              'message.page-sub-header-for-profiler-configuration'
            ),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.PROFILER_CONFIGURATION}`,
            icon: ProfilerConfigIcon,
          },
          {
            label: t('label.search'),
            description: t('message.page-sub-header-for-search-setting'),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}`,
            icon: PreferencesSearchIcon,
            items: [
              {
                label: t('label.table-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.table-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.TABLES}`,
                icon: TableIcon,
              },
              {
                label: t('label.dashboard-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.dashboard-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.DASHBOARDS}`,
                icon: DashboardIcon,
              },
              {
                label: t('label.pipeline-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.pipeline-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.PIPELINES}`,
                icon: PipelineIcon,
              },
              {
                label: t('label.topic-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.topic-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.TOPICS}`,
                icon: MessagingIcon,
              },
              {
                label: t('label.glossary-term'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.glossary-term'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.GLOSSARY_TERM}`,
                icon: GlossaryIcon,
              },
              {
                label: t('label.api-endpoint'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.api-endpoint'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.API_ENDPOINTS}`,
                icon: APIEndpointIcon,
              },
              {
                label: t('label.dashboard-data-model-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.dashboard-data-model-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.DASHBOARD_DATA_MODEL}`,
                icon: DashboardDataModelIcon,
              },
              {
                label: t('label.stored-procedure-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.stored-procedure-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.STORED_PROCEDURES}`,
                icon: StoredProcedureIcon,
              },
              {
                label: t('label.container-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.container-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.CONTAINERS}`,
                icon: StorageIcon,
              },
              {
                label: t('label.ml-model-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.ml-model-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.MLMODELS}`,
                icon: MlModelIcon,
              },
              {
                label: t('label.data-product-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.data-product-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.DATA_PRODUCT}`,
                icon: DataAssetsIcon,
              },
              {
                label: t('label.query'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.query'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.QUERY}`,
                icon: QueryIcon,
              },
              {
                label: t('label.tag-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.tag-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.TAGS}`,
                icon: TagIcon,
              },
              {
                label: t('label.database-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.database-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.DATABASES}`,
                icon: DatabaseIcon,
              },
              {
                label: t('label.database-schema'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.database-schema'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.DATABASE_SCHEMA}`,
                icon: SchemaIcon,
              },
              {
                label: t('label.domain-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.domain-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.DOMAINS}`,
                icon: DomainIcon,
              },
              {
                label: t('label.search-index-plural'),
                description: t('message.search-settings-for-entity', {
                  entity: t('label.search-index-plural'),
                }),
                isProtected: Boolean(isAdminUser),
                key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.SEARCH_SETTINGS}.${GlobalSettingOptions.SEARCH_INDEXES}`,
                icon: SearchIndexIcon,
              },
            ].sort((a, b) => a.label.localeCompare(b.label)),
          },
          {
            label: t('label.lineage'),
            description: t(
              'message.page-sub-header-for-lineage-config-setting'
            ),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.LINEAGE_CONFIG}`,
            icon: LineageIcon,
          },
          {
            label: t('label.open-metadata-url'),
            description: t('message.om-url-configuration-message'),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.OM_URL_CONFIG}`,
            icon: LinkIcon,
          },
          {
            label: t('label.data-asset-rules'),
            description: t('message.data-asset-rules-message'),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.PREFERENCES}.${GlobalSettingOptions.DATA_ASSET_RULES}`,
            icon: DataAssetRulesIcon,
            isBeta: true,
          },
        ],
      },
      {
        category: t('label.custom-property-plural'),
        key: GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
        icon: CustomProperties,
        description: t('message.custom-properties-description'),
        items: [
          {
            label: t('label.api-collection'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.api-collection'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.API_COLLECTIONS}`,
            icon: APICollectionIcon,
          },
          {
            label: t('label.api-endpoint'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.api-endpoint'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.API_ENDPOINTS}`,
            icon: APIEndpointIcon,
          },
          {
            label: t('label.data-product'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.data-product'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DATA_PRODUCT}`,
            icon: DataProductIcon,
          },
          {
            label: t('label.dashboard-data-model-plural'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.dashboard-data-model-plural'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DASHBOARD_DATA_MODEL}`,
            icon: DashboardDataModelIcon,
          },
          {
            label: t('label.database'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.database'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DATABASES}`,
            icon: DatabaseIcon,
          },
          {
            label: t('label.database-schema'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.database-schema'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DATABASE_SCHEMA}`,
            icon: SchemaIcon,
          },
          {
            label: t('label.metric'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.metric'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.METRICS}`,
            icon: MetricIcon,
          },
          {
            label: t('label.table-plural'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.table-plural'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.TABLES}`,
            icon: TableIcon,
          },
          {
            label: t('label.stored-procedure-plural'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.stored-procedure-plural'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.STORED_PROCEDURES}`,
            icon: StoredProcedureIcon,
          },
          {
            label: t('label.dashboard-plural'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.dashboard-plural'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DASHBOARDS}`,
            icon: DashboardIcon,
          },
          {
            label: t('label.pipeline-plural'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.pipeline-plural'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.PIPELINES}`,
            icon: PipelineIcon,
          },
          {
            label: t('label.topic-plural'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.topic-plural'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.TOPICS}`,
            icon: MessagingIcon,
          },
          {
            label: t('label.container-plural'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.container-plural'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.CONTAINERS}`,
            icon: StorageIcon,
          },
          {
            label: t('label.ml-model-plural'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.ml-model-plural'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.MLMODELS}`,
            icon: MlModelIcon,
          },
          {
            label: t('label.search-index-plural'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.search-index-plural'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.SEARCH_INDEXES}`,
            icon: SearchIndexIcon,
          },
          {
            label: t('label.glossary-term'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.glossary-term'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.GLOSSARY_TERM}`,
            icon: GlossaryIcon,
          },
          {
            label: t('label.domain'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.domain'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.DOMAINS}`,
            icon: DomainIcon,
          },
          {
            label: t('label.chart-plural'),
            description: t('message.define-custom-property-for-entity', {
              entity: t('label.chart-plural'),
            }),
            isProtected: Boolean(isAdminUser),
            key: `${GlobalSettingsMenuCategory.CUSTOM_PROPERTIES}.${GlobalSettingOptions.CHARTS}`,
            icon: ChartIcon,
          },
        ].sort((a, b) => a.label.localeCompare(b.label)),
      },
      {
        category: t('label.bot-plural'),
        description: t('message.page-sub-header-for-bots'),
        isProtected: Boolean(isAdminUser),
        key: GlobalSettingOptions.BOTS,
        icon: BotIcon,
      },
      {
        category: t('label.persona-plural'),
        description: t('message.page-sub-header-for-persona'),
        isProtected: Boolean(isAdminUser),
        key: GlobalSettingOptions.PERSONA,
        icon: PersonasIcon,
      },
    ];
  }
}

const globalSettingsClassBase = new GlobalSettingsClassBase();

export default globalSettingsClassBase;

export { GlobalSettingsClassBase };
