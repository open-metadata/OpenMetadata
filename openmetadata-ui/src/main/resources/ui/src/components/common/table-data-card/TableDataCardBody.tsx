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
import React, { FunctionComponent } from 'react';
import { TagLabel } from '../../../generated/type/tagLabel';
import { serviceTypeLogo } from '../../../utils/ServiceUtils';
import SVGIcons from '../../../utils/SvgUtils';
import Tag from '../../tags/tags';
import Avatar from '../avatar/Avatar';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';

type Props = {
  description: string;
  extraInfo: {
    key: string;
    value?: string;
  }[];
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
  const getInfoLabel = (data: { key: string; value: string }) => {
    switch (data.key) {
      case 'Owner':
        return data.value !== '--' ? (
          <div className="tw-inline-block">
            <Avatar name={data.value} textClass="tw-text-xs" width="22" />
          </div>
        ) : (
          `${data.key} : `
        );
      case 'Service':
        return (
          <img
            alt=""
            className="tw-inline tw-h-5 tw-w-5"
            src={serviceTypeLogo(data.value)}
          />
        );
      case 'Tier':
        return <SVGIcons alt="icon-tier" icon="icon-tier" width="16px" />;

      default:
        return `${data.key} : `;
    }
  };

  return (
    <div data-testid="table-body">
      <div className="tw-mb-4">
        {extraInfo.map(({ key, value }, i) =>
          !isNil(value) ? (
            <span key={i}>
              <span className="tw-text-grey-muted">
                {getInfoLabel({ key, value })}
              </span>{' '}
              <span className="tw-pl-1 ">{value}</span>
              {i !== extraInfo.length - 1 && (
                <span className="tw-mx-3 tw-inline-block tw-text-gray-400">
                  |
                </span>
              )}
            </span>
          ) : null
        )}
      </div>
      <div className="description-text">
        {description.trim() ? (
          <RichTextEditorPreviewer markdown={description} />
        ) : (
          <span className="tw-no-description">No description added</span>
        )}
      </div>
      {Boolean(tags?.length) && (
        <div className="tw-mt-4" data-testid="tags-container">
          <hr className="tw--mx-3 tw-pt-2" />
          <div className="tw-flex">
            <SVGIcons alt="icon-tag" icon="icon-tag" />
            <div className="tw-ml-2">
              {tags?.map((tag, index) => (
                <Tag
                  key={index}
                  startWith="#"
                  tag={getTagValue(tag)}
                  type="label"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableDataCardBody;
