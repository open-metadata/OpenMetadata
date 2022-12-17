/*
 *  Copyright 2022 Collate
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
import { uniqueId } from 'lodash';
import React from 'react';

const TagsLeftPanelSkeleton = ({
  loading,
  children,
}: {
  loading?: boolean;
  children: JSX.Element;
}) => {
  const tagsMock = Array.from({ length: 10 }, (_, index) => index + 1);

  return loading ? (
    <div className="m-b-md p-md">
      <Skeleton active paragraph={{ rows: 0 }} />
      <Row gutter={32} justify="space-between">
        <Col span={24}>
          <Skeleton.Button active block size="small" />
        </Col>

        <Col className="m-t-md" span={24}>
          {tagsMock.map(() => (
            <Row justify="space-between" key={uniqueId()}>
              <Col span={20}>
                <Skeleton
                  active
                  paragraph={{ rows: 0 }}
                  title={{
                    width: 100,
                  }}
                />
              </Col>
              <Col span={4}>
                <Skeleton
                  active
                  paragraph={{ rows: 0 }}
                  title={{
                    width: 40,
                  }}
                />
              </Col>
            </Row>
          ))}
        </Col>
      </Row>
    </div>
  ) : (
    children
  );
};

export default TagsLeftPanelSkeleton;
