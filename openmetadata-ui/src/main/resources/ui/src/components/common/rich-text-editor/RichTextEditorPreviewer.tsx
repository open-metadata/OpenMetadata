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
import Markdown from 'markdown-to-jsx';
import React, { useEffect, useState } from 'react';
import { Paragraph, UnOrderedList } from '../../../utils/MarkdownUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';

const MAX_LENGTH = 300;

const RichTextEditorPreviewer = ({
  markdown = '',
  className = '',
  blurClasses = 'see-more-blur',
  maxHtClass = 'tw-h-24',
  maxLen = MAX_LENGTH,
  enableSeeMoreVariant = true,
}: {
  markdown: string;
  className?: string;
  blurClasses?: string;
  maxHtClass?: string;
  maxLen?: number;
  enableSeeMoreVariant?: boolean;
}) => {
  const [content, setContent] = useState<string>('');
  const [displayMoreText, setDisplayMoreText] = useState(false);
  useEffect(() => {
    const modifiedContent = markdown
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');
    setContent(modifiedContent);
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
      )}>
      <Markdown
        options={{
          overrides: {
            h1: {
              component: Paragraph,
            },
            h2: {
              component: Paragraph,
            },
            h3: {
              component: Paragraph,
            },
            h4: {
              component: Paragraph,
            },
            h5: {
              component: Paragraph,
            },
            h6: {
              component: Paragraph,
            },
            ul: {
              component: UnOrderedList,
              props: {
                className: 'tw-ml-3',
              },
            },
          },
        }}>
        {content}
      </Markdown>
      {enableSeeMoreVariant && markdown.length > MAX_LENGTH && (
        <div
          className={classNames(
            'tw-absolute tw-flex tw-h-full tw-w-full tw-inset-x-0 tw-pointer-events-none',
            !displayMoreText ? blurClasses : null,
            {
              'tw-top-0 tw-bottom-0': !displayMoreText,
              ' tw--bottom-4': displayMoreText,
            }
          )}>
          <p
            className="tw-cursor-pointer tw-self-end tw-pointer-events-auto tw-text-primary tw-mx-auto"
            onClick={() => setDisplayMoreText((pre) => !pre)}>
            <span className="tw-flex tw-items-center tw-gap-2">
              <SVGIcons
                alt="expand-collapse"
                className={classNames({ 'rotate-inverse': displayMoreText })}
                icon={Icons.CHEVRON_DOWN}
                width="32"
              />
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default RichTextEditorPreviewer;
