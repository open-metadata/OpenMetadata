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
import { Form, Input } from 'antd';
import { AxiosError } from 'axios';
import { isUndefined, uniq } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import RightPanel from '../../components/DataQuality/AddDataQualityTest/components/RightPanel';
import { TEST_SUITE_INGESTION_PAGE_DATA } from '../../components/DataQuality/AddDataQualityTest/rightPanelData';
import TestSuiteIngestion from '../../components/DataQuality/AddDataQualityTest/TestSuiteIngestion';
import { AddTestCaseList } from '../../components/DataQuality/AddTestCaseList/AddTestCaseList.component';
import IngestionStepper from '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import { getEntityDetailsPath } from '../../constants/constants';
import { STEPS_FOR_ADD_TEST_SUITE_PIPELINE } from '../../constants/TestSuite.constant';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCase } from '../../generated/tests/testCase';
import { TestSuite } from '../../generated/tests/testSuite';
import { useFqn } from '../../hooks/useFqn';
import { getIngestionPipelineByFqn } from '../../rest/ingestionPipelineAPI';
import { getTestSuiteByName } from '../../rest/testAPI';
import { getEntityName } from '../../utils/EntityUtils';
import { getDataQualityPagePath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const TestSuiteIngestionPage = () => {
  const { fqn: testSuiteFQN, ingestionFQN } = useFqn();
  const { t } = useTranslation();

  const history = useHistory();
  const [isLoading, setIsLoading] = useState(true);
  const [testSuite, setTestSuite] = useState<TestSuite>();
  const [ingestionPipeline, setIngestionPipeline] =
    useState<IngestionPipeline>();
  const [slashedBreadCrumb, setSlashedBreadCrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [testCases, setTestCases] = useState<string[]>([]);
  const [pipelineName, setPipelineName] = useState<string>();

  const fetchIngestionByName = async () => {
    setIsLoading(true);
    try {
      const response = await getIngestionPipelineByFqn(ingestionFQN);
      setTestCases(response.sourceConfig.config?.testCases ?? []);
      setPipelineName(response.displayName);
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
          url: getEntityDetailsPath(
            EntityType.TABLE,
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

  const handleAddTestSubmit = (testCases: TestCase[]) => {
    const testCaseNames = testCases.map((testCase) => testCase.name);
    setTestCases((pre) => uniq([...pre, ...testCaseNames]));
    setActiveServiceStep(2);
  };

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPipelineName(() => e.target.value);
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
              <IngestionStepper
                activeStep={activeServiceStep}
                steps={STEPS_FOR_ADD_TEST_SUITE_PIPELINE}
              />
              <div className="m-t-md">
                {activeServiceStep === 1 && (
                  <Form
                    initialValues={{ name: pipelineName }}
                    layout="vertical">
                    <Form.Item label={t('label.name')} name="name">
                      <Input
                        data-testid="pipeline-name"
                        placeholder={t('label.enter-entity', {
                          entity: t('label.name'),
                        })}
                        value={pipelineName}
                        onChange={onNameChange}
                      />
                    </Form.Item>
                    <Form.Item label={t('label.test-case')}>
                      <AddTestCaseList
                        filters={`testSuite.fullyQualifiedName:${testSuiteFQN}`}
                        selectedTest={testCases}
                        submitText={t('label.next')}
                        onCancel={handleCancelBtn}
                        onSubmit={handleAddTestSubmit}
                      />
                    </Form.Item>
                  </Form>
                )}
                {activeServiceStep === 2 && (
                  <TestSuiteIngestion
                    ingestionPipeline={ingestionPipeline}
                    pipelineName={pipelineName}
                    testCaseNames={testCases}
                    testSuite={testSuite}
                    onCancel={() => setActiveServiceStep(1)}
                  />
                )}
              </div>
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
        children: (
          <RightPanel
            data={TEST_SUITE_INGESTION_PAGE_DATA[activeServiceStep - 1]}
          />
        ),
        className: 'p-md p-t-xl',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default TestSuiteIngestionPage;
