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

import { Card } from 'antd';
import { ReactNode } from 'react';
import EntityListSkeleton from '../../../../common/Skeleton/MyData/EntityListSkeleton/EntityListSkeleton.component';
import './widget-wrapper.less';

export interface WidgetWrapperProps {
  children: ReactNode;
  className?: string;
  dataLength?: number;
  loading?: boolean;
}

const WidgetWrapper = ({
  children,
  className = '',
  dataLength = 5,
  loading = false,
}: WidgetWrapperProps) => {
  return (
    <Card
      className={`widget-wrapper-container card-widget ${className}`}
      data-testid="widget-wrapper">
      <EntityListSkeleton
        dataLength={dataLength}
        loading={loading}
        skeletonContainerStyle={{ marginLeft: '20px', marginTop: '20px' }}>
        <div className="widget-wrapper-content">{children}</div>
      </EntityListSkeleton>
    </Card>
  );
};

export default WidgetWrapper;
