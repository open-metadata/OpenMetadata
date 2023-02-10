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

import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import { isUndefined, toString } from 'lodash';
import { default as React, useCallback, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { createTestCase, createTestSuites } from 'rest/testAPI';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTableTabPath,
} from '../../constants/constants';
import { STEPS_FOR_ADD_TEST_CASE } from '../../constants/profiler.constant';
import { FqnPart } from '../../enums/entity.enum';
import { FormSubmitType } from '../../enums/form.enum';
import { PageLayoutType } from '../../enums/layout.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { ProfilerDashboardType } from '../../enums/table.enum';
import { OwnerType } from '../../enums/user.enum';
import { TestCase } from '../../generated/tests/testCase';
import { TestSuite } from '../../generated/tests/testSuite';
import {
  getCurrentUserId,
  getEntityName,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { getTestSuitePath } from '../../utils/RouterUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getDecodedFqn } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import PageLayout from '../containers/PageLayout';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import {
  AddDataQualityTestProps,
  SelectTestSuiteType,
} from './AddDataQualityTest.interface';
import RightPanel from './components/RightPanel';
import SelectTestSuite from './components/SelectTestSuite';
import TestCaseForm from './components/TestCaseForm';
import { addTestSuiteRightPanel, INGESTION_DATA } from './rightPanelData';
import TestSuiteIngestion from './TestSuiteIngestion';

const AddDataQualityTestV1: React.FC<AddDataQualityTestProps> = ({
  table,
}: AddDataQualityTestProps) => {
  const { entityTypeFQN, dashboardType } = useParams<Record<string, string>>();
  const isColumnFqn = dashboardType === ProfilerDashboardType.COLUMN;
  const history = useHistory();
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [selectedTestSuite, setSelectedTestSuite] =
    useState<SelectTestSuiteType>();
  const [testCaseData, setTestCaseData] = useState<TestCase>();
  const [testSuiteData, setTestSuiteData] = useState<TestSuite>();
  const [testCaseRes, setTestCaseRes] = useState<TestCase>();
  const [addIngestion, setAddIngestion] = useState(false);

  const breadcrumb = useMemo(() => {
    const {
      service,
      serviceType,
      database,
      databaseSchema,
      fullyQualifiedName = '',
    } = table;

    const data: TitleBreadcrumbProps['titleLinks'] = [
      {
        name: service?.name || '',
        url: service
          ? getServiceDetailsPath(
              service.name || '',
              ServiceCategory.DATABASE_SERVICES
            )
          : '',
        imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
      },
      {
        name: getPartialNameFromTableFQN(fullyQualifiedName, [
          FqnPart.Database,
        ]),
        url: getDatabaseDetailsPath(database?.fullyQualifiedName || ''),
      },
      {
        name: getPartialNameFromTableFQN(fullyQualifiedName, [FqnPart.Schema]),
        url: getDatabaseSchemaDetailsPath(
          databaseSchema?.fullyQualifiedName || ''
        ),
      },
      {
        name: getEntityName(table),
        url: getTableTabPath(entityTypeFQN, 'profiler'),
      },
    ];

    if (isColumnFqn) {
      const colVal = [
        {
          name: getPartialNameFromTableFQN(getDecodedFqn(entityTypeFQN), [
            FqnPart.NestedColumn,
          ]),
          url: getTableTabPath(entityTypeFQN, 'profiler'),
        },
        {
          name: 'Add Column Test',
          url: '',
          activeTitle: true,
        },
      ];
      data.push(...colVal);
    } else {
      data.push({
        name: 'Add Table Test',
        url: '',
        activeTitle: true,
      });
    }

    return data;
  }, [table, entityTypeFQN, isColumnFqn]);

  const handleViewTestSuiteClick = () => {
    history.push(
      getTestSuitePath(
        selectedTestSuite?.data?.fullyQualifiedName ||
          testSuiteData?.fullyQualifiedName ||
          ''
      )
    );
  };

  const handleCancelClick = () => {
    setActiveServiceStep((pre) => pre - 1);
  };

  const handleTestCaseBack = (testCase: TestCase) => {
    setTestCaseData(testCase);
    handleCancelClick();
  };

  const handleSelectTestSuite = (data: SelectTestSuiteType) => {
    setSelectedTestSuite(data);
    setActiveServiceStep(2);
  };

  const handleFormSubmit = async (data: TestCase) => {
    setTestCaseData(data);
    if (isUndefined(selectedTestSuite)) {
      return;
    }
    try {
      const { parameterValues, testDefinition, name, entityLink, description } =
        data;
      const { isNewTestSuite, data: selectedSuite } = selectedTestSuite;
      const owner = {
        id: getCurrentUserId(),
        type: OwnerType.USER,
      };
      const testCasePayload: TestCase = {
        name,
        description,
        entityLink,
        parameterValues,
        owner,
        testDefinition,
        testSuite: toString(selectedSuite?.fullyQualifiedName),
      };
      if (isNewTestSuite && isUndefined(testSuiteData)) {
        const testSuitePayload = {
          name: selectedTestSuite.name || '',
          description: selectedTestSuite.description || '',
          owner,
        };
        const testSuiteResponse = await createTestSuites(testSuitePayload);
        testCasePayload.testSuite.id = testSuiteResponse.id || '';
        setTestSuiteData(testSuiteResponse);
      } else if (!isUndefined(testSuiteData)) {
        testCasePayload.testSuite.id = testSuiteData.id || '';
      }

      const testCaseResponse = await createTestCase(testCasePayload);
      setActiveServiceStep(3);
      setTestCaseRes(testCaseResponse);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const RenderSelectedTab = useCallback(() => {
    if (activeServiceStep === 2) {
      return (
        <TestCaseForm
          initialValue={testCaseData}
          table={table}
          onCancel={handleTestCaseBack}
          onSubmit={handleFormSubmit}
        />
      );
    } else if (activeServiceStep > 2) {
      const successName = selectedTestSuite?.isNewTestSuite
        ? `${testSuiteData?.name} & ${testCaseRes?.name}`
        : testCaseRes?.name || 'Test case';

      const successMessage = selectedTestSuite?.isNewTestSuite ? undefined : (
        <span>
          <span className="tw-mr-1 tw-font-semibold">{`"${successName}"`}</span>
          <span>
            {`${t('message.has-been-created-successfully')}.`}
            &nbsp;
            {t('message.this-will-pick-in-next-run')}
          </span>
        </span>
      );

      return (
        <SuccessScreen
          handleIngestionClick={() => setAddIngestion(true)}
          handleViewServiceClick={handleViewTestSuiteClick}
          name={successName}
          showIngestionButton={selectedTestSuite?.isNewTestSuite || false}
          state={FormSubmitType.ADD}
          successMessage={successMessage}
          viewServiceText="View Test Suite"
        />
      );
    }

    return (
      <SelectTestSuite
        initialValue={selectedTestSuite}
        onSubmit={handleSelectTestSuite}
      />
    );
  }, [activeServiceStep, testCaseRes]);

  return (
    <PageLayout
      classes="tw-max-w-full-hd tw-h-full tw-pt-4"
      header={<TitleBreadcrumb titleLinks={breadcrumb} />}
      layout={PageLayoutType['2ColRTL']}
      rightPanel={
        <RightPanel
          data={
            addIngestion
              ? INGESTION_DATA
              : addTestSuiteRightPanel(
                  activeServiceStep,
                  selectedTestSuite?.isNewTestSuite,
                  {
                    testCase: testCaseData?.name || '',
                    testSuite: testSuiteData?.name || '',
                  }
                )
          }
        />
      }>
      {addIngestion ? (
        <TestSuiteIngestion
          testSuite={
            selectedTestSuite?.isNewTestSuite
              ? (testSuiteData as TestSuite)
              : (selectedTestSuite?.data as TestSuite)
          }
          onCancel={() => setAddIngestion(false)}
        />
      ) : (
        <Row className="tw-form-container" gutter={[16, 16]}>
          <Col span={24}>
            <Typography.Paragraph
              className="tw-heading tw-text-base"
              data-testid="header">
              {`Add ${isColumnFqn ? 'Column' : 'Table'} Test`}
            </Typography.Paragraph>
          </Col>
          <Col span={24}>
            <IngestionStepper
              activeStep={activeServiceStep}
              steps={STEPS_FOR_ADD_TEST_CASE}
            />
          </Col>
          <Col span={24}>{RenderSelectedTab()}</Col>
        </Row>
      )}
    </PageLayout>
  );
};

export default AddDataQualityTestV1;
