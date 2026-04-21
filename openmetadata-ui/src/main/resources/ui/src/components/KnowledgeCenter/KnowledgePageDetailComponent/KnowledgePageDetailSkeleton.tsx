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
import { Col, Row, Skeleton } from 'antd';

const KnowledgePageDetailSkeleton = () => {
  return (
    <Row className="knowledge-page-layout-grid">
      <Col span={24}>
        <Row wrap={false}>
          <Col className="knowledge-page-layout-content" flex="auto">
            <div className="content-container m-b-md">
              <Skeleton.Input active block className="rounded-4" size="large" />
              <Skeleton
                active
                className="m-t-sm"
                paragraph={{ rows: 10 }}
                title={false}
              />
            </div>
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default KnowledgePageDetailSkeleton;
