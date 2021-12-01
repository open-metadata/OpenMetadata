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

import { isNil } from 'lodash';
import React, { FunctionComponent } from 'react';
import Tag from '../../tags/tags';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';

type Props = {
  description: string;
  extraInfo: {
    key: string;
    value?: string;
  }[];
  tags?: string[];
};

const TableDataCardBody: FunctionComponent<Props> = ({
  description,
  extraInfo,
  tags,
}: Props) => {
  return (
    <div data-testid="table-body">
      <div className="tw-mb-1 description-text">
        {description.trim() ? (
          <RichTextEditorPreviewer markdown={description} />
        ) : (
          <span className="tw-no-description">No description added</span>
        )}
      </div>
      <p className="tw-py-1">
        {extraInfo.map(({ key, value }, i) =>
          !isNil(value) ? (
            <span key={i}>
              <span className="tw-text-grey-muted">{key} :</span>{' '}
              <span className="tw-pl-1 ">{value}</span>
              {i !== extraInfo.length - 1 && (
                <span className="tw-mx-3 tw-inline-block tw-text-gray-400">
                  •
                </span>
              )}
            </span>
          ) : null
        )}
      </p>
      {Boolean(tags?.length) && (
        <div className="tw-mt-1" data-testid="tags-container">
          <span>
            <i className="fas fa-tags tw-px-1 tw-text-xs tw-text-grey-muted" />
          </span>
          {tags?.map((tag, index) => (
            <Tag
              className="tw-border-none tw-bg-gray-200"
              key={index}
              tag={`#${tag.startsWith('Tier.Tier') ? tag.split('.')[1] : tag}`}
              type="contained"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TableDataCardBody;
