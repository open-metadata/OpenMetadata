/*
 *  Copyright 2025 Collate.
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

import { isEmpty, isUndefined, startCase, uniq } from 'lodash';
import type { ServicesUpdateRequest, ServiceTypes } from 'Models';
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
import { ELASTIC_SEARCH_RE_INDEX_PAGE_TABS } from '../enums/ElasticSearch.enum';
import { EntityTabs } from '../enums/entity.enum';
import { ServiceAgentSubTabs, ServiceCategory } from '../enums/service.enum';
import { ServiceConnectionFilterPatternFields } from '../enums/ServiceConnection.enum';
import { PipelineType } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import type { HiveMetastoreConnectionDetails as Connection } from '../generated/entity/services/databaseService';
import {
  PipelineState,
  type IngestionPipeline,
  type StepSummary,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import type { SearchSourceAlias } from '../interface/search.interface';
import type { DataObj, ServicesType } from '../interface/service.interface';
import { getDayCron } from './CronExpressionUtils';
import i18n from './i18next/LocalUtil';
import { getSchemaByWorkflowType } from './IngestionWorkflowUtils';
import {
  getServiceDetailsPath,
  getSettingPath,
  getSettingsPathWithFqn,
} from './RouterUtils';
import { getFilteredSchema } from './ServiceConnectionUtils';
import {
  getReadableCountString,
  getServiceRouteFromServiceType,
} from './ServicePureUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';

export const getIngestionHeadingName = (
  ingestionType: string,
  type: string
) => {
  const ingestionName = i18n.t(
    `label.${
      PIPELINE_TYPE_LOCALIZATION[
        ingestionType as keyof typeof PIPELINE_TYPE_LOCALIZATION
      ]
    }`
  );

  return type === INGESTION_ACTION_TYPE.ADD
    ? i18n.t('label.add-workflow-agent', {
        workflow: ingestionName,
      })
    : i18n.t('label.edit-workflow-agent', {
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

export const getSupportedPipelineTypes = (
  serviceDetails: ServicesType,
  serviceCategory?: ServiceCategory
) => {
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
      let types = pipelineMapping[key];

      if (
        key === 'supportsProfiler' &&
        serviceCategory === ServiceCategory.STORAGE_SERVICES
      ) {
        types = [PipelineType.AutoClassification];
      }

      pipelineType.push(...types);
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

export const getDefaultIngestionSchedule = ({
  isEditMode = false,
  scheduleInterval,
  defaultSchedule,
}: {
  isEditMode?: boolean;
  scheduleInterval?: string;
  defaultSchedule?: string;
}) => {
  if (isEditMode) {
    return scheduleInterval;
  }

  if (!isEmpty(scheduleInterval)) {
    return scheduleInterval;
  }

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
  if (isEditMode) {
    return getFilteredSchema(
      ingestionData?.sourceConfig.config as Record<string, unknown> | undefined,
      false
    );
  } else {
    const filterPropertiesInSchema = getDefaultFilterPropertyFieldsFromSchema(
      pipelineType,
      serviceCategory
    );

    const filterValues = getFilteredSchema(
      serviceData?.connection?.config,
      false
    );

    return Object.entries(filterValues).reduce((acc, [key, value]) => {
      if (filterPropertiesInSchema.includes(key)) {
        acc[key] = value;
      }

      return acc;
    }, {} as Record<string, unknown>);
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
    label: i18n.t('label.success'),
    value: getReadableCountString(summary?.records ?? 0, 1),
    type: 'success',
  },
  {
    label: i18n.t('label.failed'),
    value: getReadableCountString(summary?.errors ?? 0, 1),
    type: 'failed',
  },
  {
    label: i18n.t('label.warning'),
    value: getReadableCountString(summary?.warnings ?? 0, 1),
    type: 'warning',
  },
];
