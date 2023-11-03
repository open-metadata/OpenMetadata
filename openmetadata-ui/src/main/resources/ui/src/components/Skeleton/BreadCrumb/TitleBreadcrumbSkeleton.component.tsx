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
import { Col, Row, Skeleton } from 'antd';
import { uniqueId } from 'lodash';
import React from 'react';
import { TitleBreadcrumbSkeletonProps } from '../Skeleton.interfaces';

const TitleBreadcrumbSkeleton = ({
  loading,
  children,
}: TitleBreadcrumbSkeletonProps) =>
  loading ? (
    <Row gutter={16}>
      {Array(3)
        .fill(null)
        .map(() => (
          <Col key={uniqueId()}>
            <Skeleton
              active
              className="m-l-xs"
              paragraph={{ rows: 0 }}
              title={{
                width: 150,
              }}
            />
          </Col>
        ))}
    </Row>
  ) : (
    children
  );

export default TitleBreadcrumbSkeleton;
