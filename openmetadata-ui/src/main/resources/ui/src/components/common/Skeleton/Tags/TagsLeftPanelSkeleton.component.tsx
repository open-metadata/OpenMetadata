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
import { uniqueId } from 'lodash';
import { getSkeletonMockData } from '../../../../utils/Skeleton.utils';
import ButtonSkeleton from '../CommonSkeletons/ControlElements/ControlElements.component';
import LabelCountSkeleton from '../CommonSkeletons/LabelCountSkeleton/LabelCountSkeleton.component';
import { SkeletonInterface } from '../Skeleton.interfaces';

const TagsLeftPanelSkeleton = ({ loading, children }: SkeletonInterface) => {
  return loading ? (
    <div className="m-b-md p-md">
      <LabelCountSkeleton isLabel />
      <Row gutter={32} justify="space-between">
        <Col className="m-l-xss" span={24}>
          <ButtonSkeleton />
        </Col>

        <Col className="m-t-md" span={24}>
          {getSkeletonMockData().map(() => (
            <LabelCountSkeleton isCount isLabel key={uniqueId()} />
          ))}
        </Col>
      </Row>
    </div>
  ) : (
    children
  );
};

export default TagsLeftPanelSkeleton;
