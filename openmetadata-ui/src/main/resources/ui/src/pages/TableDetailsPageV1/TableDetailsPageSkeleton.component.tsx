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
import { Box, Grid, Skeleton } from '@openmetadata/ui-core-components';
import { Card } from 'antd';
import { getLayoutGutter } from '../../utils/common/layout.utils';

const CONTENT_ROW_WIDTHS = ['90%', '85%', '80%', '88%', '75%', '70%'];

/**
 * Above-the-fold placeholder for an entity detail page while the initial table-fetch is
 * resolving. Modelled on {@link TableDetailsPageV1} but generic enough that future entity
 * pages (Dashboard, Container, …) can reuse it.
 *
 * Goals:
 *  - First paint shows the entity-page shape (breadcrumbs, title row, tab bar, content
 *    placeholder), not a centered spinner.
 *  - The skeleton's vertical rhythm roughly matches the real header so swapping in the real
 *    {@code DataAssetsHeader} doesn't shift content below.
 *  - Cheap: pure core `Skeleton`, no images / SVGs / theme tokens. The cost we pay for the
 *    perception win is one extra render of placeholder shapes.
 */
export const TableDetailsPageSkeleton = () => {
  return (
    <Grid
      className="layout-row layout-grid entity-details-page-container"
      data-testid="loader"
      style={{ ...getLayoutGutter(0, 12) }}>
      <Grid.Item className="layout-column p-x-lg p-t-md" span={24}>
        <div className="tw:flex tw:flex-col tw:gap-6">
          <Skeleton height={16} width="15%" />
          <Skeleton height={16} width="30%" />
        </div>
      </Grid.Item>
      <Grid.Item className="layout-column p-x-lg" span={24}>
        <Card className="data-asset-header-skeleton">
          <Box
            align="center"
            className="layout-row"
            justify="between"
            style={{ ...getLayoutGutter(16) }}
            wrap="wrap">
            <Box className="layout-column tw:block" style={{ flex: 'auto' }}>
              <Box
                inline
                align="stretch"
                className="layout-space"
                direction="col"
                gap={2}
                itemClassName="layout-space-item"
                style={{ width: '100%' }}>
                <Skeleton height={40} variant="rounded" width={40} />
                <div className="tw:flex tw:flex-col tw:gap-6">
                  <Skeleton height={16} width="40%" />
                  <Skeleton height={16} width="60%" />
                </div>
              </Box>
            </Box>
            <Box
              className="layout-column tw:block"
              style={{ flex: `0 0 ${'240px'}` }}>
              <Box
                inline
                align="center"
                className="layout-space layout-space-horizontal"
                gap={2}
                itemClassName="layout-space-item">
                <Skeleton
                  className="tw:rounded-full"
                  height={36}
                  variant="rounded"
                  width={72}
                />
                <Skeleton
                  className="tw:rounded-full"
                  height={36}
                  variant="rounded"
                  width={72}
                />
                <Skeleton
                  className="tw:rounded-full"
                  height={36}
                  variant="rounded"
                  width={72}
                />
              </Box>
            </Box>
          </Box>
        </Card>
      </Grid.Item>
      <Grid.Item className="layout-column p-x-lg" span={24}>
        <Box
          inline
          align="center"
          className="layout-space layout-space-horizontal"
          gap={6}
          itemClassName="layout-space-item">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton height={36} key={i} variant="rounded" width={72} />
          ))}
        </Box>
      </Grid.Item>
      <Grid.Item className="layout-column p-x-lg" span={24}>
        <Card>
          <div className="tw:flex tw:flex-col tw:gap-4">
            <Skeleton className="tw:mb-2" height={16} width="20%" />
            {CONTENT_ROW_WIDTHS.map((width) => (
              <Skeleton height={16} key={width} width={width} />
            ))}
          </div>
        </Card>
      </Grid.Item>
    </Grid>
  );
};

export default TableDetailsPageSkeleton;
