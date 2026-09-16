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
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import QueryCard from '../../components/Database/TableQueries/QueryCard';
import { QueryVote } from '../../components/Database/TableQueries/TableQueries.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { Query } from '../../generated/entity/data/query';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../hooks/useFqn';
import {
  getQueryById,
  patchQueries,
  updateQueryVote,
} from '../../rest/queryAPI';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { getEntityBreadcrumbs } from '../../utils/EntityBreadcrumbPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { getEntityDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

const QueryPage = () => {
  const { queryId } = useRequiredParams<{ queryId: string }>();
  const { fqn: datasetFQN } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [titleBreadcrumb, setTitleBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [isQueryLoading, setIsQueryLoading] = useState(true);
  const [query, setQuery] = useState<Query>();

  // Fetch-owner, by id (old code used getEntityPermission, not getEntityPermissionByFqn) —
  // matches the `{ id }` identifier form. `queryPermissions` stays raw — fed straight to
  // QueryCard's `permission` prop below (rule 2).
  const {
    permissions: queryPermissions,
    isLoading: isPermissionsLoading,
    error: permissionsError,
    hasViewAccess,
    canViewQueries,
  } = useEntityPermissions(
    ResourceEntity.QUERY,
    { id: queryId || '' },
    { enabled: Boolean(queryId) }
  );

  // 3-term OR in the old code (`ViewAll || ViewBasic || ViewQueries`): `hasViewAccess` covers
  // the first two terms exactly (ViewBasic || ViewAll); `canViewQueries` replaces the old raw
  // `ViewQueries` read — provably equivalent here because `hasViewAccess` already carries the
  // ViewAll fallback `canViewQueries` would apply on its own when the ViewQueries key is
  // absent, so there is no behavior this substitution could change.
  const isViewAllowed = hasViewAccess || canViewQueries;

  useEffect(() => {
    if (permissionsError) {
      showErrorToast(
        t('server.fetch-entity-permissions-error', {
          entity: t('label.resource-permission-lowercase'),
        })
      );
    }
  }, [permissionsError]);

  const fetchEntityDetails = async () => {
    try {
      const tableRes = await getTableDetailsByFQN(datasetFQN);
      setTitleBreadcrumb([
        ...getEntityBreadcrumbs(tableRes, EntityType.TABLE),
        {
          name: getEntityName(tableRes),
          url: getEntityDetailsPath(
            EntityType.TABLE,
            datasetFQN,
            'table_queries'
          ),
        },
        {
          name: t('label.query'),
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

  const fetchQueryById = async () => {
    setIsQueryLoading(true);
    try {
      const queryResponse = await getQueryById(queryId, {
        fields: [TabSpecificField.VOTES, TabSpecificField.QUERY_USED_IN],
      });
      setQuery(queryResponse);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsQueryLoading(false);
    }
  };

  useEffect(() => {
    if (queryId && isViewAllowed) {
      fetchQueryById();
    } else {
      setIsQueryLoading(false);
    }
  }, [queryId, isViewAllowed]);

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
      const response = await getQueryById(queryId || '', {
        fields: [TabSpecificField.VOTES, TabSpecificField.QUERY_USED_IN],
      });
      setQuery(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const afterDeleteAction = () => {
    navigate(-1);
  };

  if (isPermissionsLoading || isQueryLoading) {
    return <Loader />;
  }
  if (!isViewAllowed) {
    return (
      <ErrorPlaceHolder
        className="border-none"
        permissionValue={t('label.view-entity', {
          entity: t('label.query'),
        })}
        type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
      />
    );
  }

  if (isUndefined(query)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.query')}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={titleBreadcrumb} />
        </Col>
        <Col span={24}>
          <QueryCard
            isExpanded
            afterDeleteAction={afterDeleteAction}
            permission={queryPermissions}
            query={query}
            onQueryUpdate={handleQueryUpdate}
            onUpdateVote={updateVote}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default QueryPage;
