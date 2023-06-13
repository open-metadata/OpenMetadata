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

import { Card, Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import RightPanel from 'components/AddDataQualityTest/components/RightPanel';
import {
  getRightPanelForAddTestSuitePage,
  INGESTION_DATA,
} from 'components/AddDataQualityTest/rightPanelData';
import TestSuiteIngestion from 'components/AddDataQualityTest/TestSuiteIngestion';
import ResizablePanels from 'components/common/ResizablePanels/ResizablePanels';
import SuccessScreen from 'components/common/success-screen/SuccessScreen';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import IngestionStepper from 'components/IngestionStepper/IngestionStepper.component';
import { HTTP_STATUS_CODE } from 'constants/auth.constants';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { createTestSuites } from 'rest/testAPI';
import { getTestSuitePath } from 'utils/RouterUtils';
import {
  STEPS_FOR_ADD_TEST_SUITE,
  TEST_SUITE_STEPPER_BREADCRUMB,
} from '../../constants/TestSuite.constant';
import { FormSubmitType } from '../../enums/form.enum';
import { OwnerType } from '../../enums/user.enum';
import { TestSuite } from '../../generated/tests/testSuite';
import { getCurrentUserId } from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import AddTestSuiteForm from './AddTestSuiteForm';
import { TestSuiteFormDataProps } from './testSuite.interface';

const TestSuiteStepper = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [testSuiteResponse, setTestSuiteResponse] = useState<TestSuite>();

  const [addIngestion, setAddIngestion] = useState<boolean>(false);

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
      setActiveServiceStep(2);
    } catch (error) {
      if (
        (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
      ) {
        showErrorToast(
          t('server.entity-already-exist', {
            entity: t('label.test-suite'),
            entityPlural: t('label.test-suite-lowercase-plural'),
            name: data.name,
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

    return <AddTestSuiteForm onSubmit={onSubmitTestSuite} />;
  }, [activeServiceStep]);

  return (
    <ResizablePanels
      firstPanel={{
        children: (
          <div
            className="max-width-md w-9/10 service-form-container"
            data-testid="test-suite-stepper-container">
            <TitleBreadcrumb titleLinks={TEST_SUITE_STEPPER_BREADCRUMB} />
            <Space className="m-t-md" direction="vertical" size="middle">
              {addIngestion ? (
                <TestSuiteIngestion
                  testSuite={testSuiteResponse as TestSuite}
                  onCancel={() => setAddIngestion(false)}
                />
              ) : (
                <Card className="p-sm">
                  <Row gutter={[16, 16]}>
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
                </Card>
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
            data={
              addIngestion
                ? INGESTION_DATA
                : getRightPanelForAddTestSuitePage(
                    activeServiceStep,
                    testSuiteResponse?.name || ''
                  )
            }
          />
        ),
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

export default TestSuiteStepper;
