/*
 *  Copyright 2023 Collate.
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
import { Grid } from '@openmetadata/ui-core-components';
import { getLayoutGutter } from '../../../utils/common/layout.utils';

import { useDataInsightProvider } from '../../../pages/DataInsightPage/DataInsightProvider';
import DailyActiveUsersChart from '../DailyActiveUsersChart';
import PageViewsByEntitiesChart from '../PageViewsByEntitiesChart';
import TopActiveUsers from '../TopActiveUsers';
import TopViewEntities from '../TopViewEntities';

const AppAnalyticsTab = () => {
  const { chartFilter, selectedDaysFilter } = useDataInsightProvider();

  return (
    <Grid className="layout-row layout-grid" style={getLayoutGutter(16, 16)}>
      <Grid.Item className="layout-column" span={24}>
        <TopViewEntities chartFilter={chartFilter} />
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <PageViewsByEntitiesChart
          chartFilter={chartFilter}
          selectedDays={selectedDaysFilter}
        />
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <DailyActiveUsersChart
          chartFilter={chartFilter}
          selectedDays={selectedDaysFilter}
        />
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <TopActiveUsers chartFilter={chartFilter} />
      </Grid.Item>
    </Grid>
  );
};

export default AppAnalyticsTab;
