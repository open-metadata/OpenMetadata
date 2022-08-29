/*
 *  Copyright 2022 Collate
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

import { Col } from 'antd';
import { orderBy } from 'lodash';
import React from 'react';
import { TestCase } from '../../generated/tests/testCase';
import { Paging } from '../../generated/type/paging';
import DataQualityTab from '../ProfilerDashboard/component/DataQualityTab';
import TestCaseCommonTabContainer from '../TestCaseCommonTabContainer/TestCaseCommonTabContainer.component';

const TestCasesTab = ({
  testCases,
  testCasesPaging,
  currentPage,
  onTestUpdate,
  testCasePageHandler,
}: {
  testCases: Array<TestCase>;
  testCasesPaging: Paging;
  currentPage: number;
  onTestUpdate: () => void;
  testCasePageHandler: (
    cursorValue: string | number,
    activePage?: number | undefined
  ) => void;
}) => {
  const sortedTestCases = orderBy(testCases || [], ['name'], 'asc');

  return (
    <TestCaseCommonTabContainer
      isPaging
      buttonName="Add Test"
      currentPage={currentPage}
      paging={testCasesPaging}
      showButton={false}
      testCasePageHandler={testCasePageHandler}>
      <Col span={24}>
        <DataQualityTab
          testCases={sortedTestCases}
          onTestUpdate={onTestUpdate}
        />
      </Col>
    </TestCaseCommonTabContainer>
  );
};

export default TestCasesTab;
