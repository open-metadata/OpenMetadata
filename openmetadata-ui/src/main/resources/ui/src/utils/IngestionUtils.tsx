/*
 *  Copyright 2022 Collate.
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

import { Typography } from 'antd';
import { isEmpty, isUndefined, startCase, uniq } from 'lodash';
import { ServicesUpdateRequest, ServiceTypes } from 'Models';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import {
  DATA_INSIGHTS_PIPELINE_DOCS,
  ELASTIC_SEARCH_RE_INDEX_PIPELINE_DOCS,
  INGESTION_FRAMEWORK_DEPLOYMENT_DOCS,
  WORKFLOWS_METADATA_DOCS,
} from '../constants/docs.constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../constants/GlobalSettings.constants';
import {
  INGESTION_ACTION_TYPE,
  PIPELINE_TYPE_LOCALIZATION,
} from '../constants/Ingestions.constant';
import { SERVICE_FILTER_PATTERN_FIELDS } from '../constants/ServiceConnection.constants';
import { SERVICE_INGESTION_PIPELINE_TYPES } from '../constants/Services.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../enums/common.enum';
import { ELASTIC_SEARCH_RE_INDEX_PAGE_TABS } from '../enums/ElasticSearch.enum';
import { EntityTabs } from '../enums/entity.enum';
import { FormSubmitType } from '../enums/form.enum';
import { ServiceAgentSubTabs, ServiceCategory } from '../enums/service.enum';
import { ServiceConnectionFilterPatternFields } from '../enums/ServiceConnection.enum';
import { PipelineType } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { UIThemePreference } from '../generated/configuration/uiThemePreference';
import { HiveMetastoreConnectionDetails as Connection } from '../generated/entity/services/databaseService';
import {
  IngestionPipeline,
  PipelineState,
  StepSummary,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { SearchSourceAlias } from '../interface/search.interface';
import { DataObj, ServicesType } from '../interface/service.interface';
import { Transi18next } from './CommonUtils';
import i18n from './i18next/LocalUtil';
import { getSchemaByWorkflowType } from './IngestionWorkflowUtils';
import {
  getServiceDetailsPath,
  getSettingPath,
  getSettingsPathWithFqn,
} from './RouterUtils';
import { getDayCron } from './SchedularUtils';
import { getFilteredSchema } from './ServiceConnectionUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';
import {
  getReadableCountString,
  getServiceRouteFromServiceType,
} from './ServiceUtils';

const { t } = i18n;

export const getIngestionHeadingName = (
  ingestionType: string,
  type: string
) => {
  const ingestionName = t(
    `label.${
      PIPELINE_TYPE_LOCALIZATION[
        ingestionType as keyof typeof PIPELINE_TYPE_LOCALIZATION
      ]
    }`
  );

  return type === INGESTION_ACTION_TYPE.ADD
    ? t('label.add-workflow-agent', {
        workflow: ingestionName,
      })
    : t('label.edit-workflow-agent', {
        workflow: ingestionName,
      });
};

export const getSettingsPathFromPipelineType = (pipelineType: string) => {
  switch (pipelineType) {
    case PipelineType.DataInsight: {
      return getSettingPath(
        GlobalSettingsMenuCategory.PREFERENCES,
        GlobalSettingOptions.DATA_INSIGHT
      );
    }
    case PipelineType.ElasticSearchReindex:
    default: {
      return getSettingsPathWithFqn(
        GlobalSettingsMenuCategory.PREFERENCES,
        GlobalSettingOptions.SEARCH,
        ELASTIC_SEARCH_RE_INDEX_PAGE_TABS.SCHEDULE
      );
    }
  }
};

export const getBreadCrumbsArray = (
  isSettingsPipeline: boolean,
  ingestionType: string,
  serviceCategory: string,
  serviceFQN: string,
  type: string,
  serviceData?: DataObj
) => {
  const breadCrumbsArray = [];

  if (isSettingsPipeline) {
    breadCrumbsArray.push({
      name: startCase(ingestionType),
      url: getSettingsPathFromPipelineType(ingestionType),
      activeTitle: true,
    });
  } else {
    breadCrumbsArray.push(
      ...[
        {
          name: startCase(serviceCategory),
          url: getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(serviceCategory as ServiceTypes)
          ),
        },
        {
          name: serviceData?.name || '',
          url: getServiceDetailsPath(
            serviceFQN,
            serviceCategory,
            EntityTabs.AGENTS,
            ServiceAgentSubTabs.METADATA
          ),
          imgSrc: serviceUtilClassBase.getServiceTypeLogo(
            serviceData as SearchSourceAlias
          ),
          activeTitle: true,
        },
      ]
    );
  }

  breadCrumbsArray.push({
    name: getIngestionHeadingName(ingestionType, type),
    url: '',
    activeTitle: true,
  });

  return breadCrumbsArray;
};

export const getSupportedPipelineTypes = (serviceDetails: ServicesType) => {
  const pipelineType: PipelineType[] = [];
  const config = serviceDetails?.connection?.config as Connection;

  if (isUndefined(config)) {
    return [PipelineType.Metadata];
  }

  const pipelineMapping: { [key: string]: PipelineType[] } = {
    supportsMetadataExtraction: [PipelineType.Metadata],
    supportsUsageExtraction: [PipelineType.Usage],
    supportsLineageExtraction: [PipelineType.Lineage],
    supportsViewLineageExtraction: [PipelineType.Lineage],
    supportsProfiler: [PipelineType.Profiler, PipelineType.AutoClassification],
    supportsDBTExtraction: [PipelineType.Dbt],
    supportsDataInsightExtraction: [PipelineType.DataInsight],
    supportsElasticSearchReindexingExtraction: [
      PipelineType.ElasticSearchReindex,
    ],
  };

  Object.keys(pipelineMapping).forEach((key) => {
    if (config[key as keyof Connection]) {
      pipelineType.push(...pipelineMapping[key]);
    }
  });

  return uniq(pipelineType);
};

export const getIngestionTypes = (
  supportedPipelineTypes: PipelineType[],
  ingestionList: IngestionPipeline[],
  pipelineType?: PipelineType
) => {
  const pipelineTypeArray = isUndefined(pipelineType)
    ? supportedPipelineTypes
    : [pipelineType];

  return pipelineTypeArray.reduce((prev, curr) => {
    if (
      // Prevent adding multiple usage pipeline
      curr === PipelineType.Usage &&
      ingestionList.find((d) => d.pipelineType === curr)
    ) {
      return prev;
    } else {
      return [...prev, curr];
    }
  }, [] as PipelineType[]);
};

const getPipelineExtraInfo = (
  isPlatFormDisabled: boolean,
  theme: UIThemePreference['customTheme'],
  pipelineType?: PipelineType
) => {
  switch (pipelineType) {
    case PipelineType.DataInsight:
      return (
        <>
          <Typography.Paragraph className="w-max-500">
            <Transi18next
              i18nKey="message.data-insight-pipeline-description"
              renderElement={
                <a
                  href={DATA_INSIGHTS_PIPELINE_DOCS}
                  rel="noreferrer"
                  style={{ color: theme.primaryColor }}
                  target="_blank"
                />
              }
              values={{
                link: t('label.data-insight-ingestion'),
              }}
            />
          </Typography.Paragraph>
        </>
      );
    case PipelineType.ElasticSearchReindex:
      return (
        <>
          <Typography.Paragraph className="w-max-500">
            <Transi18next
              i18nKey="message.elastic-search-re-index-pipeline-description"
              renderElement={
                <a
                  href={ELASTIC_SEARCH_RE_INDEX_PIPELINE_DOCS}
                  rel="noreferrer"
                  style={{ color: theme.primaryColor }}
                  target="_blank"
                />
              }
              values={{
                link: t('label.search-index-ingestion'),
              }}
            />
          </Typography.Paragraph>
        </>
      );
    default:
      return (
        <Typography.Paragraph className="w-max-500">
          <Transi18next
            i18nKey={
              isPlatFormDisabled
                ? 'message.pipeline-disabled-ingestion-deployment'
                : 'message.no-ingestion-description'
            }
            renderElement={
              <a
                href={
                  isPlatFormDisabled
                    ? INGESTION_FRAMEWORK_DEPLOYMENT_DOCS
                    : WORKFLOWS_METADATA_DOCS
                }
                rel="noreferrer"
                style={{ color: theme.primaryColor }}
                target="_blank"
              />
            }
            values={{
              link: t(
                `label.${
                  isPlatFormDisabled
                    ? 'documentation-lowercase'
                    : 'metadata-ingestion'
                }`
              ),
            }}
          />
        </Typography.Paragraph>
      );
  }
};

export const getErrorPlaceHolder = (
  ingestionDataLength: number,
  isPlatFormDisabled: boolean,
  theme: UIThemePreference['customTheme'],
  pipelineType?: PipelineType
) => {
  if (ingestionDataLength === 0) {
    return (
      <ErrorPlaceHolder
        className="p-y-lg border-none"
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        {getPipelineExtraInfo(isPlatFormDisabled, theme, pipelineType)}
      </ErrorPlaceHolder>
    );
  }

  return null;
};

export const getMenuItems = (
  types: PipelineType[],
  isDataSightIngestionExists: boolean
) => {
  return types.map((type) => ({
    label: t('label.add-workflow-agent', {
      workflow: t(`label.${PIPELINE_TYPE_LOCALIZATION[type]}`),
    }),
    key: type,
    disabled:
      type === PipelineType.DataInsight ? isDataSightIngestionExists : false,
    ['data-testid']: `agent-item-${type}`,
  }));
};

export const getSuccessMessage = (
  ingestionName: string,
  status: FormSubmitType,
  showDeployButton?: boolean
) => {
  const updateMessage = showDeployButton
    ? t('message.action-has-been-done-but-failed-to-deploy', {
        action: t('label.updated-lowercase'),
      })
    : t('message.action-has-been-done-but-deploy-successfully', {
        action: t('label.updated-lowercase'),
      });
  const createMessage = showDeployButton
    ? t('message.action-has-been-done-but-failed-to-deploy', {
        action: t('label.created-lowercase'),
      })
    : t('message.action-has-been-done-but-deploy-successfully', {
        action: t('label.created-lowercase'),
      });

  return (
    <Typography.Text>
      <Typography.Text className="font-medium break-word">{`"${ingestionName}"`}</Typography.Text>
      <Typography.Text>
        {status === FormSubmitType.ADD ? createMessage : updateMessage}
      </Typography.Text>
    </Typography.Text>
  );
};

export const getDefaultIngestionSchedule = ({
  isEditMode = false,
  scheduleInterval,
  defaultSchedule,
}: {
  isEditMode?: boolean;
  scheduleInterval?: string;
  defaultSchedule?: string;
}) => {
  // If it is edit mode, then return the schedule interval from the ingestion data
  if (isEditMode) {
    return scheduleInterval;
  }

  // If it is not edit mode and schedule interval is not empty, then return the schedule interval
  if (!isEmpty(scheduleInterval)) {
    return scheduleInterval;
  }

  // If it is not edit mode, then return the default schedule
  return (
    defaultSchedule ??
    getDayCron({
      min: '0',
      hour: '0',
    })
  );
};

export const getDefaultFilterPropertyFieldsFromSchema = (
  pipelineType: PipelineType,
  serviceCategory: ServiceCategory
) => {
  const pipelineSchema = getSchemaByWorkflowType(pipelineType, serviceCategory);

  return Object.keys(pipelineSchema.properties ?? {}).filter((key) =>
    SERVICE_FILTER_PATTERN_FIELDS.includes(
      key as ServiceConnectionFilterPatternFields
    )
  );
};

export const getDefaultFilterPropertyValues = ({
  pipelineType,
  serviceCategory,
  isEditMode,
  ingestionData,
  serviceData,
}: {
  pipelineType: PipelineType;
  serviceCategory: ServiceCategory;
  isEditMode: boolean;
  ingestionData?: IngestionPipeline;
  serviceData?: ServicesUpdateRequest;
}) => {
  // If it is edit mode, then return the filter property values from the ingestion data
  if (isEditMode) {
    return getFilteredSchema(ingestionData?.sourceConfig.config, false);
  } else {
    // Get the default filter property fields from the schema
    const filterPropertiesInSchema = getDefaultFilterPropertyFieldsFromSchema(
      pipelineType,
      serviceCategory
    );

    // Get the default filter values from the service data
    const filterValues = getFilteredSchema(
      serviceData?.connection?.config,
      false
    );

    // Return the default filter property values from the service data only if
    // the property is present in the ingestion schema
    return Object.entries(filterValues).reduce((acc, [key, value]) => {
      if (filterPropertiesInSchema.includes(key)) {
        acc[key] = value;
      }

      return acc;
    }, {} as Record<string, any>);
  }
};

export const getTypeAndStatusMenuItems = () => {
  const typeMenuItems = SERVICE_INGESTION_PIPELINE_TYPES.map((type) => ({
    label: startCase(type),
    key: type,
    ['data-testid']: `type-menu-item-${type}`,
  }));
  const statusMenuItems = Object.values(PipelineState).map((status) => ({
    label: startCase(status),
    key: status,
    ['data-testid']: `status-menu-item-${status}`,
  }));

  return { typeMenuItems, statusMenuItems };
};

export const getIngestionStatusCountData = (summary?: StepSummary) => [
  {
    label: t('label.success'),
    value: getReadableCountString(summary?.records ?? 0, 1),
    type: 'success',
  },
  {
    label: t('label.failed'),
    value: getReadableCountString(summary?.errors ?? 0, 1),
    type: 'failed',
  },
  {
    label: t('label.warning'),
    value: getReadableCountString(summary?.warnings ?? 0, 1),
    type: 'warning',
  },
];
