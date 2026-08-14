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

import { Space, Typography } from 'antd';
import { getEntityName } from '../../../utils/EntityNameUtils';

interface EntityLabelProps {
  displayName?: string;
  name?: string;
  fullyQualifiedName?: string;
}

const EntityLabel = (entity: EntityLabelProps): JSX.Element => (
  <Space className="w-full whitespace-normal" direction="vertical" size={0}>
    <Typography.Paragraph className="m-b-0">
      {getEntityName(entity)}
    </Typography.Paragraph>
    <Typography.Paragraph className="text-grey-muted text-xs">
      {entity?.fullyQualifiedName}
    </Typography.Paragraph>
  </Space>
);

export default EntityLabel;
