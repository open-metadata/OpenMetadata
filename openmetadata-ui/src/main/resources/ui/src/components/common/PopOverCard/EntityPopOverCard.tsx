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

import { Popover } from 'antd';
import React, {
  FC,
  HTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from 'react';
import AppState from '../../../AppState';
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import { Include } from '../../../generated/type/include';
import { getDashboardByFqn } from '../../../rest/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
} from '../../../rest/databaseAPI';
import { getDataModelDetailsByFQN } from '../../../rest/dataModelsAPI';
import { getDataProductByName } from '../../../rest/dataProductAPI';
import { getDomainByName } from '../../../rest/domainAPI';
import {
  getGlossariesByName,
  getGlossaryTermByFQN,
} from '../../../rest/glossaryAPI';
import { getMlModelByFQN } from '../../../rest/mlModelAPI';
import { getPipelineByFqn } from '../../../rest/pipelineAPI';
import { getContainerByFQN } from '../../../rest/storageAPI';
import { getStoredProceduresDetailsByFQN } from '../../../rest/storedProceduresAPI';
import { getTableDetailsByFQN } from '../../../rest/tableAPI';
import { getTopicByFqn } from '../../../rest/topicsAPI';
import { getTableFQNFromColumnFQN } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDecodedFqn, getEncodedFqn } from '../../../utils/StringsUtils';
import { EntityUnion } from '../../Explore/explore.interface';
import ExploreSearchCard from '../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import Loader from '../../Loader/Loader';
import './popover-card.less';

interface Props extends HTMLAttributes<HTMLDivElement> {
  entityType: string;
  entityFQN: string;
}

const PopoverContent: React.FC<{
  entityFQN: string;
  entityType: string;
}> = ({ entityFQN, entityType }) => {
  const [entityData, setEntityData] = useState<EntityUnion>({} as EntityUnion);
  const [loading, setLoading] = useState(true);

  const getData = useCallback(() => {
    const setEntityDetails = (entityDetail: EntityUnion) => {
      AppState.entityData[entityFQN] = entityDetail;
    };

    const fields = 'tags,owner';
    let promise: Promise<EntityUnion> | null = null;

    switch (entityType) {
      case EntityType.TABLE:
        promise = getTableDetailsByFQN(entityFQN, fields);

        break;
      case EntityType.TEST_CASE:
        promise = getTableDetailsByFQN(
          getEncodedFqn(getTableFQNFromColumnFQN(getDecodedFqn(entityFQN))),
          fields
        );

        break;
      case EntityType.TOPIC:
        promise = getTopicByFqn(entityFQN, fields);

        break;
      case EntityType.DASHBOARD:
      case EntityType.CHART:
        promise = getDashboardByFqn(entityFQN, fields);

        break;
      case EntityType.PIPELINE:
        promise = getPipelineByFqn(entityFQN, fields);

        break;
      case EntityType.MLMODEL:
        promise = getMlModelByFQN(entityFQN, fields);

        break;
      case EntityType.DATABASE:
        promise = getDatabaseDetailsByFQN(entityFQN, 'owner', Include.All);

        break;
      case EntityType.DATABASE_SCHEMA:
        promise = getDatabaseSchemaDetailsByFQN(
          entityFQN,
          'owner',
          'include=all'
        );

        break;
      case EntityType.GLOSSARY_TERM:
        promise = getGlossaryTermByFQN(getDecodedFqn(entityFQN), 'owner');

        break;
      case EntityType.GLOSSARY:
        promise = getGlossariesByName(entityFQN, 'owner');

        break;

      case EntityType.CONTAINER:
        promise = getContainerByFQN(entityFQN, 'owner', Include.All);

        break;

      case EntityType.DASHBOARD_DATA_MODEL:
        promise = getDataModelDetailsByFQN(entityFQN, fields);

        break;

      case EntityType.STORED_PROCEDURE:
        promise = getStoredProceduresDetailsByFQN(entityFQN, fields);

        break;
      case EntityType.DOMAIN:
        promise = getDomainByName(entityFQN, 'owner');

        break;

      case EntityType.DATA_PRODUCT:
        promise = getDataProductByName(entityFQN, 'owner,domain');

        break;

      default:
        break;
    }

    if (promise) {
      setLoading(true);
      promise
        .then((res) => {
          setEntityDetails(res);
          setEntityData(res);
        })
        .catch(() => {
          // do nothing
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [entityType, entityFQN]);

  const onMouseOver = () => {
    const entityData = AppState.entityData[entityFQN];
    if (entityData) {
      setEntityData(entityData);
      setLoading(false);
    } else {
      getData();
    }
  };

  useEffect(() => {
    onMouseOver();
  }, [entityFQN]);

  if (loading) {
    return <Loader size="small" />;
  }

  return (
    <ExploreSearchCard
      id="tabledatacard"
      showTags={false}
      source={{
        ...entityData,
        name: entityData.name,
        displayName: getEntityName(entityData),
        id: entityData.id ?? '',
        description: entityData.description ?? '',
        fullyQualifiedName: getDecodedFqn(entityFQN),
        tags: (entityData as Table).tags,
        entityType: entityType,
        serviceType: (entityData as Table).serviceType,
      }}
    />
  );
};

const EntityPopOverCard: FC<Props> = ({ children, entityType, entityFQN }) => {
  return (
    <Popover
      align={{ targetOffset: [0, -10] }}
      content={
        <PopoverContent
          entityFQN={getEncodedFqn(entityFQN)}
          entityType={entityType}
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
