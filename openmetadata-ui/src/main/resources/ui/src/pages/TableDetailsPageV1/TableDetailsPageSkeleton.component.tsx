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
import { Card, Col, Row, Skeleton, Space } from 'antd';

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
 *  - Cheap: pure antd `Skeleton`, no images / SVGs / theme tokens. The cost we pay for the
 *    perception win is one extra render of placeholder shapes.
 */
export const TableDetailsPageSkeleton = () => {
  return (
    <Row className="entity-details-page-container" gutter={[0, 12]}>
      <Col className="p-x-lg p-t-md" span={24}>
        <Skeleton
          active
          paragraph={{ rows: 1, width: ['30%'] }}
          title={{ width: '15%' }}
        />
      </Col>
      <Col className="p-x-lg" span={24}>
        <Card className="data-asset-header-skeleton">
          <Row align="middle" gutter={16} justify="space-between">
            <Col flex="auto">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Skeleton.Avatar active shape="square" size="large" />
                <Skeleton
                  active
                  paragraph={{ rows: 1, width: ['60%'] }}
                  title={{ width: '40%' }}
                />
              </Space>
            </Col>
            <Col flex="240px">
              <Space>
                <Skeleton.Button active shape="round" size="small" />
                <Skeleton.Button active shape="round" size="small" />
                <Skeleton.Button active shape="round" size="small" />
              </Space>
            </Col>
          </Row>
        </Card>
      </Col>
      <Col className="p-x-lg" span={24}>
        <Space size={24}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton.Button active key={i} size="small" />
          ))}
        </Space>
      </Col>
      <Col className="p-x-lg" span={24}>
        <Card>
          <Skeleton
            active
            paragraph={{
              rows: 6,
              width: ['90%', '85%', '80%', '88%', '75%', '70%'],
            }}
            title={{ width: '20%' }}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default TableDetailsPageSkeleton;
