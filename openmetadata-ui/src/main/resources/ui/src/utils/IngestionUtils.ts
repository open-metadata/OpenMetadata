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
import { startCase } from 'lodash';
import { ServiceTypes } from 'Models';

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
