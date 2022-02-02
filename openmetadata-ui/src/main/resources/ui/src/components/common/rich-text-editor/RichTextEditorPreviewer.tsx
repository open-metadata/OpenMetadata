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
import ReactMarkdown, { PluggableList } from 'react-markdown';
import { Link } from 'react-router-dom';
import rehypeRaw from 'rehype-raw';
import gfm from 'remark-gfm';
import { isValidUrl } from '../../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';

const MAX_LENGTH = 300;

/*eslint-disable  */
const RichTextEditorPreviewer = ({
  markdown,
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
      )}>
      <ReactMarkdown
        children={content
          .replaceAll(/&lt;/g, '<')
          .replaceAll(/&gt;/g, '>')
          .replaceAll('\\', '')}
        components={{
          h1: 'p',
          h2: 'p',
          h3: 'p',
          h4: 'p',
          h5: 'p',
          h6: 'p',
          ul: ({ node, children, ...props }) => {
            const { ordered: _ordered, ...rest } = props;
            return (
              <ul style={{ marginLeft: '16px' }} {...rest}>
                {children}
              </ul>
            );
          },
          a: ({ node, children, ...props }) => {
            if (!isValidUrl(props.href as string)) {
              return <span>{children}</span>;
            } else {
              let link = '';
              const href = props.href;
              if (
                href?.indexOf('http://') == 0 ||
                href?.indexOf('https://') == 0
              ) {
                link = href;
              } else {
                link = `https://${href}`;
              }
              return (
                <Link to={{ pathname: link }} target="_blank">
                  {children}
                </Link>
              );
            }
          },
        }}
        remarkPlugins={[gfm] as unknown as PluggableList | undefined}
        rehypePlugins={[[rehypeRaw, { allowDangerousHtml: false }]]}
      />
      {enableSeeMoreVariant && markdown.length > MAX_LENGTH && (
        <div
          className={classNames(
            'tw-absolute tw-flex tw-h-full tw-w-full tw-inset-x-0',
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
                width="32"
                icon={Icons.CHEVRON_DOWN}
              />
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default RichTextEditorPreviewer;
