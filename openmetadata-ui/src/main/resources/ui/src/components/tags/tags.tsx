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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { isString } from 'lodash';
import React, { FunctionComponent } from 'react';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import PopOver from '../common/popover/PopOver';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { TagProps } from './tags.interface';
import { tagStyles } from './tags.styles';

const Tags: FunctionComponent<TagProps> = ({
  className,
  editable,
  tag,
  startWith,
  type = 'contained',
  removeTag,
  isRemovable = true,
  showOnlyName = false,
}: TagProps) => {
  const baseStyle = tagStyles.base;
  const layoutStyles = tagStyles[type];
  const textBaseStyle = tagStyles.text.base;
  const textLayoutStyles = tagStyles.text[type] || tagStyles.text.default;
  const textEditStyles = editable ? tagStyles.text.editable : '';

  const getTagString = (tag: string) => {
    return tag.startsWith('#') ? tag.slice(1) : tag;
  };

  const getTag = (tag: string, startWith = '') => {
    const tagName = showOnlyName ? tag.split(FQN_SEPARATOR_CHAR).pop() : tag;

    return (
      <span
        className={classNames(baseStyle, layoutStyles, className)}
        data-testid="tags">
        <span
          className={classNames(
            textBaseStyle,
            textLayoutStyles,
            textEditStyles
          )}>
          {`${startWith}${tagName}`}
        </span>
        {editable && isRemovable && (
          <span
            className="tw-py-0.5 tw-px-2 tw-rounded tw-cursor-pointer"
            data-testid="remove"
            onClick={(e: React.MouseEvent<HTMLElement, MouseEvent>) => {
              e.preventDefault();
              e.stopPropagation();
              removeTag && removeTag(e, getTagString(tag));
            }}>
            <FontAwesomeIcon className="tw-text-grey-300" icon="times" />
          </span>
        )}
      </span>
    );
  };

  return (
    <>
      {isString(tag) ? (
        getTag(tag, startWith)
      ) : (
        <>
          {!editable && (tag.description || tag.labelType) ? (
            <PopOver
              html={
                <div className="tw-text-left tw-p-1">
                  {tag.description && (
                    <div className="tw-mb-3">
                      <RichTextEditorPreviewer
                        enableSeeMoreVariant={false}
                        markdown={tag.description}
                      />
                    </div>
                  )}
                  <p>Set as {tag.labelType}</p>
                </div>
              }
              position="top"
              size="small"
              title=""
              trigger="mouseenter">
              {getTag(tag.tagFQN, startWith)}
            </PopOver>
          ) : (
            getTag(tag.tagFQN, startWith)
          )}
        </>
      )}
    </>
  );
};

export default Tags;
