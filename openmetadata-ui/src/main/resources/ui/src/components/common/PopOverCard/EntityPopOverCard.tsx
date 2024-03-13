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

import { Popover, Typography } from 'antd';
import { isUndefined } from 'lodash';
import React, {
  FC,
  HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationConfigContext } from '../../../context/ApplicationConfigProvider/ApplicationConfigProvider';
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import { Include } from '../../../generated/type/include';
import { getDashboardByFqn } from '../../../rest/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
} from '../../../rest/databaseAPI';
import { getDataModelByFqn } from '../../../rest/dataModelsAPI';
import { getDataProductByName } from '../../../rest/dataProductAPI';
import { getDomainByName } from '../../../rest/domainAPI';
import {
  getGlossariesByName,
  getGlossaryTermByFQN,
} from '../../../rest/glossaryAPI';
import { getMlModelByFQN } from '../../../rest/mlModelAPI';
import { getPipelineByFqn } from '../../../rest/pipelineAPI';
import { getContainerByFQN } from '../../../rest/storageAPI';
import { getStoredProceduresByFqn } from '../../../rest/storedProceduresAPI';
import { getTableDetailsByFQN } from '../../../rest/tableAPI';
import { getTagByFqn } from '../../../rest/tagAPI';
import { getTestCaseByFqn } from '../../../rest/testAPI';
import { getTopicByFqn } from '../../../rest/topicsAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { EntityUnion } from '../../Explore/ExplorePage.interface';
import ExploreSearchCard from '../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import Loader from '../Loader/Loader';
import './popover-card.less';

interface Props extends HTMLAttributes<HTMLDivElement> {
  entityType: string;
  entityFQN: string;
  extraInfo?: React.ReactNode;
}

export const PopoverContent: React.FC<{
  entityFQN: string;
  entityType: string;
  extraInfo?: React.ReactNode;
}> = ({ entityFQN, entityType, extraInfo }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const { cachedEntityData, updateCachedEntityData } =
    useApplicationConfigContext();

  const entityData: SearchedDataProps['data'][number]['_source'] | undefined =
    useMemo(() => {
      const data = cachedEntityData[entityFQN];

      return data
        ? {
            ...data,
            name: data.name,
            displayName: getEntityName(data),
            id: data.id ?? '',
            description: data.description ?? '',
            fullyQualifiedName: entityFQN,
            tags: (data as Table)?.tags,
            entityType: entityType,
            serviceType: (data as Table)?.serviceType,
          }
        : data;
    }, [cachedEntityData, entityFQN]);

  const getData = useCallback(async () => {
    const fields = 'tags,owner';
    setLoading(true);
    let promise: Promise<EntityUnion> | null = null;

    switch (entityType) {
      case EntityType.TABLE:
        promise = getTableDetailsByFQN(entityFQN, { fields });

        break;
      case EntityType.TEST_CASE:
        promise = getTestCaseByFqn(entityFQN, {
          fields: ['owner'],
        });

        break;
      case EntityType.TOPIC:
        promise = getTopicByFqn(entityFQN, { fields });

        break;
      case EntityType.DASHBOARD:
      case EntityType.CHART:
        promise = getDashboardByFqn(entityFQN, { fields });

        break;
      case EntityType.PIPELINE:
        promise = getPipelineByFqn(entityFQN, { fields });

        break;
      case EntityType.MLMODEL:
        promise = getMlModelByFQN(entityFQN, { fields });

        break;
      case EntityType.DATABASE:
        promise = getDatabaseDetailsByFQN(entityFQN, {
          fields: 'owner',
        });

        break;
      case EntityType.DATABASE_SCHEMA:
        promise = getDatabaseSchemaDetailsByFQN(entityFQN, {
          fields: 'owner',
          include: Include.All,
        });

        break;
      case EntityType.GLOSSARY_TERM:
        promise = getGlossaryTermByFQN(entityFQN, {
          fields: 'owner',
        });

        break;
      case EntityType.GLOSSARY:
        promise = getGlossariesByName(entityFQN, { fields: 'owner' });

        break;

      case EntityType.CONTAINER:
        promise = getContainerByFQN(entityFQN, {
          fields: 'owner',
          include: Include.All,
        });

        break;

      case EntityType.DASHBOARD_DATA_MODEL:
        promise = getDataModelByFqn(entityFQN, { fields });

        break;

      case EntityType.STORED_PROCEDURE:
        promise = getStoredProceduresByFqn(entityFQN, { fields });

        break;
      case EntityType.DOMAIN:
        promise = getDomainByName(entityFQN, { fields: 'owner' });

        break;

      case EntityType.DATA_PRODUCT:
        promise = getDataProductByName(entityFQN, { fields: 'owner,domain' });

        break;

      case EntityType.TAG:
        promise = getTagByFqn(entityFQN);

        break;

      default:
        break;
    }

    if (promise) {
      try {
        const res = await promise;
        updateCachedEntityData({ id: entityFQN, entityDetails: res });
      } catch (error) {
        // Error
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [entityType, entityFQN, updateCachedEntityData]);

  useEffect(() => {
    const entityData = cachedEntityData[entityFQN];

    if (entityData) {
      setLoading(false);
    } else {
      getData();
    }
  }, [entityFQN]);

  if (loading) {
    return <Loader size="small" />;
  }

  if (isUndefined(entityData)) {
    return <Typography.Text>{t('label.no-data-found')}</Typography.Text>;
  }

  return (
    <ExploreSearchCard
      actionPopoverContent={extraInfo}
      id="tabledatacard"
      showTags={false}
      source={entityData}
    />
  );
};

const EntityPopOverCard: FC<Props> = ({
  children,
  entityType,
  entityFQN,
  extraInfo,
}) => {
  return (
    <Popover
      align={{ targetOffset: [0, -10] }}
      content={
        <PopoverContent
          entityFQN={entityFQN}
          entityType={entityType}
          extraInfo={extraInfo}
        />
      }
      overlayClassName="entity-popover-card"
      trigger="hover"
      zIndex={9999}>
      {children}
    </Popover>
  );
};

export default EntityPopOverCard;
