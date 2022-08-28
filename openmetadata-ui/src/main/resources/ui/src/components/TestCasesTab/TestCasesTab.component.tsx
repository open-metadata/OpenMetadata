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
  testCasePageHandler,
}: {
  testCases: Array<TestCase>;
  testCasesPaging: Paging;
  currentPage: number;
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
      testCasePageHandler={testCasePageHandler}>
      <>
        <Col span={24}>
          <DataQualityTab testCases={sortedTestCases} />
        </Col>
      </>
    </TestCaseCommonTabContainer>
  );
};

export default TestCasesTab;
