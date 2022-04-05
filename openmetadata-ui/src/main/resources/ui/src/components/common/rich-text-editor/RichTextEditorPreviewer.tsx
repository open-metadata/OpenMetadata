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
import React, { useEffect, useState } from 'react';
// Markdown Parser and plugin imports
import MarkdownParser from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { BlurLayout } from './BlurLayout';
import { PreviewerProp } from './RichTextEditor.interface';

export const MAX_LENGTH = 300;

const RichTextEditorPreviewer = ({
  markdown = '',
  className = '',
  blurClasses = 'see-more-blur',
  maxHtClass = 'tw-h-24',
  maxLen = MAX_LENGTH,
  enableSeeMoreVariant = true,
}: PreviewerProp) => {
  const [content, setContent] = useState<string>('');
  const [displayMoreText, setDisplayMoreText] = useState(false);

  const setModifiedContent = (markdownValue: string) => {
    const modifiedContent = markdownValue
      .replace(/&lt;/g, '<')
      .replace(/&gt/g, '>');
    setContent(modifiedContent);
  };

  const displayMoreHandler = () => {
    setDisplayMoreText((pre) => !pre);
  };

  useEffect(() => {
    setModifiedContent(markdown);
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
      <MarkdownParser
        sourcePos
        components={{
          h1: 'p',
          h2: 'p',
          ul: ({ children, ...props }) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { ordered, ...rest } = props;

            return (
              <ul className="tw-ml-3" {...rest}>
                {children}
              </ul>
            );
          },
          ol: ({ children, ...props }) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { ordered, ...rest } = props;

            return (
              <ol className="tw-ml-3" {...rest} style={{ listStyle: 'auto' }}>
                {children}
              </ol>
            );
          },
          code: ({ children, ...props }) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { inline, ...rest } = props;

            return (
              <code {...rest} className="tw-my">
                {children}
              </code>
            );
          },
        }}
        rehypePlugins={[rehypeRaw]}
        remarkPlugins={[remarkGfm]}>
        {content}
      </MarkdownParser>
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
