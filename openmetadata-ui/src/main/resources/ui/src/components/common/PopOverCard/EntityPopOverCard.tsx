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

import { HoverCard, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import {
  FC,
  HTMLAttributes,
  lazy,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ClientErrors } from '../../../enums/Axios.enum';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getEntityName } from '../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import Loader from '../Loader/Loader';
import './popover-card.less';

const ExploreSearchCard = withSuspenseFallback(
  lazy(() => import('../../ExploreV1/ExploreSearchCard/ExploreSearchCard'))
);

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
  const [isForbidden, setIsForbidden] = useState(false);
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
    setIsForbidden(false);

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
        // A 403 means the entity exists but is not readable by this user. Saying
        // "no data found" for that case reports a permission problem as missing
        // data, so the two are kept apart.
        setIsForbidden(
          (error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN
        );
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

  if (isForbidden) {
    return <Typography>{t('message.no-permission-to-view')}</Typography>;
  }

  if (isUndefined(entityData)) {
    return <Typography>{t('label.no-data-found')}</Typography>;
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
}) => (
  <HoverCard
    className="entity-popover-card"
    content={
      <PopoverContent
        entityFQN={entityFQN}
        entityType={entityType}
        extraInfo={extraInfo}
      />
    }>
    {children as ReactNode}
  </HoverCard>
);

export default EntityPopOverCard;
