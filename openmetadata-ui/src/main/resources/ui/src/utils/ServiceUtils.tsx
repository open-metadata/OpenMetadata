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

export {
  getActiveFieldNameForAppDocs,
  getAddServiceEntityBreadcrumb,
  getCountLabel,
  getEntityTypeFromServiceCategory,
  getIngestionName,
  getReadableCountString,
  getResourceEntityFromServiceCategory,
  getSearchIndexForService,
  getServiceCategoryFromEntityType,
  getServiceDisplayNameQueryFilter,
  getServiceNameQueryFilter,
  getServiceRouteFromServiceType,
  getServiceType,
  getServiceTypesFromServiceCategory,
  getTestConnectionName,
  shouldTestConnection,
} from './ServicePureUtils';

import { ServiceTypes } from 'Models';
import {
  ADMONITION_BLOCK_REGEX,
  MARKDOWN_MATCH_ID,
  SECTION_BLOCK_REGEX,
} from '../constants/regex.constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { ServiceCategory } from '../enums/service.enum';
import { DashboardService } from '../generated/entity/services/dashboardService';
import { MessagingService } from '../generated/entity/services/messagingService';
import { MlmodelService } from '../generated/entity/services/mlmodelService';
import { PipelineService } from '../generated/entity/services/pipelineService';
import { DatabaseServiceSearchSource } from '../interface/search.interface';
import { ServicesType } from '../interface/service.interface';
import { searchService } from '../rest/serviceAPI';
import { getDashboardURL } from './DashboardServiceUtils';
import entityUtilClassBase from './EntityUtilClassBase';
import { MarkdownToHTMLConverter } from './FeedUtils';
import { t } from './i18next/LocalUtil';
import { getBrokers } from './MessagingServiceUtils';

export const getSearchIndexFromService = (serviceName: string): SearchIndex => {
  const mapping: Partial<Record<string, SearchIndex>> = {
    [ServiceCategory.DATABASE_SERVICES]: SearchIndex.DATABASE_SERVICE,
    [ServiceCategory.DASHBOARD_SERVICES]: SearchIndex.DASHBOARD_SERVICE,
    [ServiceCategory.MESSAGING_SERVICES]: SearchIndex.MESSAGING_SERVICE,
    [ServiceCategory.PIPELINE_SERVICES]: SearchIndex.PIPELINE_SERVICE,
    [ServiceCategory.ML_MODEL_SERVICES]: SearchIndex.ML_MODEL_SERVICE,
    [ServiceCategory.STORAGE_SERVICES]: SearchIndex.STORAGE_SERVICE,
    [ServiceCategory.SEARCH_SERVICES]: SearchIndex.SEARCH_SERVICE,
    [ServiceCategory.API_SERVICES]: SearchIndex.API_SERVICE,
    [ServiceCategory.DRIVE_SERVICES]: SearchIndex.DRIVE_SERVICE,
    [ServiceCategory.METADATA_SERVICES]: SearchIndex.METADATA_SERVICE,
  };

  return mapping[serviceName] ?? SearchIndex.DATABASE_SERVICE;
};

export const getLinkForFqn = (serviceCategory: ServiceTypes, fqn: string) => {
  switch (serviceCategory) {
    case ServiceCategory.MESSAGING_SERVICES:
      return entityUtilClassBase.getEntityLink(SearchIndex.TOPIC, fqn);

    case ServiceCategory.DASHBOARD_SERVICES:
      return entityUtilClassBase.getEntityLink(SearchIndex.DASHBOARD, fqn);

    case ServiceCategory.PIPELINE_SERVICES:
      return entityUtilClassBase.getEntityLink(SearchIndex.PIPELINE, fqn);

    case ServiceCategory.ML_MODEL_SERVICES:
      return entityUtilClassBase.getEntityLink(SearchIndex.MLMODEL, fqn);

    case ServiceCategory.STORAGE_SERVICES:
      return entityUtilClassBase.getEntityLink(EntityType.CONTAINER, fqn);

    case ServiceCategory.SEARCH_SERVICES:
      return entityUtilClassBase.getEntityLink(EntityType.SEARCH_INDEX, fqn);

    case ServiceCategory.API_SERVICES:
      return entityUtilClassBase.getEntityLink(EntityType.API_COLLECTION, fqn);

    case ServiceCategory.DRIVE_SERVICES:
      return entityUtilClassBase.getEntityLink(EntityType.DIRECTORY, fqn);

    case ServiceCategory.DATABASE_SERVICES:
    default:
      return entityUtilClassBase.getEntityLink(EntityType.DATABASE, fqn);
  }
};

export const searchServiceByExactName = async (
  name: string,
  serviceName: string
) => {
  try {
    const {
      hits: { hits },
    } = await searchService({
      search: name,
      searchIndex: getSearchIndexFromService(serviceName),
    });

    const services = hits.map(
      ({ _source }) => _source as DatabaseServiceSearchSource
    );

    return services;
  } catch {
    return [];
  }
};

export const validateServiceName = async (
  name: string,
  serviceName: string
): Promise<string | null> => {
  if (!name || !serviceName) {
    return null;
  }
  const searchedServices = await searchServiceByExactName(name, serviceName);

  const isServiceNamePresent = searchedServices.some(
    (service) => service.name === name
  );

  if (isServiceNamePresent) {
    return t('message.entity-already-exists', {
      entity: t('label.name'),
    });
  }

  return null;
};

const convertAdmonitionsToHtml = (markdown: string): string => {
  ADMONITION_BLOCK_REGEX.lastIndex = 0;

  return markdown.replace(
    ADMONITION_BLOCK_REGEX,
    (_match, type: string, content: string) =>
      `<div data-admonition="${type}">${MarkdownToHTMLConverter.makeHtml(
        content.trim()
      )}</div>`
  );
};

/**
 * Converts markdown with $$section and $$note/warning/etc. admonition blocks into
 * sanitizable HTML. Used by both ServiceDocPanel and SSODocPanel.
 */
export const processDocMarkdown = (markdown: string): string => {
  const withAdmonitions = convertAdmonitionsToHtml(markdown);

  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  SECTION_BLOCK_REGEX.lastIndex = 0;

  while ((match = SECTION_BLOCK_REGEX.exec(withAdmonitions)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        MarkdownToHTMLConverter.makeHtml(
          withAdmonitions.slice(lastIndex, match.index)
        )
      );
    }

    const sectionContent = match[1];
    const idMatch = MARKDOWN_MATCH_ID.exec(sectionContent);
    const id = idMatch ? idMatch[1] : '';
    const cleanContent = sectionContent.replace(MARKDOWN_MATCH_ID, '').trim();

    parts.push(
      `<section data-id="${id}" data-highlighted="false">${MarkdownToHTMLConverter.makeHtml(
        cleanContent
      )}</section>`
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < withAdmonitions.length) {
    parts.push(
      MarkdownToHTMLConverter.makeHtml(withAdmonitions.slice(lastIndex))
    );
  }

  return parts.join('\n');
};

export const getOptionalFields = (
  service: ServicesType,
  serviceName: ServiceCategory
): JSX.Element => {
  switch (serviceName) {
    case ServiceCategory.MESSAGING_SERVICES: {
      const messagingService = service as MessagingService;

      return (
        <div className="m-b-xss truncate" data-testid="additional-field">
          <label className="m-b-0">{t('label.broker-plural') + ':'}</label>
          <span
            className="m-l-xss font-normal text-grey-body"
            data-testid="brokers">
            {getBrokers(messagingService.connection?.config)}
          </span>
        </div>
      );
    }
    case ServiceCategory.DASHBOARD_SERVICES: {
      const dashboardService = service as DashboardService;

      return (
        <div className="m-b-xss truncate" data-testid="additional-field">
          <label className="m-b-0">{t('label.url-uppercase') + ':'}</label>
          <span
            className="m-l-xss font-normal text-grey-body"
            data-testid="dashboard-url">
            {getDashboardURL(dashboardService.connection?.config)}
          </span>
        </div>
      );
    }
    case ServiceCategory.PIPELINE_SERVICES: {
      const pipelineService = service as PipelineService;

      return (
        <div className="m-b-xss truncate" data-testid="additional-field">
          <label className="m-b-0">{t('label.url-uppercase') + ':'}</label>
          <span
            className="m-l-xss font-normal text-grey-body"
            data-testid="pipeline-url">
            {pipelineService.connection?.config?.hostPort || '--'}
          </span>
        </div>
      );
    }

    case ServiceCategory.ML_MODEL_SERVICES: {
      const mlmodel = service as MlmodelService;

      return (
        <>
          <div className="m-b-xss truncate" data-testid="additional-field">
            <label className="m-b-0">{t('label.registry')}:</label>
            <span
              className="m-l-xss font-normal text-grey-body"
              data-testid="pipeline-url">
              {mlmodel.connection?.config?.registryUri || '--'}
            </span>
          </div>
          <div className="m-b-xss truncate" data-testid="additional-field">
            <label className="m-b-0">{t('label.tracking')}:</label>
            <span
              className="m-l-xss font-normal text-grey-body"
              data-testid="pipeline-url">
              {mlmodel.connection?.config?.trackingUri || '--'}
            </span>
          </div>
        </>
      );
    }
    default: {
      return <></>;
    }
  }
};
