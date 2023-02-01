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
import RightPanel from 'components/AddDataQualityTest/components/RightPanel';
import { INGESTION_DATA } from 'components/AddDataQualityTest/rightPanelData';
import TestSuiteIngestion from 'components/AddDataQualityTest/TestSuiteIngestion';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayout from 'components/containers/PageLayout';
import Loader from 'components/Loader/Loader';
import { t } from 'i18next';
import { isUndefined, startCase } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getIngestionPipelineByFqn } from 'rest/ingestionPipelineAPI';
import { getTestSuiteByName } from 'rest/testAPI';
import { ROUTES } from '../../constants/constants';
import { PageLayoutType } from '../../enums/layout.enum';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestSuite } from '../../generated/tests/testSuite';
import jsonData from '../../jsons/en';
import { getTestSuitePath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const TestSuiteIngestionPage = () => {
  const { testSuiteFQN, ingestionFQN } = useParams<Record<string, string>>();

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
        jsonData['api-error-messages']['fetch-ingestion-error']
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
          url: ROUTES.TEST_SUITES,
        },
        {
          name: startCase(response.displayName || response.name),
          url: getTestSuitePath(response.fullyQualifiedName || ''),
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
        jsonData['api-error-messages']['fetch-test-suite-error']
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBtn = () => {
    history.push(getTestSuitePath(testSuiteFQN || ''));
  };

  useEffect(() => {
    fetchTestSuiteByName();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  if (isUndefined(testSuite)) {
    return (
      <ErrorPlaceHolder>
        <p>{t('label.no-data-found')}</p>
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageContainerV1>
      <div className="tw-self-center">
        <PageLayout
          classes="tw-max-w-full-hd tw-h-full tw-pt-4"
          header={<TitleBreadcrumb titleLinks={slashedBreadCrumb} />}
          layout={PageLayoutType['2ColRTL']}
          rightPanel={<RightPanel data={INGESTION_DATA} />}>
          <TestSuiteIngestion
            ingestionPipeline={ingestionPipeline}
            testSuite={testSuite}
            onCancel={handleCancelBtn}
          />
        </PageLayout>
      </div>
    </PageContainerV1>
  );
};

export default TestSuiteIngestionPage;
