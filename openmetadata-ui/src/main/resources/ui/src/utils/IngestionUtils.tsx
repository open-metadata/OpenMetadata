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

import { getServiceDetailsPath } from 'constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from 'constants/GlobalSettings.constants';
import { PipelineType } from 'generated/api/services/ingestionPipelines/createIngestionPipeline';
import { t } from 'i18next';
import { DataObj } from 'interface/service.interface';
import { isUndefined, startCase } from 'lodash';
import { ServiceTypes } from 'Models';
import React from 'react';
import { Connection } from '../generated/entity/services/databaseService';
import { IngestionPipeline } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Connection as MetadataConnection } from '../generated/entity/services/metadataService';
import { ServicesType } from '../interface/service.interface';

import { Typography } from 'antd';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import { WORKFLOWS_METADATA_DOCS } from 'constants/docs.constants';
import { OPEN_METADATA } from 'constants/Services.constant';
import {
  INGESTION_ACTION_TYPE,
  PIPELINE_TYPE_LOCALIZATION,
} from '../constants/Ingestions.constant';
import { getSettingPath } from './RouterUtils';
import {
  getServiceRouteFromServiceType,
  serviceTypeLogo,
} from './ServiceUtils';

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
    ? t('label.add-workflow-ingestion', {
        workflow: ingestionName,
      })
    : t('label.edit-workflow-ingestion', {
        workflow: ingestionName,
      });
};

export const getSettingsPathFromPipelineType = (pipelineType: string) => {
  switch (pipelineType) {
    case PipelineType.DataInsight: {
      return getSettingPath(
        GlobalSettingsMenuCategory.OPEN_METADATA,
        GlobalSettingOptions.DATA_INSIGHT
      );
    }
    case PipelineType.ElasticSearchReindex:
    default: {
      return getSettingPath(
        GlobalSettingsMenuCategory.OPEN_METADATA,
        GlobalSettingOptions.SEARCH
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
          url: getServiceDetailsPath(serviceFQN, serviceCategory, 'ingestions'),
          imgSrc: serviceTypeLogo(serviceData?.serviceType || ''),
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
  let pipelineType = [];
  const config = serviceDetails?.connection?.config as Connection;
  if (config) {
    config.supportsMetadataExtraction &&
      pipelineType.push(PipelineType.Metadata);
    config.supportsUsageExtraction && pipelineType.push(PipelineType.Usage);
    config.supportsUsageExtraction && pipelineType.push(PipelineType.Lineage);
    config.supportsProfiler && pipelineType.push(PipelineType.Profiler);
    config.supportsDBTExtraction && pipelineType.push(PipelineType.Dbt);
    (config as MetadataConnection).supportsDataInsightExtraction &&
      pipelineType.push(PipelineType.DataInsight);
    (config as MetadataConnection).supportsElasticSearchReindexingExtraction &&
      pipelineType.push(PipelineType.ElasticSearchReindex);
  } else {
    pipelineType = [
      PipelineType.Metadata,
      PipelineType.Usage,
      PipelineType.Lineage,
      PipelineType.Profiler,
      PipelineType.Dbt,
    ];
  }

  return pipelineType;
};

export const getIngestionTypes = (
  supportedPipelineTypes: PipelineType[],
  isOpenMetadataService: boolean,
  ingestionList: IngestionPipeline[],
  pipelineType?: PipelineType
) => {
  const pipelineTypeArray = isUndefined(pipelineType)
    ? supportedPipelineTypes
    : [pipelineType];

  if (isOpenMetadataService || ingestionList.length > 0) {
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
  }

  return [
    PipelineType.Metadata,
    PipelineType.Usage,
    PipelineType.Lineage,
    PipelineType.Profiler,
    PipelineType.Dbt,
  ];
};

export const getErrorPlaceHolder = (
  isRequiredDetailsAvailable: boolean,
  ingestionDataLength: number,
  serviceName?: string
) => {
  if (isRequiredDetailsAvailable && ingestionDataLength === 0) {
    return (
      <ErrorPlaceHolder>
        <Typography.Text>{t('message.no-ingestion-available')}</Typography.Text>
        {serviceName !== OPEN_METADATA && (
          <>
            <Typography.Text>
              {t('message.no-ingestion-description')}
            </Typography.Text>
            <Typography.Link href={WORKFLOWS_METADATA_DOCS} target="_blank">
              {t('label.metadata-ingestion')}
            </Typography.Link>
          </>
        )}
      </ErrorPlaceHolder>
    );
  }

  return null;
};
