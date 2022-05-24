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
import { Link } from 'react-router-dom';
import { EntityType } from '../../enums/entity.enum';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { getEntityName } from '../../utils/CommonUtils';
import { getEntityLink } from '../../utils/TableUtils';

interface MlModelFeaturesListProp {
  mlFeatures: Mlmodel['mlFeatures'];
}

const MlModelFeaturesList: FC<MlModelFeaturesListProp> = ({ mlFeatures }) => {
  if (mlFeatures && mlFeatures.length) {
    return (
      <div className="tw-flex tw-flex-col">
        <hr className="tw-my-4" />
        <h6 className="tw-font-medium tw-text-base">Features used</h6>
        {mlFeatures.map((feature) => (
          <div
            className="tw-bg-white tw-shadow-md tw-border tw-border-main tw-rounded-md tw-p-4 tw-mb-8"
            key={uniqueId()}>
            <h6 className="tw-font-semibold">{feature.name}</h6>
            <div className="tw-grid tw-grid-cols-3">
              <p className="tw-grid tw-grid-cols-2">
                <span className="tw-text-grey-muted">Type:</span>{' '}
                <span>{feature.dataType || '--'}</span>
              </p>
              <p className="tw-grid tw-grid-cols-2">
                <span className="tw-text-grey-muted">Tags:</span>{' '}
                <span>--</span>
              </p>
            </div>
            <div className="tw-grid tw-grid-cols-3 tw-mt-2">
              <p className="tw-grid tw-grid-cols-2">
                <span className="tw-text-grey-muted">Description:</span>{' '}
                <span>{feature.description || '--'}</span>
              </p>
              <p className="tw-grid tw-grid-cols-2">
                <span className="tw-text-grey-muted">Algorithm:</span>{' '}
                <span>{feature.featureAlgorithm || '--'}</span>
              </p>
            </div>
            <div className="tw-mt-2">
              <span className="tw-text-grey-muted">Sources:</span>{' '}
              <table
                className="tw-w-full tw-mt-3"
                data-testid="sources-table"
                id="sources-table">
                <thead>
                  <tr className="tableHead-row">
                    <th className="tableHead-cell">Name</th>
                    <th className="tableHead-cell">Data Type</th>
                    <th className="tableHead-cell">Data Source</th>
                  </tr>
                </thead>
                <tbody className="tableBody">
                  {feature.featureSources && feature.featureSources.length ? (
                    feature.featureSources?.map((source) => (
                      <tr
                        className={classNames('tableBody-row')}
                        data-testid="tableBody-row"
                        key={uniqueId()}>
                        <td
                          className="tableBody-cell"
                          data-testid="tableBody-cell">
                          {source.name}
                        </td>
                        <td
                          className="tableBody-cell"
                          data-testid="tableBody-cell">
                          {source.dataType || '--'}
                        </td>
                        <td
                          className="tableBody-cell"
                          data-testid="tableBody-cell">
                          <span>
                            <Link
                              to={getEntityLink(
                                EntityType.TABLE,
                                source.dataSource?.fullyQualifiedName ||
                                  source.dataSource?.name ||
                                  ''
                              )}>
                              {getEntityName(source.dataSource)}
                            </Link>
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr
                      className={classNames('tableBody-row')}
                      data-testid="tableBody-row"
                      key={uniqueId()}>
                      <td
                        className="tableBody-cell tw-text-center tw-text-grey-muted"
                        colSpan={2}
                        data-testid="tableBody-cell">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
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

export default MlModelFeaturesList;
