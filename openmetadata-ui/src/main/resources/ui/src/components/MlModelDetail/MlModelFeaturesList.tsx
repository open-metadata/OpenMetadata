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
import { isUndefined, uniqueId } from 'lodash';
import React, { FC, Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { EntityType } from '../../enums/entity.enum';
import { MlFeature, Mlmodel } from '../../generated/entity/data/mlmodel';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import {
  getEntityName,
  getHtmlForNonAdminAction,
} from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getEntityLink } from '../../utils/TableUtils';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';

interface MlModelFeaturesListProp {
  mlFeatures: Mlmodel['mlFeatures'];
  owner: Mlmodel['owner'];
  hasEditAccess: boolean;
  handleFeaturesUpdate: (features: Mlmodel['mlFeatures']) => void;
}

const MlModelFeaturesList: FC<MlModelFeaturesListProp> = ({
  mlFeatures,
  owner,
  hasEditAccess,
  handleFeaturesUpdate,
}) => {
  const [selectedFeature, setSelectedFeature] = useState<MlFeature>();

  const handleCancelEditDescription = () => {
    setSelectedFeature(undefined);
  };

  const handleDescriptionChange = (value: string) => {
    if (selectedFeature) {
      const updatedFeatures = mlFeatures?.map((feature) => {
        if (feature.name === selectedFeature.name) {
          return {
            ...selectedFeature,
            description: value,
          };
        } else {
          return feature;
        }
      });
      handleFeaturesUpdate(updatedFeatures);
      handleCancelEditDescription();
    } else {
      handleCancelEditDescription();
    }
  };

  if (mlFeatures && mlFeatures.length) {
    return (
      <Fragment>
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
                  <div className="tw-flex">
                    {feature.description ? (
                      <RichTextEditorPreviewer markdown={feature.description} />
                    ) : (
                      <span className="tw-no-description">No description </span>
                    )}
                    <NonAdminAction
                      html={getHtmlForNonAdminAction(Boolean(owner))}
                      isOwner={hasEditAccess}
                      permission={Operation.UpdateDescription}
                      position="top">
                      <button
                        className="tw-self-start tw-w-8 tw-h-auto tw-ml-1 focus:tw-outline-none"
                        onClick={() => {
                          setSelectedFeature(feature);
                        }}>
                        <SVGIcons
                          alt="edit"
                          icon="icon-edit"
                          title="Edit"
                          width="12px"
                        />
                      </button>
                    </NonAdminAction>
                  </div>
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
        {!isUndefined(selectedFeature) && (
          <ModalWithMarkdownEditor
            header={`Edit feature: "${selectedFeature.name}"`}
            placeholder="Enter feature description"
            value={selectedFeature.description as string}
            onCancel={handleCancelEditDescription}
            onSave={handleDescriptionChange}
          />
        )}
      </Fragment>
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
