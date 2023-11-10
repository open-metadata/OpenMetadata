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
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import RightPanel from '../../components/AddDataQualityTest/components/RightPanel';
import { INGESTION_DATA } from '../../components/AddDataQualityTest/rightPanelData';
import TestSuiteIngestion from '../../components/AddDataQualityTest/TestSuiteIngestion';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import Loader from '../../components/Loader/Loader';
import { getTableTabPath } from '../../constants/constants';
import { EntityTabs } from '../../enums/entity.enum';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestSuite } from '../../generated/tests/testSuite';
import { getIngestionPipelineByFqn } from '../../rest/ingestionPipelineAPI';
import { getTestSuiteByName } from '../../rest/testAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getDataQualityPagePath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const TestSuiteIngestionPage = () => {
  const { fqn: testSuiteFQN, ingestionFQN } =
    useParams<{ fqn: string; ingestionFQN: string }>();
  const { t } = useTranslation();

  const history = useHistory();
  const [isLoading, setIsLoading] = useState(true);
  const [testSuite, setTestSuite] = useState<TestSuite>();
  const [ingestionPipeline, setIngestionPipeline] =
    useState<IngestionPipeline>();
  const [slashedBreadCrumb, setSlashedBreadCrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const fetchIngestionByName = async () => {
    setIsLoading(true);
    try {
      const response = await getIngestionPipelineByFqn(ingestionFQN);

      setIngestionPipeline(response);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.ingestion-workflow-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTestSuiteByName = async () => {
    setIsLoading(true);
    try {
      const response = await getTestSuiteByName(testSuiteFQN, {
        fields: 'owner',
      });
      setSlashedBreadCrumb([
        {
          name: t('label.test-suite-plural'),
          url: getDataQualityPagePath(),
        },
        {
          name: getEntityName(response.executableEntityReference),
          url: getTableTabPath(
            response.executableEntityReference?.fullyQualifiedName ?? '',
            EntityTabs.PROFILER
          ),
        },
        {
          name: `${ingestionFQN ? t('label.edit') : t('label.add')} ${t(
            'label.ingestion'
          )}`,
          url: '',
        },
      ]);
      setTestSuite(response);

      if (ingestionFQN) {
        await fetchIngestionByName();
      }
    } catch (error) {
      setTestSuite(undefined);
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.test-suite'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBtn = () => {
    history.goBack();
  };

  useEffect(() => {
    fetchTestSuiteByName();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  if (isUndefined(testSuite)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <ResizablePanels
      firstPanel={{
        children: (
          <div className="max-width-md w-9/10 service-form-container">
            <TitleBreadcrumb titleLinks={slashedBreadCrumb} />
            <div className="m-t-md">
              <TestSuiteIngestion
                ingestionPipeline={ingestionPipeline}
                testSuite={testSuite}
                onCancel={handleCancelBtn}
              />
            </div>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.test-suite'),
      })}
      secondPanel={{
        children: <RightPanel data={INGESTION_DATA} />,
        className: 'p-md service-doc-panel',
        minWidth: 60,
        overlay: {
          displayThreshold: 200,
          header: t('label.setup-guide'),
          rotation: 'counter-clockwise',
        },
      }}
    />
  );
};

export default TestSuiteIngestionPage;
