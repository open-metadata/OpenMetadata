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

import { Button, Card } from 'antd';
import { isNil } from 'lodash';
import React, { FunctionComponent, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getExplorePath, ROUTES } from '../../constants/constants';
import { getCountBadge } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import EntityListSkeleton from '../Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import { MyAssetStatsProps } from './MyAssetStats.interface';

const MyAssetStats: FunctionComponent<MyAssetStatsProps> = ({
  entityState,
}: MyAssetStatsProps) => {
  const { t } = useTranslation();
  const { entityCounts, entityCountLoading } = entityState;

  const dataSummary = useMemo(
    () => ({
      tables: {
        icon: Icons.TABLE_GREY,
        data: t('label.table-plural'),
        count: entityCounts.tableCount,
        link: getExplorePath({ tab: 'tables' }),
        dataTestId: 'tables',
      },
      topics: {
        icon: Icons.TOPIC_GREY,
        data: t('label.topic-plural'),
        count: entityCounts.topicCount,
        link: getExplorePath({ tab: 'topics' }),
        dataTestId: 'topics',
      },
      dashboards: {
        icon: Icons.DASHBOARD_GREY,
        data: t('label.dashboard-plural'),
        count: entityCounts.dashboardCount,
        link: getExplorePath({ tab: 'dashboards' }),
        dataTestId: 'dashboards',
      },
      pipelines: {
        icon: Icons.PIPELINE_GREY,
        data: t('label.pipeline-plural'),
        count: entityCounts.pipelineCount,
        link: getExplorePath({ tab: 'pipelines' }),
        dataTestId: 'pipelines',
      },
      mlModal: {
        icon: Icons.MLMODAL,
        data: t('label.ml-model-plural'),
        count: entityCounts.mlmodelCount,
        link: getExplorePath({ tab: 'mlmodels' }),
        dataTestId: 'mlmodels',
      },
      containers: {
        icon: Icons.CONTAINER,
        data: t('label.container-plural'),
        count: entityCounts.storageContainerCount,
        link: getExplorePath({ tab: 'containers' }),
        dataTestId: 'containers',
      },
      testSuite: {
        icon: Icons.TEST_SUITE,
        data: t('label.test-suite-plural'),
        count: entityCounts.testSuiteCount,
        link: ROUTES.TEST_SUITES,
        dataTestId: 'test-suite',
      },
      glossaries: {
        icon: Icons.FLAT_FOLDER,
        data: t('label.glossary-plural'),
        count: entityCounts.glossaryCount,
        link: ROUTES.GLOSSARY,
        dataTestId: 'glossaries',
      },
      glossaryTerms: {
        icon: Icons.FLAT_DOC,
        data: t('label.glossary-term-plural'),
        count: entityCounts.glossaryTermCount,
        link: ROUTES.GLOSSARY,
        dataTestId: 'glossary-terms',
      },
    }),
    [entityState]
  );

  return (
    <Card
      className="panel-shadow-color"
      data-testid="data-summary-container"
      id="assetStatsCount">
      <EntityListSkeleton
        isCount
        isLabel
        isSelect
        loading={Boolean(entityCountLoading)}>
        <>
          {Object.values(dataSummary).map((data, index) => (
            <div
              className="tw-flex tw-items-center tw-justify-between"
              data-testid={`${data.dataTestId}-summary`}
              key={index}>
              <div className="tw-flex">
                <SVGIcons
                  alt="icon"
                  className="tw-h-4 tw-w-4 tw-self-center"
                  icon={data.icon}
                />
                {data.link ? (
                  <Link
                    className="tw-font-medium hover:tw-text-primary-hover hover:tw-underline"
                    data-testid={data.dataTestId}
                    to={data.link}>
                    <Button
                      className="tw-text-grey-body hover:tw-text-primary-hover hover:tw-underline"
                      type="text">
                      {data.data}
                    </Button>
                  </Link>
                ) : (
                  <p className="tw-text-grey-body tw-pl-2">{data.data}</p>
                )}
              </div>
              {!isNil(data.count) && getCountBadge(data.count, '', false)}
            </div>
          ))}
        </>
      </EntityListSkeleton>
    </Card>
  );
};

export default MyAssetStats;
