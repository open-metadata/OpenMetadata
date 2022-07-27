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

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { uniqueId } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
import { getTypeByFQN } from '../../../axiosAPIs/metadataTypeAPI';
import { Type } from '../../../generated/entity/type';
import { isEven } from '../../../utils/CommonUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { CustomPropertyProps } from './CustomPropertyTable.interface';
import { PropertyValue } from './PropertyValue';

export const CustomPropertyTable: FC<CustomPropertyProps> = ({
  entityDetails,
  handleExtentionUpdate,
  entityType,
}) => {
  const [entityTypeDetail, setEntityTypeDetail] = useState<Type>({} as Type);

  const fetchTypeDetail = () => {
    getTypeByFQN(entityType)
      .then((res: AxiosResponse) => {
        setEntityTypeDetail(res.data);
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };

  const customProperties = entityTypeDetail.customProperties || [];

  const extension = entityDetails.extension;

  const onExtensionUpdate = (
    updatedExtension: CustomPropertyProps['entityDetails']['extension']
  ) => {
    handleExtentionUpdate({ ...entityDetails, extension: updatedExtension });
  };

  useEffect(() => {
    fetchTypeDetail();
  }, []);

  return (
    <div className="tw-bg-white tw-border tw-border-main tw-rounded">
      <table className="tw-w-full" data-testid="custom-properties-table">
        <thead data-testid="table-header">
          <tr className="tableHead-row tw-border-t-0 tw-border-l-0 tw-border-r-0">
            <th className="tableHead-cell tw-w-2/4" data-testid="property-name">
              Name
            </th>
            <th
              className="tableHead-cell tw-w-2/4"
              data-testid="property-value">
              Value
            </th>
          </tr>
        </thead>
        <tbody data-testid="table-body">
          {customProperties.length ? (
            customProperties.map((property, index) => (
              <tr
                className={classNames(
                  `tableBody-row ${!isEven(index + 1) && 'odd-row'}`,
                  'tw-border-l-0 tw-border-r-0',
                  {
                    'tw-border-b-0': index === customProperties.length - 1,
                  }
                )}
                data-testid="data-row"
                key={uniqueId()}>
                <td className="tableBody-cell">{property.name}</td>

                <td className="tableBody-cell">
                  <PropertyValue
                    extension={extension}
                    propertyName={property.name}
                    propertyType={property.propertyType}
                    onExtensionUpdate={onExtensionUpdate}
                  />
                </td>
              </tr>
            ))
          ) : (
            <tr
              className={classNames(
                'tableBody-row tw-border-l-0 tw-border-r-0 tw-border-b-0'
              )}
              data-testid="no-data-row"
              key={uniqueId()}>
              <td className="tableBody-cell tw-text-center" colSpan={2}>
                <span className="tw-text-grey-muted">
                  No custom properties available
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
