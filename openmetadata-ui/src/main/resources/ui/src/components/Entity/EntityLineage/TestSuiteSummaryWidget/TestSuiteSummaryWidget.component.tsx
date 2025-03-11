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
import { Skeleton } from 'antd';
import React from 'react';
import { TestSummary } from '../../../../generated/tests/testCase';

const TestSuiteSummaryWidget = ({
  summary,
  isLoading,
}: {
  summary?: TestSummary;
  isLoading?: boolean;
}) => {
  if (isLoading) {
    return <Skeleton.Input active data-tesid="loader" />;
  }

  return (
    <div className="d-flex justify-end">
      <div className="profiler-item green" data-testid="test-passed">
        <div className="font-medium" data-testid="test-passed-value">
          {summary?.success ?? 0}
        </div>
      </div>
      <div className="profiler-item amber" data-testid="test-aborted">
        <div className="font-medium" data-testid="test-aborted-value">
          {summary?.aborted ?? 0}
        </div>
      </div>
      <div className="profiler-item red" data-testid="test-failed">
        <div className="font-medium" data-testid="test-failed-value">
          {summary?.failed ?? 0}
        </div>
      </div>
    </div>
  );
};

export default TestSuiteSummaryWidget;
