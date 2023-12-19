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

import { Drawer, Typography } from 'antd';
import { get } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { ExplorePageTabs } from '../../../enums/Explore.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { Container } from '../../../generated/entity/data/container';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { DashboardDataModel } from '../../../generated/entity/data/dashboardDataModel';
import { Database } from '../../../generated/entity/data/database';
import { DatabaseSchema } from '../../../generated/entity/data/databaseSchema';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { SearchIndex } from '../../../generated/entity/data/searchIndex';
import { StoredProcedure } from '../../../generated/entity/data/storedProcedure';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { DashboardService } from '../../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../../generated/entity/services/databaseService';
import { MessagingService } from '../../../generated/entity/services/messagingService';
import { MlmodelService } from '../../../generated/entity/services/mlmodelService';
import { PipelineService } from '../../../generated/entity/services/pipelineService';
import { SearchService } from '../../../generated/entity/services/searchService';
import { StorageService } from '../../../generated/entity/services/storageService';
import { getEntityLinkFromType } from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { getEncodedFqn, stringToHTML } from '../../../utils/StringsUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../Loader/Loader';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../PermissionProvider/PermissionProvider.interface';
import ContainerSummary from './ContainerSummary/ContainerSummary.component';
import DashboardSummary from './DashboardSummary/DashboardSummary.component';
import DatabaseSchemaSummary from './DatabaseSchemaSummary/DatabaseSchemaSummary.component';
import DatabaseSummary from './DatabaseSummary/DatabaseSummary.component';
import DataModelSummary from './DataModelSummary/DataModelSummary.component';
import DataProductSummary from './DataProductSummary/DataProductSummary.component';
import './entity-summary-panel.less';
import { EntitySummaryPanelProps } from './EntitySummaryPanel.interface';
import GlossaryTermSummary from './GlossaryTermSummary/GlossaryTermSummary.component';
import MlModelSummary from './MlModelSummary/MlModelSummary.component';
import PipelineSummary from './PipelineSummary/PipelineSummary.component';
import SearchIndexSummary from './SearchIndexSummary/SearchIndexSummary.component';
import ServiceSummary from './ServiceSummary/ServiceSummary.component';
import StoredProcedureSummary from './StoredProcedureSummary/StoredProcedureSummary.component';
import TableSummary from './TableSummary/TableSummary.component';
import TagsSummary from './TagsSummary/TagsSummary.component';
import TopicSummary from './TopicSummary/TopicSummary.component';

export default function EntitySummaryPanel({
  entityDetails,
}: EntitySummaryPanelProps) {
  const { tab } = useParams<{ tab: string }>();
  const { getEntityPermission } = usePermissionProvider();
  const [isPermissionLoading, setIsPermissionLoading] =
    useState<boolean>(false);
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const id = useMemo(() => {
    setIsPermissionLoading(true);

    return entityDetails?.details?.id ?? '';
  }, [entityDetails?.details?.id]);

  const fetchResourcePermission = async (entityFqn: string) => {
    try {
      setIsPermissionLoading(true);
      const type =
        get(entityDetails, 'details.entityType') ?? ResourceEntity.TABLE;
      const permissions = await getEntityPermission(type, entityFqn);
      setEntityPermissions(permissions);
    } catch (error) {
      // Error
    } finally {
      setIsPermissionLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchResourcePermission(id);
    }
  }, [id]);

  const viewPermission = useMemo(
    () => entityPermissions.ViewBasic || entityPermissions.ViewAll,
    [entityPermissions]
  );

  const summaryComponent = useMemo(() => {
    if (isPermissionLoading) {
      return <Loader />;
    }
    if (!viewPermission) {
      return (
        <ErrorPlaceHolder
          size={SIZE.MEDIUM}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      );
    }
    const type = get(entityDetails, 'details.entityType') ?? EntityType.TABLE;
    const entity = entityDetails.details;
    switch (type) {
      case EntityType.TABLE:
        return <TableSummary entityDetails={entity as Table} />;

      case EntityType.TOPIC:
        return <TopicSummary entityDetails={entity as Topic} />;

      case EntityType.DASHBOARD:
        return <DashboardSummary entityDetails={entity as Dashboard} />;

      case EntityType.PIPELINE:
        return <PipelineSummary entityDetails={entity as Pipeline} />;

      case EntityType.MLMODEL:
        return <MlModelSummary entityDetails={entity as Mlmodel} />;

      case EntityType.CONTAINER:
        return <ContainerSummary entityDetails={entity as Container} />;

      case EntityType.STORED_PROCEDURE:
        return (
          <StoredProcedureSummary entityDetails={entity as StoredProcedure} />
        );

      case EntityType.DASHBOARD_DATA_MODEL:
        return (
          <DataModelSummary entityDetails={entity as DashboardDataModel} />
        );

      case EntityType.GLOSSARY_TERM:
        return <GlossaryTermSummary entityDetails={entity as GlossaryTerm} />;

      case EntityType.TAG:
        return <TagsSummary entityDetails={entity as Tag} />;

      case EntityType.DATA_PRODUCT:
        return <DataProductSummary entityDetails={entity as DataProduct} />;

      case EntityType.SEARCH_INDEX:
        return <SearchIndexSummary entityDetails={entity as SearchIndex} />;

      case EntityType.DATABASE:
        return <DatabaseSummary entityDetails={entity as Database} />;

      case EntityType.DATABASE_SCHEMA:
        return (
          <DatabaseSchemaSummary entityDetails={entity as DatabaseSchema} />
        );

      case EntityType.DATABASE_SERVICE:
        return (
          <ServiceSummary
            entityDetails={entity as DatabaseService}
            type={ExplorePageTabs.DATABASE_SERVICE}
          />
        );
      case EntityType.MESSAGING_SERVICE:
        return (
          <ServiceSummary
            entityDetails={entity as MessagingService}
            type={ExplorePageTabs.MESSAGING_SERVICE}
          />
        );
      case EntityType.DASHBOARD_SERVICE:
        return (
          <ServiceSummary
            entityDetails={entity as DashboardService}
            type={ExplorePageTabs.DASHBOARD_SERVICE}
          />
        );
      case EntityType.PIPELINE_SERVICE:
        return (
          <ServiceSummary
            entityDetails={entity as PipelineService}
            type={ExplorePageTabs.PIPELINE_SERVICE}
          />
        );

      case EntityType.MLMODEL_SERVICE:
        return (
          <ServiceSummary
            entityDetails={entity as MlmodelService}
            type={ExplorePageTabs.ML_MODEL_SERVICE}
          />
        );

      case EntityType.STORAGE_SERVICE:
        return (
          <ServiceSummary
            entityDetails={entity as StorageService}
            type={ExplorePageTabs.STORAGE_SERVICE}
          />
        );

      case EntityType.SEARCH_SERVICE:
        return (
          <ServiceSummary
            entityDetails={entity as SearchService}
            type={ExplorePageTabs.SEARCH_INDEX_SERVICE}
          />
        );

      default:
        return searchClassBase.getEntitySummaryComponent(entity);
    }
  }, [tab, entityDetails, viewPermission, isPermissionLoading]);

  const entityLink = useMemo(
    () => searchClassBase.getEntityLink(entityDetails.details),
    [entityDetails, getEntityLinkFromType, getEncodedFqn]
  );

  return (
    <Drawer
      destroyOnClose
      open
      className="summary-panel-container"
      closable={false}
      getContainer={false}
      headerStyle={{ padding: 16 }}
      mask={false}
      title={
        viewPermission && (
          <Link
            className="no-underline"
            data-testid="entity-link"
            target={searchClassBase.getSearchEntityLinkTarget(
              entityDetails.details
            )}
            to={entityLink}>
            <Typography.Text className="m-b-0 d-block summary-panel-title">
              {stringToHTML(
                searchClassBase.getEntityName(entityDetails.details)
              )}
            </Typography.Text>
          </Link>
        )
      }
      width="100%">
      {summaryComponent}
    </Drawer>
  );
}
