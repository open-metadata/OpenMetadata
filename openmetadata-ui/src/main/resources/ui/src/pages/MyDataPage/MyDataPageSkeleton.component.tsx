/*
 *  Copyright 2026 Collate.
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
import { Grid, Skeleton } from '@openmetadata/ui-core-components';
import { Card } from 'antd';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import './my-data.less';

/**
 * Widget-grid placeholder shown while persona / layout data loads.
 *
 * Intentionally renders only the card grid — not a fake header — so
 * {@link MyDataPage} can always mount {@link CustomiseLandingPageHeader}
 * immediately (skeleton-first pattern). This avoids the extra API round-trip
 * that was blocking LCP on /my-data.
 *
 * Match the eight-column grid used in `MyDataPage` so cards land in roughly
 * the same place a real widget would, avoiding layout shift on reveal.
 */
export const MyDataPageSkeleton = () => {
  return (
    <Grid
      className="layout-row layout-grid p-x-box"
      style={getLayoutGutter(16, 16)}>
      {[0, 1, 2, 3].map((i) => (
        <Grid.Item
          className="layout-column tw:col-span-24 tw:col-span-24 tw:min-[576px]:col-span-24 tw:min-[768px]:col-span-24 tw:min-[992px]:col-span-12 tw:min-[1200px]:col-span-12"
          key={i}>
          <Card className="landing-page-skeleton-card">
            <div className="tw:flex tw:flex-col tw:gap-3">
              {['30%', '90%', '85%', '80%', '70%'].map((width, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <Skeleton height={16} key={index} width={width} />
              ))}
            </div>
          </Card>
        </Grid.Item>
      ))}
    </Grid>
  );
};

export default MyDataPageSkeleton;
