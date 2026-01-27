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
import {
  FC,
  HTMLAttributes,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import ExploreSearchCard from '../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import Loader from '../Loader/Loader';
import './popover-card.less';

interface Props extends HTMLAttributes<HTMLDivElement> {
  entityType: string;
  entityFQN: string;
  extraInfo?: React.ReactNode;
  defaultOpen?: boolean;
}

export const PopoverContent: React.FC<{
  entityFQN: string;
  entityType: string;
  extraInfo?: React.ReactNode;
}> = ({ entityFQN, entityType, extraInfo }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const { cachedEntityData, updateCachedEntityData } = useApplicationStore();

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
    const fields = `${TabSpecificField.TAGS},${TabSpecificField.OWNERS}`;
    setLoading(true);

    const promise = entityUtilClassBase.getEntityByFqn(
      entityType,
      entityFQN,
      fields
    );

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
      className="entity-popover-card"
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
  defaultOpen = false,
}) => {
  return (
    <Popover
      align={{ targetOffset: [0, 10] }}
      content={
        <PopoverContent
          entityFQN={entityFQN}
          entityType={entityType}
          extraInfo={extraInfo}
        />
      }
      defaultOpen={defaultOpen}
      overlayClassName="entity-popover-card"
      trigger="hover"
      zIndex={9999}>
      {children as ReactNode}
    </Popover>
  );
};

export default EntityPopOverCard;
