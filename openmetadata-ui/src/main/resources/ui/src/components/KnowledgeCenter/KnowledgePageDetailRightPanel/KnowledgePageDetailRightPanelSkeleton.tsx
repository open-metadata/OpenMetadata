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
import { Col, Row, Skeleton, Space } from 'antd';
import { uniqueId } from 'lodash';

const KnowledgePageDetailRightPanelSkeleton = () => {
  return (
    <div className="knowledge-page-right-panel">
      <Skeleton
        active
        avatar
        className="m-b-lg"
        paragraph={{ rows: 2 }}
        title={false}
      />

      <Row gutter={[0, 24]}>
        {Array.from({ length: 3 }).map(() => (
          <Col key={uniqueId()} span={24}>
            <Space direction="vertical">
              <Skeleton
                active
                paragraph={{ rows: 1, width: 100 }}
                title={false}
              />
              <Skeleton.Button active size="default" />
            </Space>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default KnowledgePageDetailRightPanelSkeleton;
