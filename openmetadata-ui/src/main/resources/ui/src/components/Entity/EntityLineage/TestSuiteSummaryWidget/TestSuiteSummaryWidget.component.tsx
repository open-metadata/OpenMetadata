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
import classNames from 'classnames';
import { TestSummary } from '../../../../generated/tests/testCase';

const TestSuiteSummaryWidget = ({
  summary,
  isLoading,
  size = 'medium',
}: {
  summary?: TestSummary;
  isLoading?: boolean;
  size?: 'medium' | 'small';
}) => {
  if (isLoading) {
    return <Skeleton.Button active data-tesid="loader" size="small" />;
  }

  return (
    <div className="d-flex justify-end">
      <div
        className={classNames(`profiler-item green`, size)}
        data-testid="test-passed">
        <div className="font-medium" data-testid="test-passed-value">
          {summary?.success ?? 0}
        </div>
      </div>
      <div
        className={classNames(`profiler-item amber`, size)}
        data-testid="test-aborted">
        <div className="font-medium" data-testid="test-aborted-value">
          {summary?.aborted ?? 0}
        </div>
      </div>
      <div
        className={classNames(`profiler-item red`, size)}
        data-testid="test-failed">
        <div className="font-medium" data-testid="test-failed-value">
          {summary?.failed ?? 0}
        </div>
      </div>
    </div>
  );
};

export default TestSuiteSummaryWidget;
