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
import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import QueryCard from 'components/TableQueries/QueryCard';
import { QueryVote } from 'components/TableQueries/TableQueries.interface';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTableTabPath,
} from 'constants/constants';
import { FqnPart } from 'enums/entity.enum';
import { ServiceCategory } from 'enums/service.enum';
import { compare } from 'fast-json-patch';
import { Query } from 'generated/entity/data/query';
import { isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import { getQueryByFqn, patchQueries, updateQueryVote } from 'rest/queryAPI';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { getPartialNameFromTableFQN } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { parseSearchParams } from 'utils/Query/QueryUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { showErrorToast } from 'utils/ToastUtils';

const QueryPage = () => {
  const { datasetFQN, queryFQN } =
    useParams<{ datasetFQN: string; queryFQN: string }>();
  const { t } = useTranslation();
  const location = useLocation();
  const searchFilter = useMemo(
    () => parseSearchParams(location.search),
    [location.search]
  );

  const [titleBreadcrumb, setTitleBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [isLoading, setIsLoading] = useState({ permission: true, query: true });
  const [queryPermissions, setQueryPermissions] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );
  const [query, setQuery] = useState<Query>();

  const { getEntityPermissionByFqn } = usePermissionProvider();

  const fetchResourcePermission = async () => {
    setIsLoading((pre) => ({ ...pre, permission: true }));

    try {
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.QUERY,
        queryFQN || ''
      );
      setQueryPermissions(permission);
    } catch (error) {
      showErrorToast(
        t('label.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    } finally {
      setIsLoading((pre) => ({ ...pre, permission: false }));
    }
  };

  useEffect(() => {
    if (queryFQN) {
      fetchResourcePermission();
    }
  }, [queryFQN]);

  const fetchEntityDetails = async () => {
    try {
      const tableRes = await getTableDetailsByFQN(datasetFQN, '');
      const { database, service, serviceType, databaseSchema } = tableRes;
      const serviceName = service?.name ?? '';
      setTitleBreadcrumb([
        {
          name: serviceName,
          url: serviceName
            ? getServiceDetailsPath(
                serviceName,
                ServiceCategory.DATABASE_SERVICES
              )
            : '',
          imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
        },
        {
          name: getPartialNameFromTableFQN(database?.fullyQualifiedName ?? '', [
            FqnPart.Database,
          ]),
          url: getDatabaseDetailsPath(database?.fullyQualifiedName ?? ''),
        },
        {
          name: getPartialNameFromTableFQN(
            databaseSchema?.fullyQualifiedName ?? '',
            [FqnPart.Schema]
          ),
          url: getDatabaseSchemaDetailsPath(
            databaseSchema?.fullyQualifiedName ?? ''
          ),
        },
        {
          name: getEntityName(tableRes),
          url: getTableTabPath(datasetFQN, 'table_queries'),
        },
        {
          name: 'Query',
          url: '',
          activeTitle: true,
        },
      ]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (datasetFQN) {
      fetchEntityDetails();
    }
  }, [datasetFQN]);

  const fetchQueryByFqn = async () => {
    setIsLoading((pre) => ({ ...pre, query: true }));
    try {
      const queryResponse = await getQueryByFqn(queryFQN, {
        fields: 'votes,queryUsedIn',
      });
      setQuery(queryResponse);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading((pre) => ({ ...pre, query: false }));
    }
  };

  useEffect(() => {
    const isViewAllowed =
      queryPermissions.ViewAll ||
      queryPermissions.ViewBasic ||
      queryPermissions.ViewQueries;

    if (queryFQN && isViewAllowed) {
      fetchQueryByFqn();
    }
  }, [queryFQN, queryPermissions]);

  const handleQueryUpdate = async (updatedQuery: Query, key: keyof Query) => {
    if (isUndefined(query)) {
      return;
    }

    const jsonPatch = compare(query, updatedQuery);

    try {
      const res = await patchQueries(query.id || '', jsonPatch);
      setQuery((pre) => (pre ? { ...pre, [key]: res[key] } : res));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const updateVote = async (data: QueryVote, id?: string) => {
    try {
      await updateQueryVote(id || '', data);
      const response = await getQueryByFqn(queryFQN || '', {
        fields: 'votes,queryUsedIn',
      });
      setQuery(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  if (isLoading.permission || isLoading.query) {
    return <Loader />;
  }

  if (isUndefined(query)) {
    return (
      <div className="flex-center font-medium" data-testid="no-queries">
        <ErrorPlaceHolder heading={t('label.query-lowercase-plural')} />
      </div>
    );
  }

  return (
    <PageContainerV1>
      <PageLayoutV1 className="p-x-lg" pageTitle={t('label.query')}>
        <Row gutter={[0, 16]}>
          <Col span={24}>
            <TitleBreadcrumb titleLinks={titleBreadcrumb} />
          </Col>
          <Col span={24}>
            <QueryCard
              isExpanded
              permission={queryPermissions}
              query={query}
              tableId={searchFilter.tableId}
              onQueryUpdate={handleQueryUpdate}
              onUpdateVote={updateVote}
            />
          </Col>
        </Row>
      </PageLayoutV1>
    </PageContainerV1>
  );
};

export default QueryPage;
