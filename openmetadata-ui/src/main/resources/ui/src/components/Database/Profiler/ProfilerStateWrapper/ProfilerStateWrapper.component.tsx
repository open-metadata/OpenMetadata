/*
 *  Copyright 2025 Collate.
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
import { Card, Col, Row, Typography } from 'antd';
import ProfilerLatestValue from '../ProfilerLatestValue/ProfilerLatestValue';
import { ProfilerStateWrapperProps } from './ProfilerStateWrapper.interface';

const ProfilerStateWrapper = ({
  isLoading,
  children,
  title,
  profilerLatestValueProps,
  dataTestId,
}: ProfilerStateWrapperProps) => {
  return (
    <Card
      className="shadow-none global-border-radius"
      data-testid={dataTestId ?? 'profiler-details-card-container'}
      loading={isLoading}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Typography.Title level={5}>{title}</Typography.Title>
        </Col>
        <Col span={4}>
          <ProfilerLatestValue {...profilerLatestValueProps} />
        </Col>
        <Col span={20}>{children}</Col>
      </Row>
    </Card>
  );
};

export default ProfilerStateWrapper;
