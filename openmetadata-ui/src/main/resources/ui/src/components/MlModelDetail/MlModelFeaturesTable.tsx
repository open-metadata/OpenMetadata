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
import { uniqueId } from 'lodash';
import React, { FC } from 'react';
import { Mlmodel } from '../../generated/entity/data/mlmodel';

interface MlModelFeaturesTableProp {
  mlFeatures: Mlmodel['mlFeatures'];
}

const MlModelFeaturesTable: FC<MlModelFeaturesTableProp> = ({ mlFeatures }) => {
  if (mlFeatures && mlFeatures.length) {
    return (
      <div className="tw-flex tw-flex-col">
        <hr className="tw-my-4" />
        <h6 className="tw-font-medium tw-text-base">Features used</h6>
        <table
          className="tw-w-full tw-mt-3"
          data-testid="hyperparameters-table"
          id="hyperparameters-table">
          <thead>
            <tr className="tableHead-row">
              <th className="tableHead-cell">Name</th>
              <th className="tableHead-cell">Data Type</th>
              <th className="tableHead-cell">Description</th>
              <th className="tableHead-cell">Algorithm</th>
            </tr>
          </thead>
          <tbody className="tableBody">
            {mlFeatures.map((feature) => (
              <tr
                className={classNames('tableBody-row')}
                data-testid="tableBody-row"
                key={uniqueId()}>
                <td className="tableBody-cell" data-testid="tableBody-cell">
                  {feature.name}
                </td>
                <td className="tableBody-cell" data-testid="tableBody-cell">
                  {feature.dataType}
                </td>
                <td className="tableBody-cell" data-testid="tableBody-cell">
                  {feature.description}
                </td>
                <td className="tableBody-cell" data-testid="tableBody-cell">
                  {feature.featureAlgorithm || '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    return (
      <div className="tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8">
        No features data available
      </div>
    );
  }
};

export default MlModelFeaturesTable;
