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

import { isUndefined, startCase } from 'lodash';
import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import { OPEN_METADATA } from '../constants/service-guide.constant';
import { Pipeline } from '../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { IngestionPipeline } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { DataQualityPageTabs } from '../pages/DataQuality/DataQualityPage.interface';
import { getNameFromFQN } from './CommonUtils';
import Fqn from './Fqn';
import i18n from './i18next/LocalUtil';
import { getSettingsPathFromPipelineType } from './IngestionUtils';
import {
  getApplicationDetailsPath,
  getDataQualityPagePath,
  getLogEntityPath,
  getSettingPath,
} from './RouterUtils';
import { getTestSuiteDetailsPath } from './TestSuiteUtils';

class LogsClassBase {
  /**
   * It takes in a service type, an ingestion name, and an ingestion details object, and returns an array
   * of breadcrumbs
   * @param {string} serviceType - The type of service, e.g. "logs" or "metrics"
   * @param {string} ingestionName - The name of the ingestion pipeline.
   * @param {IngestionPipeline | undefined} ingestionDetails - IngestionPipeline | undefined
   * @returns An array of objects with the following properties:
   *   name: string
   *   url: string
   */
  public getLogBreadCrumbs(
    serviceType: string,
    ingestionName: string,
    ingestionDetails: IngestionPipeline | undefined
  ) {
    const updateIngestionName = Fqn.split(ingestionName);
    if (updateIngestionName.includes(OPEN_METADATA) && ingestionDetails) {
      return [
        {
          name: startCase(ingestionDetails.pipelineType),
          url: getSettingsPathFromPipelineType(ingestionDetails.pipelineType),
          activeTitle: true,
        },
        {
          name: getNameFromFQN(ingestionName),
          url: '',
          activeTitle: true,
        },
      ];
    }

    if (serviceType === GlobalSettingOptions.APPLICATIONS) {
      return [
        {
          name: startCase(serviceType),
          url: getSettingPath(GlobalSettingOptions.APPLICATIONS),
        },
        {
          name: ingestionName,
          url: getApplicationDetailsPath(ingestionName),
        },
      ];
    }

    if (isUndefined(ingestionDetails)) {
      return [];
    }

    if (serviceType === 'testSuite') {
      const isExecutableTestSuite = !isUndefined(
        (ingestionDetails.sourceConfig.config as Pipeline)
          ?.entityFullyQualifiedName
      );

      return [
        {
          name: startCase(serviceType),
          url: getDataQualityPagePath(DataQualityPageTabs.TEST_SUITES),
        },
        {
          name: ingestionDetails.name,
          url: getTestSuiteDetailsPath({
            isExecutableTestSuite,
            fullyQualifiedName:
              (isExecutableTestSuite
                ? (ingestionDetails.sourceConfig.config as Pipeline)
                    ?.entityFullyQualifiedName
                : ingestionDetails.service?.fullyQualifiedName) ?? '',
          }),
        },
        {
          name: i18n.t('label.log-plural'),
          url: '',
        },
      ];
    }

    const urlPath = [serviceType, ...updateIngestionName];

    return urlPath.map((path, index) => {
      return {
        name: index === 0 ? startCase(path) : path,
        url:
          index !== urlPath.length - 1
            ? getLogEntityPath(path, serviceType)
            : '',
      };
    });
  }
}

const logsClassBase = new LogsClassBase();

export default logsClassBase;
export { LogsClassBase };
