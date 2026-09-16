/*
 *  Copyright 2023 Collate.
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
import { Box } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { Operation } from 'fast-json-patch';
import { HTMLAttributes } from 'react';
import { MapPatchAPIResponse } from '../../components/DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { AssetsOfEntity } from '../../components/Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { ENTITY_ICON_MAPPER } from '../../constants/Assets.constants';
import { EntityType } from '../../enums/entity.enum';
import { Directory } from '../../generated/entity/data/directory';
import { File } from '../../generated/entity/data/file';
import { Spreadsheet } from '../../generated/entity/data/spreadsheet';
import { Worksheet } from '../../generated/entity/data/worksheet';
import { ListParams } from '../../interface/API.interface';
import {
  getApiCollectionByFQN,
  patchApiCollection,
} from '../../rest/apiCollectionsAPI';
import {
  getApiEndPointByFQN,
  patchApiEndPoint,
} from '../../rest/apiEndpointsAPI';
import { getChartByFqn, patchChartDetails } from '../../rest/chartsAPI';
import {
  getDashboardByFqn,
  patchDashboardDetails,
} from '../../rest/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
  patchDatabaseDetails,
  patchDatabaseSchemaDetails,
} from '../../rest/databaseAPI';
import {
  getDataModelByFqn,
  patchDataModelDetails,
} from '../../rest/dataModelsAPI';
import { getDomainByName, patchDomains } from '../../rest/domainAPI';
import {
  getDriveAssetByFqn,
  patchDriveAssetDetails,
} from '../../rest/driveAPI';
import {
  getGlossariesByName,
  getGlossaryTermByFQN,
  patchGlossaries,
  patchGlossaryTerm,
} from '../../rest/glossaryAPI';
import {
  getKnowledgePageByFqn,
  patchKnowledgePage,
} from '../../rest/knowledgeCenterAPI';
import { getMetricByFqn, patchMetric } from '../../rest/metricsAPI';
import { getMlModelByFQN, patchMlModelDetails } from '../../rest/mlModelAPI';
import { getPipelineByFqn, patchPipelineDetails } from '../../rest/pipelineAPI';
import {
  getSearchIndexDetailsByFQN,
  patchSearchIndexDetails,
} from '../../rest/SearchIndexAPI';
import {
  getDomainSupportedServiceByFQN,
  patchDomainSupportedService,
} from '../../rest/serviceAPI';
import {
  getContainerByName,
  patchContainerDetails,
} from '../../rest/storageAPI';
import {
  getStoredProceduresByFqn,
  patchStoredProceduresDetails,
} from '../../rest/storedProceduresAPI';
import { getTableDetailsByFQN, patchTableDetails } from '../../rest/tableAPI';
import {
  getClassificationByName,
  getTagByFqn,
  patchClassification,
  patchTag,
} from '../../rest/tagAPI';
import { getTeamByName, patchTeamDetail } from '../../rest/teamsAPI';
import { getTopicByFqn, patchTopicDetails } from '../../rest/topicsAPI';
import { getUserByName, updateUserDetail } from '../../rest/userAPI';
import { getServiceCategoryFromEntityType } from '../../utils/ServicePureUtils';
import { t } from '../i18next/LocalUtil';
import { getTermQuery } from '../SearchPureUtils';

type PatchAPIFn = (
  id: string,
  jsonPatch: Operation[]
) => Promise<MapPatchAPIResponse[keyof MapPatchAPIResponse]>;

type GetEntityAPIFn = (
  fqn: string,
  params?: ListParams
) => Promise<MapPatchAPIResponse[keyof MapPatchAPIResponse]>;

const SERVICE_ENTITY_TYPES: (keyof MapPatchAPIResponse)[] = [
  EntityType.MESSAGING_SERVICE,
  EntityType.DASHBOARD_SERVICE,
  EntityType.PIPELINE_SERVICE,
  EntityType.MLMODEL_SERVICE,
  EntityType.STORAGE_SERVICE,
  EntityType.DATABASE_SERVICE,
  EntityType.SEARCH_SERVICE,
  EntityType.API_SERVICE,
  EntityType.SECURITY_SERVICE,
  EntityType.DRIVE_SERVICE,
];

const PATCH_API_MAP: Partial<Record<keyof MapPatchAPIResponse, PatchAPIFn>> = {
  [EntityType.TABLE]: patchTableDetails,
  [EntityType.DASHBOARD]: patchDashboardDetails,
  [EntityType.CHART]: patchChartDetails,
  [EntityType.MLMODEL]: patchMlModelDetails,
  [EntityType.PIPELINE]: patchPipelineDetails,
  [EntityType.TOPIC]: patchTopicDetails,
  [EntityType.CONTAINER]: patchContainerDetails,
  [EntityType.SEARCH_INDEX]: patchSearchIndexDetails,
  [EntityType.STORED_PROCEDURE]: patchStoredProceduresDetails,
  [EntityType.DASHBOARD_DATA_MODEL]: patchDataModelDetails,
  [EntityType.GLOSSARY_TERM]: patchGlossaryTerm,
  [EntityType.GLOSSARY]: patchGlossaries,
  [EntityType.TAG]: patchTag,
  [EntityType.CLASSIFICATION]: patchClassification,
  [EntityType.DATABASE_SCHEMA]: patchDatabaseSchemaDetails,
  [EntityType.DATABASE]: patchDatabaseDetails,
  [EntityType.TEAM]: patchTeamDetail,
  [EntityType.USER]: updateUserDetail,
  [EntityType.API_COLLECTION]: patchApiCollection,
  [EntityType.API_ENDPOINT]: patchApiEndPoint,
  [EntityType.METRIC]: patchMetric,
  [EntityType.DOMAIN]: patchDomains,
  [EntityType.DIRECTORY]: (id: string, data: Operation[]) =>
    patchDriveAssetDetails<Directory>(id, data, EntityType.DIRECTORY),
  [EntityType.FILE]: (id: string, data: Operation[]) =>
    patchDriveAssetDetails<File>(id, data, EntityType.FILE),
  [EntityType.SPREADSHEET]: (id: string, data: Operation[]) =>
    patchDriveAssetDetails<Spreadsheet>(id, data, EntityType.SPREADSHEET),
  [EntityType.WORKSHEET]: (id: string, data: Operation[]) =>
    patchDriveAssetDetails<Worksheet>(id, data, EntityType.WORKSHEET),
  [EntityType.KNOWLEDGE_PAGE]: patchKnowledgePage,
};

const GET_ENTITY_API_MAP: Partial<
  Record<keyof MapPatchAPIResponse, GetEntityAPIFn>
> = {
  [EntityType.TABLE]: getTableDetailsByFQN,
  [EntityType.DASHBOARD]: getDashboardByFqn,
  [EntityType.CHART]: getChartByFqn,
  [EntityType.MLMODEL]: getMlModelByFQN,
  [EntityType.PIPELINE]: getPipelineByFqn,
  [EntityType.TOPIC]: getTopicByFqn,
  [EntityType.CONTAINER]: getContainerByName,
  [EntityType.STORED_PROCEDURE]: getStoredProceduresByFqn,
  [EntityType.DASHBOARD_DATA_MODEL]: getDataModelByFqn,
  [EntityType.GLOSSARY_TERM]: getGlossaryTermByFQN,
  [EntityType.GLOSSARY]: getGlossariesByName,
  [EntityType.CLASSIFICATION]: getClassificationByName,
  [EntityType.TAG]: getTagByFqn,
  [EntityType.DATABASE_SCHEMA]: getDatabaseSchemaDetailsByFQN,
  [EntityType.DATABASE]: getDatabaseDetailsByFQN,
  [EntityType.SEARCH_INDEX]: getSearchIndexDetailsByFQN,
  [EntityType.TEAM]: getTeamByName,
  [EntityType.USER]: getUserByName,
  [EntityType.API_COLLECTION]: getApiCollectionByFQN,
  [EntityType.API_ENDPOINT]: getApiEndPointByFQN,
  [EntityType.METRIC]: getMetricByFqn,
  [EntityType.DOMAIN]: getDomainByName,
  [EntityType.DIRECTORY]: (fqn: string, params?: ListParams) =>
    getDriveAssetByFqn<Directory>(
      fqn,
      EntityType.DIRECTORY,
      params?.fields,
      params?.include
    ),
  [EntityType.FILE]: (fqn: string, params?: ListParams) =>
    getDriveAssetByFqn<File>(
      fqn,
      EntityType.FILE,
      params?.fields,
      params?.include
    ),
  [EntityType.SPREADSHEET]: (fqn: string, params?: ListParams) =>
    getDriveAssetByFqn<Spreadsheet>(
      fqn,
      EntityType.SPREADSHEET,
      params?.fields,
      params?.include
    ),
  [EntityType.WORKSHEET]: (fqn: string, params?: ListParams) =>
    getDriveAssetByFqn<Worksheet>(
      fqn,
      EntityType.WORKSHEET,
      params?.fields,
      params?.include
    ),
  [EntityType.KNOWLEDGE_PAGE]: getKnowledgePageByFqn,
};

const getServicePatchAPI = (
  source: keyof MapPatchAPIResponse
): PatchAPIFn | undefined => {
  if (!SERVICE_ENTITY_TYPES.includes(source)) {
    return undefined;
  }

  return (id, queryFields) => {
    const serviceCat = getServiceCategoryFromEntityType(source);

    return patchDomainSupportedService(serviceCat, id, queryFields);
  };
};

const getServiceEntityAPI = (
  source: keyof MapPatchAPIResponse
): GetEntityAPIFn | undefined => {
  if (!SERVICE_ENTITY_TYPES.includes(source)) {
    return undefined;
  }

  return (id, queryFields) => {
    const serviceCat = getServiceCategoryFromEntityType(source);

    return getDomainSupportedServiceByFQN(serviceCat, id, queryFields);
  };
};

export const getAPIfromSource = (
  source: keyof MapPatchAPIResponse
): ((
  id: string,
  jsonPatch: Operation[]
) => Promise<MapPatchAPIResponse[typeof source]>) => {
  return (PATCH_API_MAP[source] ?? getServicePatchAPI(source)) as PatchAPIFn;
};

export const getEntityAPIfromSource = (
  source: keyof MapPatchAPIResponse
): ((
  fqn: string,
  params?: ListParams
) => Promise<MapPatchAPIResponse[typeof source]>) => {
  return (GET_ENTITY_API_MAP[source] ??
    getServiceEntityAPI(source)) as GetEntityAPIFn;
};

export const getAssetsFields = (source: AssetsOfEntity) => {
  if (source === AssetsOfEntity.GLOSSARY) {
    return 'tags';
  } else if (source === AssetsOfEntity.DOMAIN) {
    return 'domain';
  } else {
    return 'dataProducts';
  }
};

export function getEntityTypeString(type: string) {
  switch (type) {
    case AssetsOfEntity.GLOSSARY:
      return t('label.glossary-term-lowercase');
    case AssetsOfEntity.DOMAIN:
      return t('label.domain-lowercase');
    case AssetsOfEntity.TAG:
      return t('label.tag-lowercase');
    case AssetsOfEntity.TEAM:
      return t('label.team-lowercase');
    default:
      return t('label.data-product-lowercase');
  }
}

/**
 * Creates a query filter to search for entities by their fully qualified names.
 * Uses a 'should' query with minimum_should_match: 1 to match any of the provided FQNs.
 *
 * @param fqns - Array of fully qualified names to filter by
 * @returns Query filter object or undefined if no FQNs provided
 */
export const getEntityFqnQueryFilter = (fqns: string[]) => {
  if (fqns.length === 0) {
    return undefined;
  }

  return getTermQuery({ fullyQualifiedName: fqns }, 'should', 1);
};

export interface EntityIconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

export const getEntityIconWithBg = (
  entityType?: string,
  containerProps?: HTMLAttributes<HTMLSpanElement>,
  iconProps?: EntityIconProps,
  mapper: typeof ENTITY_ICON_MAPPER = ENTITY_ICON_MAPPER
) => {
  const style = mapper[entityType ?? ''] ?? mapper['default'];
  const Icon = style?.icon;
  const { className: containerClassName, ...restContainerProps } =
    containerProps ?? {};
  const {
    className: iconClassName,
    size = 14,
    strokeWidth = 1.2,
  } = iconProps ?? {};

  return (
    <Box
      inline
      align="center"
      justify="center"
      {...restContainerProps}
      className={classNames(
        containerClassName || 'tw:h-7 tw:w-7 tw:rounded-md',
        'tw:shrink-0 tw:opacity-90',
        style?.bgClass ?? 'tw:bg-tertiary'
      )}>
      {Icon && (
        <Icon
          className={classNames(
            style?.iconClass ?? 'tw:text-gray-500',
            iconClassName
          )}
          height={size}
          strokeWidth={strokeWidth}
          width={size}
        />
      )}
    </Box>
  );
};
