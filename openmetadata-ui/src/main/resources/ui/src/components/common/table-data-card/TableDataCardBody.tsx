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

import { isNil, isString } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { FunctionComponent } from 'react';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getInfoElements } from '../../../utils/EntityUtils';
import SVGIcons from '../../../utils/SvgUtils';
import TagsViewer from '../../tags-viewer/tags-viewer';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';

type Props = {
  description: string;
  extraInfo: Array<ExtraInfo>;
  tags?: string[] | TagLabel[];
};

const TableDataCardBody: FunctionComponent<Props> = ({
  description,
  extraInfo,
  tags,
}: Props) => {
  const getTagValue = (tag: string | TagLabel): string | TagLabel => {
    if (isString(tag)) {
      return tag.startsWith('Tier.Tier') ? tag.split('.')[1] : tag;
    } else {
      return {
        ...tag,
        tagFQN: tag.tagFQN.startsWith('Tier.Tier')
          ? tag.tagFQN.split('.')[1]
          : tag.tagFQN,
      };
    }
  };

  return (
    <div data-testid="table-body">
      <div className="tw-mb-4">
        {extraInfo.map((info, i) =>
          !isNil(info.value) ? (
            <span key={i}>
              {getInfoElements(info)}
              {i !== extraInfo.length - 1 && (
                <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                  |
                </span>
              )}
            </span>
          ) : null
        )}
      </div>
      <div className="description-text" data-testid="description-text">
        {description.trim() ? (
          <RichTextEditorPreviewer
            enableSeeMoreVariant={false}
            markdown={description}
          />
        ) : (
          <span className="tw-no-description">No description</span>
        )}
      </div>
      {Boolean(tags?.length) && (
        <div className="tw-mt-4" data-testid="tags-container">
          <hr className="tw--mx-3 tw-pt-2" />
          <div className="tw-flex tw-relative">
            <SVGIcons
              alt="icon-tag"
              className="tw-absolute tw-top-1.5"
              icon="icon-tag-grey"
              width="14"
            />
            <div className="tw-ml-4">
              <TagsViewer
                sizeCap={-1}
                tags={(tags || []).map((tag) => getTagValue(tag))}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableDataCardBody;
