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

import { Card } from 'antd';
import { AxiosError } from 'axios';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import EntityLineageComponent from 'components/EntityLineage/EntityLineage.component';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getDashboardByFqn } from 'rest/dashboardAPI';
import { getMlModelByFQN } from 'rest/mlModelAPI';
import { getPipelineByFqn } from 'rest/pipelineAPI';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { getTopicByFqn } from 'rest/topicsAPI';
import {
  getDashboardDetailsPath,
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getMlModelPath,
  getPipelineDetailsPath,
  getServiceDetailsPath,
  getTableTabPath,
  getTopicDetailsPath,
} from '../../constants/constants';
import { PIPELINE_DETAILS_TABS } from '../../constants/pipeline.constants';
import { EntityType, FqnPart } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Topic } from '../../generated/entity/data/topic';
import jsonData from '../../jsons/en';
import {
  getEntityName,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';
// css import
import './lineagePage.style.less';

const LineagePage = () => {
  const { t } = useTranslation();
  const { entityType, entityFQN } =
    useParams<{ entityType: EntityType; entityFQN: string }>();

  const [titleBreadcrumb, setTitleBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const updateBreadcrumb = (
    apiRes: Topic | Dashboard | Pipeline | Mlmodel,
    currentEntityPath: string
  ) => {
    const { service, serviceType } = apiRes;
    const serviceName = service.name ?? '';
    setTitleBreadcrumb([
      {
        name: serviceName,
        url: serviceName
          ? getServiceDetailsPath(
              serviceName,
              ServiceCategory.MESSAGING_SERVICES
            )
          : '',
        imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
      },
      {
        name: getEntityName(apiRes),
        url: currentEntityPath,
      },
      {
        name: 'Lineage',
        url: '',
        activeTitle: true,
      },
    ]);
  };

  const fetchEntityDetails = async () => {
    try {
      switch (entityType) {
        case EntityType.TABLE:
          {
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
                name: getPartialNameFromTableFQN(
                  database?.fullyQualifiedName ?? '',
                  [FqnPart.Database]
                ),
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
                url: getTableTabPath(entityFQN, 'lineage'),
              },
              {
                name: 'Lineage',
                url: '',
                activeTitle: true,
              },
            ]);
          }

          break;

        case EntityType.TOPIC:
          {
            const topicRes = await getTopicByFqn(entityFQN, '');
            updateBreadcrumb(
              topicRes,
              getTopicDetailsPath(entityFQN, 'lineage')
            );
          }

          break;

        case EntityType.DASHBOARD:
          {
            const dashboardRes = await getDashboardByFqn(entityFQN, '');
            updateBreadcrumb(
              dashboardRes,
              getDashboardDetailsPath(entityFQN, 'lineage')
            );
          }

          break;

        case EntityType.PIPELINE:
          {
            const pipelineRes = await getPipelineByFqn(entityFQN, '');
            updateBreadcrumb(
              pipelineRes,
              getPipelineDetailsPath(entityFQN, PIPELINE_DETAILS_TABS.Lineage)
            );
          }

          break;

        case EntityType.MLMODEL:
          {
            const mlmodelRes = await getMlModelByFQN(entityFQN, '');
            updateBreadcrumb(mlmodelRes, getMlModelPath(entityFQN, 'lineage'));
          }

          break;

        default:
          break;
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-entity-details-error']
      );
    }
  };

  useEffect(() => {
    if (entityFQN && entityType) {
      fetchEntityDetails();
    }
  }, [entityFQN, entityType]);

  return (
    <PageContainerV1>
      <PageLayoutV1 className="p-x-lg" pageTitle={t('label.lineage')}>
        <div className="lineage-page-container">
          <TitleBreadcrumb titleLinks={titleBreadcrumb} />
          <Card className="h-full" size="default">
            <EntityLineageComponent hasEditAccess entityType={entityType} />
          </Card>
        </div>
      </PageLayoutV1>
    </PageContainerV1>
  );
};

export default LineagePage;
