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
import React from 'react';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
/* eslint-disable max-len */
// need to remove eslint disable once API data comes

type RelationshipTableType = {
  relatedTerms: string;
  description: string;
};

type Props = {
  data?: RelationshipTableType[];
};

const RelationshipTab = ({ data }: Props) => {
  return data?.length ? (
    <div className="tw-table-responsive" id="relationship">
      <table className="tw-w-full tw-bg-white">
        <thead>
          <tr className="tableHead-row">
            <th className="tableHead-cell">Terms</th>
            <th className="tableHead-cell">Description</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            return (
              <tr className={classNames('tableBody-row')} key={index}>
                <td
                  className={classNames(
                    'tableBody-cell tw-group tw-relative tw-align-baseline tw-w-2/12'
                  )}>
                  {row.relatedTerms}
                </td>
                <td
                  className={classNames(
                    'tableBody-cell tw-group tw-relative tw-align-baseline'
                  )}>
                  <div
                    className="description-text"
                    data-testid="description-text">
                    {row.description.trim() ? (
                      <RichTextEditorPreviewer
                        enableSeeMoreVariant={false}
                        markdown={row.description}
                      />
                    ) : (
                      <span className="tw-no-description">No description</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  ) : (
    <ErrorPlaceHolder>
      <p className="tw-text-base tw-text-center">No related terms.</p>
    </ErrorPlaceHolder>
  );
};

export default RelationshipTab;
