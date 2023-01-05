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
import { SkeletonInterface } from 'Models';
import React from 'react';

const ExploreSkeleton = ({ children, loading }: SkeletonInterface) => {
  const mockData = Array.from({ length: 6 }, (_, index) => {
    return {
      name: index,
      innerData: Array.from({ length: 3 }, (_, index) => index + 1),
    };
  });

  return loading ? (
    <div className="m-t-md m-b-md">
      <Skeleton active paragraph={{ rows: 0 }} />
      <Row justify="space-between">
        <Col span={20}>
          <Skeleton active paragraph={{ rows: 0 }} />
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

      {mockData.map(({ innerData }) => (
        <div className="explore-skeleton-entities m-t-md" key={uniqueId()}>
          <div className="flex justify-between">
            <Skeleton active paragraph={{ rows: 0 }} />
          </div>
          {innerData.map(() => (
            <Row justify="space-between" key={uniqueId()}>
              <Col span={20}>
                <div className="w-48 flex">
                  <div>
                    <Skeleton
                      active
                      paragraph={{ rows: 0 }}
                      title={{
                        width: 14,
                      }}
                    />
                  </div>
                  <div className="m-l-xs">
                    <Skeleton
                      active
                      paragraph={{ rows: 0 }}
                      title={{
                        width: 100,
                      }}
                    />
                  </div>
                </div>
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
        </div>
      ))}
    </div>
  ) : (
    children
  );
};

export default ExploreSkeleton;
