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
import { Skeleton } from '@openmetadata/ui-core-components';
import { Card, Col, Row, Space } from 'antd';

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
    <Row
      className="entity-details-page-container"
      data-testid="loader"
      gutter={[0, 12]}>
      <Col className="p-x-lg p-t-md" span={24}>
        <div className="tw:flex tw:flex-col tw:gap-3">
          <Skeleton height={16} width="15%" />
          <Skeleton height={16} width="30%" />
        </div>
      </Col>
      <Col className="p-x-lg" span={24}>
        <Card className="data-asset-header-skeleton">
          <Row align="middle" gutter={16} justify="space-between">
            <Col flex="auto">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Skeleton height={40} variant="rounded" width={40} />
                <div className="tw:flex tw:flex-col tw:gap-3">
                  <Skeleton height={16} width="40%" />
                  <Skeleton height={16} width="60%" />
                </div>
              </Space>
            </Col>
            <Col flex="240px">
              <Space>
                <Skeleton
                  className="tw:rounded-full"
                  height={24}
                  variant="rounded"
                  width={48}
                />
                <Skeleton
                  className="tw:rounded-full"
                  height={24}
                  variant="rounded"
                  width={48}
                />
                <Skeleton
                  className="tw:rounded-full"
                  height={24}
                  variant="rounded"
                  width={48}
                />
              </Space>
            </Col>
          </Row>
        </Card>
      </Col>
      <Col className="p-x-lg" span={24}>
        <Space size={24}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton height={24} key={i} variant="rounded" width={48} />
          ))}
        </Space>
      </Col>
      <Col className="p-x-lg" span={24}>
        <Card>
          <div className="tw:flex tw:flex-col tw:gap-3">
            <Skeleton height={16} width="20%" />
            {CONTENT_ROW_WIDTHS.map((width) => (
              <Skeleton height={16} key={width} width={width} />
            ))}
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default TableDetailsPageSkeleton;
