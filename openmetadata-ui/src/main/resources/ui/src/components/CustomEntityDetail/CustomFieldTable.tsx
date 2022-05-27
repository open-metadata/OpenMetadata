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
import { uniqueId } from 'lodash';
import React, { FC } from 'react';
import { CustomField } from '../../generated/entity/type';
import { getEntityName, isEven } from '../../utils/CommonUtils';

interface CustomFieldTableProp {
  customFields: CustomField[];
}

export const CustomFieldTable: FC<CustomFieldTableProp> = ({
  customFields,
}) => {
  return (
    <table className="tw-w-full" data-testid="entity-custom-fields-table">
      <thead>
        <tr className="tableHead-row">
          <th className="tableHead-cell" data-testid="field-name">
            Name
          </th>
          <th className="tableHead-cell" data-testid="field-type">
            Type
          </th>
          <th className="tableHead-cell" data-testid="field-description">
            Description
          </th>
        </tr>
      </thead>
      <tbody>
        {customFields.length ? (
          customFields.map((field, index) => (
            <tr
              className={`tableBody-row ${!isEven(index + 1) && 'odd-row'}`}
              key={uniqueId()}>
              <td className="tableBody-cell">{field.name}</td>
              <td className="tableBody-cell">
                {getEntityName(field.fieldType)}
              </td>
              <td className="tableBody-cell">{field.description}</td>
            </tr>
          ))
        ) : (
          <tr className="tableBody-row">
            <td
              className="tableBody-cell tw-text-grey-muted tw-text-center"
              colSpan={3}>
              No data
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};
