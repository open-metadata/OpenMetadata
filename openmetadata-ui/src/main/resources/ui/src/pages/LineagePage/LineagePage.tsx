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
import { Container } from 'generated/entity/data/container';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getDashboardByFqn } from 'rest/dashboardAPI';
import { getMlModelByFQN } from 'rest/mlModelAPI';
import { getPipelineByFqn } from 'rest/pipelineAPI';
import { getContainerByName } from 'rest/storageAPI';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { getTopicByFqn } from 'rest/topicsAPI';
import { getContainerDetailPath } from 'utils/ContainerDetailUtils';
import {
  getDashboardDetailsPath,
  getMlModelPath,
  getPipelineDetailsPath,
  getTableTabPath,
  getTopicDetailsPath,
} from '../../constants/constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Topic } from '../../generated/entity/data/topic';
import { getEntityBreadcrumbs, getEntityName } from '../../utils/EntityUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './lineagePage.style.less';

const LineagePage = () => {
  const { t } = useTranslation();
  const { entityType, entityFQN } =
    useParams<{ entityType: EntityType; entityFQN: string }>();

  const [titleBreadcrumb, setTitleBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const updateBreadcrumb = (
    apiRes: Topic | Dashboard | Pipeline | Mlmodel | Container,
    currentEntityPath: string,
    entityType: EntityType
  ) => {
    setTitleBreadcrumb([
      ...getEntityBreadcrumbs(apiRes, entityType),
      {
        name: getEntityName(apiRes),
        url: currentEntityPath,
      },
      {
        name: t('label.lineage'),
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
            setTitleBreadcrumb([
              ...getEntityBreadcrumbs(tableRes, EntityType.TABLE),
              {
                name: getEntityName(tableRes),
                url: getTableTabPath(entityFQN, EntityTabs.LINEAGE),
              },
              {
                name: t('label.lineage'),
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
              getTopicDetailsPath(entityFQN, EntityTabs.LINEAGE),
              EntityType.TOPIC
            );
          }

          break;

        case EntityType.DASHBOARD:
          {
            const dashboardRes = await getDashboardByFqn(entityFQN, '');
            updateBreadcrumb(
              dashboardRes,
              getDashboardDetailsPath(entityFQN, EntityTabs.LINEAGE),
              EntityType.DASHBOARD
            );
          }

          break;

        case EntityType.PIPELINE:
          {
            const pipelineRes = await getPipelineByFqn(entityFQN, '');
            updateBreadcrumb(
              pipelineRes,
              getPipelineDetailsPath(entityFQN, EntityTabs.LINEAGE),
              EntityType.PIPELINE
            );
          }

          break;

        case EntityType.MLMODEL:
          {
            const mlmodelRes = await getMlModelByFQN(entityFQN, '');
            updateBreadcrumb(
              mlmodelRes,
              getMlModelPath(entityFQN, EntityTabs.LINEAGE),
              EntityType.MLMODEL
            );
          }

          break;

        case EntityType.CONTAINER:
          {
            const containerRes = await getContainerByName(entityFQN, '');
            updateBreadcrumb(
              containerRes,
              getContainerDetailPath(entityFQN, EntityTabs.LINEAGE),
              EntityType.CONTAINER
            );
          }

          break;

        default:
          break;
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: entityType,
        })
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
            <EntityLineageComponent
              hasEditAccess
              isFullScreen
              entityType={entityType}
            />
          </Card>
        </div>
      </PageLayoutV1>
    </PageContainerV1>
  );
};

export default LineagePage;
