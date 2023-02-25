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

import { isUndefined, startCase } from 'lodash';
import { IngestionPipeline } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getLogEntityPath } from './RouterUtils';

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
export const getLogBreadCrumbs = (
  serviceType: string,
  ingestionName: string,
  ingestionDetails: IngestionPipeline | undefined
) => {
  if (isUndefined(ingestionDetails)) {
    return [];
  }

  const urlPath = [serviceType, ...ingestionName.split('.')];

  return urlPath.map((path, index) => {
    return {
      name: index === 0 ? startCase(path) : path,
      url:
        index !== urlPath.length - 1 ? getLogEntityPath(path, serviceType) : '',
    };
  });
};
