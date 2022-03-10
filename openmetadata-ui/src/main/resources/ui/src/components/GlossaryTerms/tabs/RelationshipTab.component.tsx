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
import { FormatedGlossaryTermData } from 'Models';
import React, { ReactNode } from 'react';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';

type Props = {
  data?: FormatedGlossaryTermData[];
  addButton?: ReactNode;
};

const RelationshipTab = ({ data, addButton }: Props) => {
  return (
    <div className="tw-table-responsive" id="relationship">
      <table className="tw-w-full tw-bg-white">
        <thead>
          <tr className="tableHead-row">
            <th className="tableHead-cell tw-w-2/12">Terms</th>
            <th className="tableHead-cell">Description</th>
          </tr>
        </thead>
        <tbody>
          {data?.length ? (
            data.map((row, index) => {
              return (
                <tr className={classNames('tableBody-row')} key={index}>
                  <td
                    className={classNames(
                      'tableBody-cell tw-group tw-relative tw-align-baseline'
                    )}>
                    {row.displayName || row.name}
                  </td>
                  <td
                    className={classNames(
                      'tableBody-cell tw-group tw-relative tw-align-baseline'
                    )}>
                    <div
                      className="description-text"
                      data-testid="description-text">
                      {row.description?.trim() ? (
                        <RichTextEditorPreviewer
                          enableSeeMoreVariant={false}
                          markdown={row.description}
                        />
                      ) : (
                        <span className="tw-no-description">
                          No description
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <tr className="tableBody-row">
              <td className="tableBody-cell tw-text-center" colSpan={4}>
                <p className="tw-mb-3">No related terms available.</p>
                {addButton}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default RelationshipTab;
