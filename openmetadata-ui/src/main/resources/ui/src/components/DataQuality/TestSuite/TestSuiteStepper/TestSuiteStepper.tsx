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

import { Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HTTP_STATUS_CODE } from '../../../../constants/Auth.constants';
import {
  STEPS_FOR_ADD_TEST_SUITE,
  TEST_SUITE_STEPPER_BREADCRUMB,
} from '../../../../constants/TestSuite.constant';
import { FormSubmitType } from '../../../../enums/form.enum';
import { OwnerType } from '../../../../enums/user.enum';
import { TestCase } from '../../../../generated/tests/testCase';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  addTestCaseToLogicalTestSuite,
  createTestSuites,
} from '../../../../rest/testAPI';
import { getTestSuitePath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import SuccessScreen from '../../../common/SuccessScreen/SuccessScreen';
import TitleBreadcrumb from '../../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import IngestionStepper from '../../../Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import RightPanel from '../../AddDataQualityTest/components/RightPanel';
import { getRightPanelForAddTestSuitePage } from '../../AddDataQualityTest/rightPanelData';
import TestSuiteIngestion from '../../AddDataQualityTest/TestSuiteIngestion';
import { AddTestCaseList } from '../../AddTestCaseList/AddTestCaseList.component';
import AddTestSuiteForm from '../AddTestSuiteForm/AddTestSuiteForm';

const TestSuiteStepper = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [testSuiteResponse, setTestSuiteResponse] = useState<TestSuite>();
  const [addIngestion, setAddIngestion] = useState(false);

  const handleViewTestSuiteClick = () => {
    navigate(getTestSuitePath(testSuiteResponse?.fullyQualifiedName ?? ''));
  };

  const handleTestSuitNextClick = (data: TestSuite) => {
    setTestSuiteResponse(data);
    setActiveServiceStep(2);
  };

  const onSubmit = async (data: TestCase[]) => {
    const testCaseIds = data.reduce((ids, curr) => {
      return curr.id ? [...ids, curr.id] : ids;
    }, [] as string[]);
    try {
      const owners = [
        {
          id: currentUser?.id ?? '',
          type: OwnerType.USER,
        },
      ];

      const response = await createTestSuites({
        name: testSuiteResponse?.name ?? '',
        description: testSuiteResponse?.description,
        owners,
      });
      setTestSuiteResponse(response);
      await addTestCaseToLogicalTestSuite({
        testCaseIds: testCaseIds,
        testSuiteId: response.id ?? '',
      });
      setActiveServiceStep(3);
    } catch (error) {
      if (
        (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
      ) {
        showErrorToast(
          t('server.entity-already-exist', {
            entity: t('label.test-suite'),
            entityPlural: t('label.test-suite-lowercase-plural'),
            name: testSuiteResponse?.name,
          })
        );
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.create-entity-error', {
            entity: t('label.test-suite-lowercase'),
          })
        );
      }
    }
  };

  const RenderSelectedTab = useCallback(() => {
    if (activeServiceStep === 2) {
      return (
        <AddTestCaseList
          cancelText={t('label.back')}
          onCancel={() => setActiveServiceStep(1)}
          onSubmit={onSubmit}
        />
      );
    } else if (activeServiceStep === 3) {
      return (
        <SuccessScreen
          showIngestionButton
          handleIngestionClick={() => setAddIngestion(true)}
          handleViewServiceClick={handleViewTestSuiteClick}
          name={testSuiteResponse?.name || ''}
          state={FormSubmitType.ADD}
          viewServiceText="View Test Suite"
        />
      );
    }

    return (
      <AddTestSuiteForm
        testSuite={testSuiteResponse}
        onSubmit={handleTestSuitNextClick}
      />
    );
  }, [activeServiceStep, testSuiteResponse, handleTestSuitNextClick]);

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div data-testid="test-suite-stepper-container">
            <TitleBreadcrumb titleLinks={TEST_SUITE_STEPPER_BREADCRUMB} />
            <Space className="m-t-md" direction="vertical" size="middle">
              {addIngestion ? (
                <TestSuiteIngestion
                  testSuite={testSuiteResponse as TestSuite}
                  onCancel={() => setAddIngestion(false)}
                  onViewServiceClick={handleViewTestSuiteClick}
                />
              ) : (
                <Row className="p-sm" gutter={[16, 16]}>
                  <Col span={24}>
                    <Typography.Title
                      className="heading"
                      data-testid="header"
                      level={5}>
                      {t('label.add-entity', {
                        entity: t('label.test-suite'),
                      })}
                    </Typography.Title>
                  </Col>
                  <Col span={24}>
                    <IngestionStepper
                      activeStep={activeServiceStep}
                      steps={STEPS_FOR_ADD_TEST_SUITE}
                    />
                  </Col>
                  <Col span={24}>{RenderSelectedTab()}</Col>
                </Row>
              )}
            </Space>
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
            data={getRightPanelForAddTestSuitePage(
              activeServiceStep,
              testSuiteResponse?.name || ''
            )}
          />
        ),
        className: 'content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default TestSuiteStepper;
