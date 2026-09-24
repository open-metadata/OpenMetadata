/*
 *  Copyright 2024 Collate.
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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { getCustomMarkdownComponents } from '../MarkdownEditor/markdownComponents';
import { MAX_PREVIEW_TEXT_CHARS } from './FilePreviewer.constants';
import { PreviewRendererProps } from './FilePreviewer.types';

const MarkdownRenderer = ({ content }: PreviewRendererProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    let active = true;
    content.text().then((fullText) => {
      if (!active) {
        return;
      }
      const truncated = fullText.length > MAX_PREVIEW_TEXT_CHARS;
      setText(truncated ? fullText.slice(0, MAX_PREVIEW_TEXT_CHARS) : fullText);
      setIsTruncated(truncated);
    });

    return () => {
      active = false;
    };
  }, [content]);

  return (
    <div className="tw:prose tw:max-w-none tw:p-4">
      <ReactMarkdown components={getCustomMarkdownComponents()}>
        {text}
      </ReactMarkdown>
      {isTruncated && (
        <div className="tw:text-center tw:text-sm tw:text-secondary">
          {t('message.file-preview-text-truncated')}
        </div>
      )}
    </div>
  );
};

export default MarkdownRenderer;
