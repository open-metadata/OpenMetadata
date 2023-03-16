/*
 *  Copyright 2022 Collate.
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
import { useTranslation } from 'react-i18next';
import { DESCRIPTION_MAX_PREVIEW_CHARACTERS } from '../../../constants/constants';
import { getTrimmedContent } from '../../../utils/CommonUtils';
import { PreviewerProp } from './RichTextEditor.interface';
import './RichTextEditorPreviewer.less';

const RichTextEditorPreviewer = ({
  markdown = '',
  className = '',
  enableSeeMoreVariant = true,
  textVariant = 'black',
  maxLength = DESCRIPTION_MAX_PREVIEW_CHARACTERS,
}: PreviewerProp) => {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [hideReadMoreText, setHideReadMoreText] = useState<boolean>(
    markdown.length <= maxLength
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
            hideReadMoreText
              ? content
              : `${getTrimmedContent(content, maxLength)}...`
          }
          key={uniqueId()}
          linkAttributes={{ target: '_blank' }}
        />
      </div>
      {enableSeeMoreVariant && markdown.length > maxLength && (
        <Button
          className="leading-0"
          data-testid="read-more-button"
          type="link"
          onClick={displayMoreHandler}>
          {hideReadMoreText
            ? t('label.read-type-lowercase', {
                type: t('label.less-lowercase'),
              })
            : t('label.read-type-lowercase', {
                type: t('label.more-lowercase'),
              })}
        </Button>
      )}
    </div>
  );
};

export default RichTextEditorPreviewer;
