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
import { Card } from '@openmetadata/ui-core-components';
import { CustomPropertyListItem } from '../CustomPropertiesWidget/CustomPropertyListItem';
import { hasVersionValue } from './CustomPropertyCard.utils';
import { CustomPropertyVersionListProps } from './CustomPropertyVersionList.interface';
import { CustomPropertyVersionValue } from './CustomPropertyVersionValue';

/** Read-only Custom Properties tab of an entity version page. */
export const CustomPropertyVersionList = ({
  properties,
  extension,
  addedKeys = [],
}: CustomPropertyVersionListProps) => (
  <Card className="tw:p-4" data-testid="custom-properties-card">
    <ul className="tw:m-0 tw:grid tw:list-none tw:grid-cols-1 tw:gap-3 tw:p-0 tw:md:grid-cols-2 tw:xl:grid-cols-3">
      {properties.map((property) => {
        const value = extension?.[property.name];

        return (
          <CustomPropertyListItem
            className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary"
            hasEditPermissions={false}
            key={property.name}
            property={property}
            value={value}
            valueContent={
              hasVersionValue(property.propertyType.name, value) ? (
                <CustomPropertyVersionValue
                  isAdded={addedKeys.includes(property.name)}
                  property={property}
                  value={value}
                />
              ) : undefined
            }
          />
        );
      })}
    </ul>
  </Card>
);
