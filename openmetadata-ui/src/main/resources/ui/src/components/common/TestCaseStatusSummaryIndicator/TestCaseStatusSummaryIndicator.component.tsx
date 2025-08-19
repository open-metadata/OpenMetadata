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
import { Tooltip } from '../AntdCompat';;
import { omit, startCase } from 'lodash';
import Qs from 'qs';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { useFqn } from '../../../hooks/useFqn';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { TableProfilerTab } from '../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import TestIndicator from '../TestIndicator/TestIndicator';
import { TestCaseStatusSummaryIndicatorProps } from './TestCaseStatusSummaryIndicator.interface';

const TestCaseStatusSummaryIndicator = ({
  testCaseStatusCounts,
}: TestCaseStatusSummaryIndicatorProps) => {
  const { fqn } = useFqn();

  const redirectPath = useMemo(
    () => ({
      pathname: getEntityDetailsPath(
        EntityType.TABLE,
        fqn,
        EntityTabs.PROFILER
      ),
      search: Qs.stringify({
        activeTab: TableProfilerTab.DATA_QUALITY,
      }),
    }),
    [fqn]
  );

  return testCaseStatusCounts ? (
    <Space size={16}>
      {Object.entries(
        omit(testCaseStatusCounts, ['entityLink', 'total', 'queued'])
      ).map((test) => (
        <Tooltip key={test[0]} title={startCase(test[0])}>
          <Link data-testid={test[0]} to={redirectPath}>
            <TestIndicator type={test[0]} value={test[1]} />
          </Link>
        </Tooltip>
      ))}
    </Space>
  ) : (
    <Typography.Text data-testid="no-data-placeholder">
      {NO_DATA_PLACEHOLDER}
    </Typography.Text>
  );
};

export default TestCaseStatusSummaryIndicator;
