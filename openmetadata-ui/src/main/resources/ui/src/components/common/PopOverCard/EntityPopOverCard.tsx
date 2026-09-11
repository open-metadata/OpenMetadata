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
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
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
  defaultOpen?: boolean;
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
    return (
      <Typography.Text>{t('message.no-permission-to-view')}</Typography.Text>
    );
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
  const [open, setOpen] = useState(defaultOpen);
  const { pathname } = useLocation();
  const lastPathname = useRef(pathname);

  // rc-trigger hides the popup only on mouseleave. When the trigger unmounts
  // under the cursor -- a feed refetch, a resolved task, a route change -- that
  // event never fires and the portal is left floating over whatever renders
  // next. Closing on navigation bounds how long a stale popup can survive.
  // The first run is skipped so `defaultOpen` still opens the popup on mount.
  useEffect(() => {
    if (lastPathname.current === pathname) {
      return;
    }

    lastPathname.current = pathname;
    setOpen(false);
  }, [pathname]);

  return (
    <Popover
      destroyTooltipOnHide
      align={{ targetOffset: [0, 10] }}
      content={
        <PopoverContent
          entityFQN={entityFQN}
          entityType={entityType}
          extraInfo={extraInfo}
        />
      }
      open={open}
      overlayClassName="entity-popover-card"
      trigger="hover"
      zIndex={9999}
      onOpenChange={setOpen}>
      {children as ReactNode}
    </Popover>
  );
};

export default EntityPopOverCard;
