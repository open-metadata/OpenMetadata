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
import classNames from 'classnames';
import { uniqueId } from 'lodash';
import React, { useEffect, useState } from 'react';
import { BlurLayout } from './BlurLayout';
import { PreviewerProp } from './RichTextEditor.interface';
import './RichTextEditorPreviewer.less';

export const MAX_LENGTH = 300;

const RichTextEditorPreviewer = ({
  markdown = '',
  className = '',
  blurClasses = 'see-more-blur',
  maxHtClass = 'tw-h-24',
  maxLen = MAX_LENGTH,
  enableSeeMoreVariant = true,
  textVariant,
}: PreviewerProp) => {
  const [content, setContent] = useState<string>('');
  const [displayMoreText, setDisplayMoreText] = useState<boolean>(false);

  const displayMoreHandler = () => {
    setDisplayMoreText((pre) => !pre);
  };

  useEffect(() => {
    setContent(markdown);
  }, [markdown]);

  return (
    <div
      className={classNames(
        'content-container tw-relative',
        className,
        enableSeeMoreVariant && markdown.length > maxLen && !displayMoreText
          ? `${maxHtClass} tw-overflow-hidden`
          : null,
        {
          'tw-mb-5': displayMoreText,
        }
      )}
      data-testid="viewer-container">
      <div
        className={classNames('markdown-parser', textVariant)}
        data-testid="markdown-parser">
        <Viewer extendedAutolinks initialValue={content} key={uniqueId()} />
      </div>

      <BlurLayout
        blurClasses={blurClasses}
        displayMoreHandler={displayMoreHandler}
        displayMoreText={displayMoreText}
        enableSeeMoreVariant={enableSeeMoreVariant}
        markdown={content}
      />
    </div>
  );
};

export default RichTextEditorPreviewer;
