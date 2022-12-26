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
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { checkAirflowStatus } from '../../axiosAPIs/ingestionPipelineAPI';
import { createTestSuites } from '../../axiosAPIs/testAPI';
import RightPanel from '../../components/AddDataQualityTest/components/RightPanel';
import {
  getRightPanelForAddTestSuitePage,
  INGESTION_DATA,
} from '../../components/AddDataQualityTest/rightPanelData';
import TestSuiteIngestion from '../../components/AddDataQualityTest/TestSuiteIngestion';
import SuccessScreen from '../../components/common/success-screen/SuccessScreen';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import IngestionStepper from '../../components/IngestionStepper/IngestionStepper.component';
import {
  STEPS_FOR_ADD_TEST_SUITE,
  TEST_SUITE_STEPPER_BREADCRUMB,
} from '../../constants/TestSuite.constant';
import { FormSubmitType } from '../../enums/form.enum';
import { OwnerType } from '../../enums/user.enum';
import { TestSuite } from '../../generated/tests/testSuite';
import { getCurrentUserId } from '../../utils/CommonUtils';
import { getTestSuitePath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import AddTestSuiteForm from './AddTestSuiteForm';
import { TestSuiteFormDataProps } from './testSuite.interface';

const TestSuiteStepper = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [testSuiteResponse, setTestSuiteResponse] = useState<TestSuite>();
  const [isAirflowRunning, setIsAirflowRunning] = useState<boolean>(false);
  const [addIngestion, setAddIngestion] = useState<boolean>(false);

  const handleAirflowStatusCheck = async (): Promise<void> => {
    try {
      await checkAirflowStatus();
      setIsAirflowRunning(true);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleViewTestSuiteClick = () => {
    history.push(getTestSuitePath(testSuiteResponse?.fullyQualifiedName || ''));
  };

  const onSubmitTestSuite = async (data: TestSuiteFormDataProps) => {
    try {
      const owner = {
        id: getCurrentUserId(),
        type: OwnerType.USER,
      };

      const response = await createTestSuites({ ...data, owner });
      setTestSuiteResponse(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
    setActiveServiceStep(2);
  };

  const RenderSelectedTab = useCallback(() => {
    if (activeServiceStep === 2) {
      return (
        <SuccessScreen
          showIngestionButton
          handleIngestionClick={() => setAddIngestion(true)}
          handleViewServiceClick={handleViewTestSuiteClick}
          isAirflowSetup={isAirflowRunning}
          name={testSuiteResponse?.name || ''}
          state={FormSubmitType.ADD}
          viewServiceText="View Test Suite"
          onCheckAirflowStatus={handleAirflowStatusCheck}
        />
      );
    }

    return <AddTestSuiteForm onSubmit={onSubmitTestSuite} />;
  }, [activeServiceStep, isAirflowRunning]);

  useEffect(() => {
    handleAirflowStatusCheck();
  }, []);

  return (
    <Row
      className="m-t-md"
      data-testid="test-suite-stepper-container"
      gutter={[16, 16]}>
      <Col offset={4} span={12}>
        <Space direction="vertical" size="middle">
          <TitleBreadcrumb titleLinks={TEST_SUITE_STEPPER_BREADCRUMB} />
          {addIngestion ? (
            <TestSuiteIngestion
              testSuite={testSuiteResponse as TestSuite}
              onCancel={() => setAddIngestion(false)}
            />
          ) : (
            <Row className="tw-form-container" gutter={[16, 16]}>
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
      </Col>
      <Col className="m-t-md" data-testid="right-panel" span={6}>
        <RightPanel
          data={
            addIngestion
              ? INGESTION_DATA
              : getRightPanelForAddTestSuitePage(
                  activeServiceStep,
                  testSuiteResponse?.name || ''
                )
          }
        />
      </Col>
    </Row>
  );
};

export default TestSuiteStepper;
