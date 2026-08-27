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

import { startCase } from 'lodash';
import type { ServiceTypes } from 'Models';
import {
  ADMONITION_BLOCK_REGEX,
  MARKDOWN_MATCH_ID,
  SECTION_BLOCK_REGEX,
} from '../constants/regex.constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { ServiceCategory } from '../enums/service.enum';
import type { DashboardService } from '../generated/entity/services/dashboardService';
import type { MessagingService } from '../generated/entity/services/messagingService';
import type { MlmodelService } from '../generated/entity/services/mlmodelService';
import type { PipelineService } from '../generated/entity/services/pipelineService';
import type { DatabaseServiceSearchSource } from '../interface/search.interface';
import type { ServicesType } from '../interface/service.interface';
import { searchService } from '../rest/serviceAPI';
import connectionsRouterClassBase from './ConnectionsRouterClassBase';
import { getDashboardURL } from './DashboardServiceUtils';
import entityUtilClassBase from './EntityUtilClassBase';
import { MarkdownToHTMLConverter } from './FeedUtilsPure';
import { t } from './i18next/LocalUtil';
import { getBrokers } from './MessagingServiceUtils';
import { getSearchIndexFromService } from './ServicePureUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';

export const getOptionalFields = (
  service: ServicesType,
  serviceName: ServiceCategory
): JSX.Element => {
  switch (serviceName) {
    case ServiceCategory.MESSAGING_SERVICES: {
      const messagingService = service as MessagingService;

      return (
        <div className="m-b-xss truncate" data-testid="additional-field">
          <span className="m-b-0">{t('label.broker-plural') + ':'}</span>
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
          <span className="m-b-0">{t('label.url-uppercase') + ':'}</span>
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
          <span className="m-b-0">{t('label.url-uppercase') + ':'}</span>
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
            <span className="m-b-0">{t('label.registry')}:</span>
            <span
              className="m-l-xss font-normal text-grey-body"
              data-testid="pipeline-url">
              {mlmodel.connection?.config?.registryUri || '--'}
            </span>
          </div>
          <div className="m-b-xss truncate" data-testid="additional-field">
            <span className="m-b-0">{t('label.tracking')}:</span>
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

/**
 * Only honour a deep-linked serviceType (router `state.serviceType`) that is actually a supported
 * connector for the given category; otherwise return '' so the wizard shows the connector grid
 * rather than landing on the Connect step with an unknown/empty connector.
 *
 * Shared by both add-service pages: the onboarding connector picker deep-links this way, and so
 * does picking a card in the flattened "all services" grid, which navigates to that connector's
 * own category with the type in router state.
 */
export const getValidatedServiceType = (
  state: unknown,
  serviceCategory: string
): string => {
  const requested = (state as { serviceType?: string } | null)?.serviceType;
  if (!requested) {
    return '';
  }
  const supported = (
    serviceUtilClassBase.getSupportedServiceFromList() as Record<
      string,
      string[]
    >
  )[serviceCategory];

  return (supported ?? []).includes(requested) ? requested : '';
};

export const getAddServiceEntityBreadcrumb = (
  serviceCategory: ServiceCategory
) => {
  return [
    {
      label: startCase(serviceCategory),
      // Delegated so an embedded experience that owns the service listing can redirect this
      // crumb; the base implementation returns the same settings path.
      href: connectionsRouterClassBase.getSettingsServicesPath(serviceCategory),
      id: 'category',
    },
    {
      label: t('label.add-new-entity', {
        entity: t('label.service'),
      }),
      href: '',
      id: 'add-service',
    },
  ];
};

// Perform an exact search for services by name within a given service category
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

// Validate if a service name already exists in the given category
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
