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
import { Tag } from 'antd';
import { getCustomPropertyTypeDisplayName } from '../../../utils/CustomProperty.utils';

interface CustomPropertyTypeBadgeProps {
  propertyTypeName?: string;
}

const CustomPropertyTypeBadge = ({
  propertyTypeName,
}: CustomPropertyTypeBadgeProps) => {
  const displayName = getCustomPropertyTypeDisplayName(propertyTypeName);

  if (!displayName) {
    return null;
  }

  return (
    <Tag
      data-testid="custom-property-type-badge"
      style={{
        fontSize: 10,
        lineHeight: '16px',
        padding: '0 6px',
        borderRadius: 4,
        backgroundColor: '#f0f2f5',
        border: 'none',
        color: '#5c6370',
        verticalAlign: 'middle',
        fontWeight: 500,
        letterSpacing: '0.04em',
        marginLeft: 4,
        marginRight: 0,
      }}>
      {displayName}
    </Tag>
  );
};

export default CustomPropertyTypeBadge;
