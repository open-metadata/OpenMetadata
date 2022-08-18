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

import { Viewer } from '@toast-ui/react-editor';
import { Button } from 'antd';
import classNames from 'classnames';
import { uniqueId } from 'lodash';
import React, { useEffect, useState } from 'react';
import { PreviewerProp } from './RichTextEditor.interface';
import './RichTextEditorPreviewer.less';

export const MAX_LENGTH = 350;

const RichTextEditorPreviewer = ({
  markdown = '',
  className = '',
  enableSeeMoreVariant = true,
  textVariant = 'black',
}: PreviewerProp) => {
  const [content, setContent] = useState<string>('');
  const [hideReadMoreText, setHideReadMoreText] = useState<boolean>(
    markdown.length <= MAX_LENGTH
  );

  const displayMoreHandler = () => {
    setHideReadMoreText((pre) => !pre);
  };

  useEffect(() => {
    setContent(markdown);
  }, [markdown]);

  return (
    <div
      className={classNames('rich-text-editor-container', className)}
      data-testid="viewer-container">
      <div
        className={classNames('markdown-parser', textVariant)}
        data-testid="markdown-parser">
        <Viewer
          extendedAutolinks
          initialValue={
            hideReadMoreText || !enableSeeMoreVariant
              ? content
              : `${content.slice(0, MAX_LENGTH)}...`
          }
          key={uniqueId()}
        />
      </div>
      {enableSeeMoreVariant && markdown.length > MAX_LENGTH && (
        <Button
          className="leading-0"
          data-testid="read-more-button"
          type="link"
          onClick={displayMoreHandler}>
          {hideReadMoreText ? 'read less' : 'read more'}
        </Button>
      )}
    </div>
  );
};

export default RichTextEditorPreviewer;
