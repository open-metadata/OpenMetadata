/*
 *  Copyright 2022 Collate.
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
import { isEmpty } from 'lodash';
import { FC, Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ADD_CUSTOM_PROPERTIES_DOCS } from '../../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE, OPERATION } from '../../../enums/common.enum';
import { CustomProperty } from '../../../generated/type/customProperty';
import { CustomPropertyChanges } from '../../../rest/metadataTypeAPI';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';
import CustomPropertiesListTable from './CustomPropertiesListTable';
import { CustomPropertyTableProp } from './CustomPropertyTable.interface';
import EditCustomPropertyModal from './EditCustomPropertyModal/EditCustomPropertyModal';

export const CustomPropertyTable: FC<CustomPropertyTableProp> = ({
  customProperties,
  onDeleteProperty,
  onUpdateProperty,
  hasAccess,
  isLoading,
  isButtonLoading,
}) => {
  const { t } = useTranslation();
  const [selectedProperty, setSelectedProperty] = useState<CustomProperty>(
    {} as CustomProperty
  );
  const [operation, setOperation] = useState<OPERATION>(OPERATION.NO_OPERATION);

  const resetSelectedProperty = () => {
    setSelectedProperty({} as CustomProperty);
    setOperation(OPERATION.NO_OPERATION);
  };

  const handlePropertyDelete = () => onDeleteProperty(selectedProperty.name);

  useEffect(() => {
    if (!isButtonLoading) {
      resetSelectedProperty();
    }
  }, [isButtonLoading]);

  const handlePropertyUpdate = async (changes: CustomPropertyChanges) => {
    await onUpdateProperty(selectedProperty.name, changes);
    resetSelectedProperty();
  };

  const handleEdit = useCallback((property: CustomProperty) => {
    setSelectedProperty(property);
    setOperation(OPERATION.UPDATE);
  }, []);

  const handleDelete = useCallback((property: CustomProperty) => {
    setSelectedProperty(property);
    setOperation(OPERATION.DELETE);
  }, []);

  const deleteCheck = useMemo(
    () => !isEmpty(selectedProperty) && operation === OPERATION.DELETE,
    [selectedProperty, operation]
  );
  const updateCheck = useMemo(
    () => !isEmpty(selectedProperty) && operation === OPERATION.UPDATE,
    [selectedProperty, operation]
  );

  return (
    <Fragment>
      <CustomPropertiesListTable
        canDelete={hasAccess}
        canEdit={hasAccess}
        customProperties={customProperties}
        emptyText={
          <ErrorPlaceHolder
            className="mt-xs border-none"
            doc={ADD_CUSTOM_PROPERTIES_DOCS}
            heading={t('label.property')}
            permission={hasAccess}
            permissionValue={t('label.create-entity', {
              entity: t('label.custom-property'),
            })}
            type={ERROR_PLACEHOLDER_TYPE.CREATE}
          />
        }
        isLoading={isLoading}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
      <ConfirmationModal
        bodyText={t('message.are-you-sure-delete-property', {
          propertyName: selectedProperty.name,
        })}
        cancelText={t('label.cancel')}
        confirmText={t('label.confirm')}
        header={t('label.delete-property-name', {
          propertyName: selectedProperty.name,
        })}
        isLoading={isButtonLoading}
        visible={deleteCheck}
        onCancel={resetSelectedProperty}
        onConfirm={handlePropertyDelete}
      />
      {updateCheck && (
        <EditCustomPropertyModal
          customProperty={selectedProperty}
          onCancel={resetSelectedProperty}
          onSave={handlePropertyUpdate}
        />
      )}
    </Fragment>
  );
};
