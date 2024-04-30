/*
 *  Copyright 2024 Collate.
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
import { Space, Typography } from 'antd';
import { omit } from 'lodash';
import React from 'react';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import TestIndicator from '../TestIndicator/TestIndicator';
import { TestCaseStatusSummaryIndicatorProps } from './TestCaseStatusSummaryIndicator.interface';

const TestCaseStatusSummaryIndicator = ({
  testCaseStatusCounts,
}: TestCaseStatusSummaryIndicatorProps) => {
  return testCaseStatusCounts ? (
    <Space size={16}>
      {Object.entries(omit(testCaseStatusCounts, ['entityLink', 'total'])).map(
        (test) => (
          <TestIndicator key={test[0]} type={test[0]} value={test[1]} />
        )
      )}
    </Space>
  ) : (
    <Typography.Text data-testid="no-data-placeholder">
      {NO_DATA_PLACEHOLDER}
    </Typography.Text>
  );
};

export default TestCaseStatusSummaryIndicator;
