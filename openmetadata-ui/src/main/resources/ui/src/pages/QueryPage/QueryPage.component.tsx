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
import { AxiosError } from 'axios';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTableTabPath,
} from 'constants/constants';
import { FqnPart } from 'enums/entity.enum';
import { ServiceCategory } from 'enums/service.enum';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { getPartialNameFromTableFQN } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { parseSearchParams } from 'utils/Query/QueryUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { showErrorToast } from 'utils/ToastUtils';

const QueryPage = () => {
  const { entityFQN, queryFQN } =
    useParams<{ entityFQN: string; queryFQN: string }>();
  const { t } = useTranslation();
  const location = useLocation();
  const searchFilter = useMemo(
    () => parseSearchParams(location.search),
    [location.search]
  );

  const [titleBreadcrumb, setTitleBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const fetchEntityDetails = async () => {
    try {
      const tableRes = await getTableDetailsByFQN(entityFQN, '');
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
          url: getTableTabPath(entityFQN, 'table_queries'),
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
    if (entityFQN) {
      fetchEntityDetails();
    }
  }, [entityFQN]);
  // useEffect(() => {}, [queryFQN]);

  return (
    <PageContainerV1>
      <PageLayoutV1 className="p-x-lg" pageTitle={t('label.query')}>
        <TitleBreadcrumb titleLinks={titleBreadcrumb} />
      </PageLayoutV1>
    </PageContainerV1>
  );
};

export default QueryPage;
