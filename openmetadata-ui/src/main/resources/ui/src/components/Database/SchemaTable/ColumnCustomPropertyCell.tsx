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

import { FC, useCallback } from 'react';
import { Column } from '../../../generated/entity/data/table';
import { CustomProperty } from '../../../generated/type/customProperty';
import { PropertyValue } from '../../common/CustomPropertyTable/PropertyValue';

export interface ColumnCustomPropertyCellProps {
  property: CustomProperty;
  record: Column;
  hasEditPermissions: boolean;
  onExtensionUpdate: (
    record: Column,
    updatedExtension: Column['extension']
  ) => Promise<void>;
}

export const ColumnCustomPropertyCell: FC<ColumnCustomPropertyCellProps> = ({
  property,
  record,
  hasEditPermissions,
  onExtensionUpdate,
}) => {
  const handleUpdate = useCallback(
    (updatedExtension: Column['extension']) =>
      onExtensionUpdate(record, updatedExtension),
    [onExtensionUpdate, record]
  );

  return (
    <PropertyValue
      hideLabel
      isRenderedInRightPanel
      extension={record.extension}
      hasEditPermissions={hasEditPermissions}
      property={property}
      onExtensionUpdate={handleUpdate}
    />
  );
};

export default ColumnCustomPropertyCell;
