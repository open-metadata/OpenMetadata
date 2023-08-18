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
import { Col, Row } from 'antd';
import ButtonSkeleton from 'components/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import LabelCountSkeleton from 'components/Skeleton/CommonSkeletons/LabelCountSkeleton/LabelCountSkeleton.component';
import { SkeletonInterface } from 'components/Skeleton/Skeleton.interfaces';
import { getSkeletonMockData } from 'components/Skeleton/SkeletonUtils/Skeleton.utils';
import { uniqueId } from 'lodash';
import React from 'react';

const SummaryPanelSkeleton = ({ loading, children }: SkeletonInterface) => {
  return loading ? (
    <div className="m-b-md p-md">
      <Row gutter={32} justify="space-between">
        <Col className="m-t-md" span={24}>
          {getSkeletonMockData(5).map(() => (
            <LabelCountSkeleton
              isCount
              isLabel
              firstColSize={8}
              key={uniqueId()}
              secondColSize={16}
              title={{
                width: 100,
              }}
            />
          ))}
        </Col>

        <Col className="m-l-xss" span={24}>
          {getSkeletonMockData(10).map(() => (
            <ButtonSkeleton key={uniqueId()} size="large" />
          ))}
        </Col>
      </Row>
    </div>
  ) : (
    children
  );
};

export default SummaryPanelSkeleton;
