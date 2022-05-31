/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { isEmpty, uniqueId } from 'lodash';
import React, { FC, Fragment, useState } from 'react';
import { CustomField, Type } from '../../generated/entity/type';
import { getEntityName, isEven } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';

interface CustomFieldTableProp {
  customFields: CustomField[];
  updateEntityType: (customFields: Type['customFields']) => void;
}

type Operation = 'delete' | 'update' | 'no-operation';

export const CustomFieldTable: FC<CustomFieldTableProp> = ({
  customFields,
  updateEntityType,
}) => {
  const [selectedField, setSelectedField] = useState<CustomField>(
    {} as CustomField
  );

  const [operation, setOperation] = useState<Operation>('no-operation');

  const resetSelectedField = () => {
    setSelectedField({} as CustomField);
    setOperation('no-operation' as Operation);
  };

  const handleFieldDelete = () => {
    const updatedFields = customFields.filter(
      (field) => field.name !== selectedField.name
    );
    updateEntityType(updatedFields);
    resetSelectedField();
  };

  const handleFieldUpdate = (updatedDescription: string) => {
    const updatedFields = customFields.map((field) => {
      if (field.name === selectedField.name) {
        return { ...field, description: updatedDescription };
      } else {
        return field;
      }
    });
    updateEntityType(updatedFields);
    resetSelectedField();
  };

  const deleteCheck = !isEmpty(selectedField) && operation === 'delete';
  const updateCheck = !isEmpty(selectedField) && operation === 'update';

  return (
    <Fragment>
      <div className="tw-bg-white tw-border tw-border-main tw-rounded  tw-shadow">
        <table className="tw-w-full" data-testid="entity-custom-fields-table">
          <thead data-testid="table-header">
            <tr className="tableHead-row tw-border-t-0 tw-border-l-0 tw-border-r-0">
              <th className="tableHead-cell" data-testid="field-name">
                Name
              </th>
              <th className="tableHead-cell" data-testid="field-type">
                Type
              </th>
              <th className="tableHead-cell" data-testid="field-description">
                Description
              </th>
              <th className="tableHead-cell" data-testid="field-actions">
                Actions
              </th>
            </tr>
          </thead>
          <tbody data-testid="table-body">
            {customFields.length ? (
              customFields.map((field, index) => (
                <tr
                  className={classNames(
                    `tableBody-row ${!isEven(index + 1) && 'odd-row'}`,
                    'tw-border-l-0 tw-border-r-0',
                    {
                      'tw-border-b-0': index === customFields.length - 1,
                    }
                  )}
                  data-testid="data-row"
                  key={uniqueId()}>
                  <td className="tableBody-cell">{field.name}</td>
                  <td className="tableBody-cell">
                    {getEntityName(field.fieldType)}
                  </td>
                  <td className="tableBody-cell">
                    {field.description ? (
                      <RichTextEditorPreviewer
                        markdown={field.description || ''}
                      />
                    ) : (
                      <span
                        className="tw-no-description tw-p-2 tw--ml-1.5"
                        data-testid="no-description">
                        No description{' '}
                      </span>
                    )}
                  </td>
                  <td className="tableBody-cell">
                    <div className="tw-flex">
                      <button
                        className="tw-cursor-pointer"
                        data-testid="edit-button"
                        onClick={() => {
                          setSelectedField(field);
                          setOperation('update');
                        }}>
                        <SVGIcons
                          alt="edit"
                          icon={Icons.EDIT}
                          title="Edit"
                          width="12px"
                        />
                      </button>
                      <button
                        className="tw-cursor-pointer tw-ml-4"
                        data-testid="delete-button"
                        onClick={() => {
                          setSelectedField(field);
                          setOperation('delete');
                        }}>
                        <SVGIcons
                          alt="delete"
                          icon={Icons.DELETE}
                          title="Delete"
                          width="12px"
                        />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr
                className="tableBody-row tw-border-l-0 tw-border-r-0 tw-border-b-0"
                data-testid="no-data-row">
                <td
                  className="tableBody-cell tw-text-grey-muted tw-text-center"
                  colSpan={4}>
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {deleteCheck && (
        <ConfirmationModal
          bodyText={`Are you sure you want to delete the field ${selectedField.name}`}
          cancelText="Cancel"
          confirmText="Confirm"
          header={`Delete field ${selectedField.name}`}
          onCancel={resetSelectedField}
          onConfirm={handleFieldDelete}
        />
      )}
      {updateCheck && (
        <ModalWithMarkdownEditor
          header={`Edit Field: "${selectedField.name}"`}
          placeholder="Enter Field Description"
          value={selectedField.description as string}
          onCancel={resetSelectedField}
          onSave={handleFieldUpdate}
        />
      )}
    </Fragment>
  );
};
