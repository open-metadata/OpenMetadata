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

import { Col, Row, Skeleton } from 'antd';

const LogViewerPageSkeleton = () => {
  return (
    <Row className="border-top justify-between" gutter={[16, 16]}>
      <Col className="p-md border-right" span={18}>
        <div className="flex items-center gap-2 justify-end">
          <Skeleton.Button active />
          <Skeleton.Button active shape="circle" />
          <Skeleton.Button active shape="circle" />
        </div>
        <Skeleton
          active
          className="p-l-md p-t-md"
          paragraph={{ rows: 16 }}
          title={false}
        />
      </Col>
      <Col className="p-md" span={6}>
        <Skeleton active paragraph={{ rows: 1, width: '60%' }} />
        <Row className="m-t-lg" gutter={[16, 48]}>
          <Col span={11}>
            <Skeleton
              paragraph={{ rows: 3, width: ['70%', '80%', '90%'] }}
              title={false}
            />
          </Col>
          <Col span={12}>
            <Skeleton paragraph={{ rows: 3, width: '90%' }} title={false} />
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default LogViewerPageSkeleton;
