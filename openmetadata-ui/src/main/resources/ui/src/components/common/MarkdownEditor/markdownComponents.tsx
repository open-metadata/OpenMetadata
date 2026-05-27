/*
 *  Copyright 2025 Collate.
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

import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import EntityMarkdownLink from './EntityMarkdownLink/EntityMarkdownLink';
import EntityPill from './EntityPill/EntityPill';

export const preprocessMarkdownText = (text: string): string => {
  const backtickWrappedLinkPattern = /`(\[[^\]]+\]\(#[^)]+\))`/g;
  const htmlCommentPattern = /<!--[\s\S]*?-->/g;
  const entityLinkPattern = /(\[[^\]]+\]\(#([^/]+)\/([^)]+)\))/g;

  let processedText = text.replace(backtickWrappedLinkPattern, '$1');
  processedText = processedText.replace(htmlCommentPattern, '');
  processedText = processedText.replace(
    entityLinkPattern,
    (match, _, entityType, fqn) => {
      if (/[\s()]/.test(fqn)) {
        const encodedFqn = encodeURIComponent(fqn);

        return `[${
          match.match(/\[([^\]]+)\]/)?.[1]
        }](#${entityType}/${encodedFqn})`;
      }

      return match;
    }
  );

  processedText = processedText.replace(/\n{3,}/g, '\n\n');
  processedText = processedText.replace(/^(\s*)-\s*\[[ xX]\]\s+/gm, '$1- ');
  processedText = processedText.replace(
    /:::card\s*([\s\S]*?):::/g,
    (_, content) => `\`\`\`card\n${content.trim()}\n\`\`\``
  );
  processedText = processedText.replace(
    /:::pills\s*([\s\S]*?):::/g,
    (_, content) => `\`\`\`pills\n${content.trim()}\n\`\`\``
  );

  return processedText;
};

export const getCustomMarkdownComponents = (
  additionalComponents?: Partial<Components>
): Partial<Components> => {
  return {
    a: ({ href, children, ...props }) => (
      <EntityMarkdownLink href={href} {...props}>
        {children}
      </EntityMarkdownLink>
    ),

    pre: (props: React.HTMLAttributes<HTMLPreElement>) => {
      const { children, ...restProps } = props;
      if (React.isValidElement(children)) {
        const codeElement = children as React.ReactElement<{
          className?: string;
          children: React.ReactNode;
        }>;
        const className = codeElement.props?.className || '';
        const match = /language-(\w+)/.exec(className);
        const language = match ? match[1] : '';

        if (language === 'pills') {
          const codeChildren = codeElement.props?.children;
          const codeString = Array.isArray(codeChildren)
            ? codeChildren.join('')
            : String(codeChildren || '');

          const linkPattern = /\[([^\]]+)\]\(#([^/]+)\/([^)]+)\)/g;
          const pills: React.ReactNode[] = [];
          let pillMatch;

          while ((pillMatch = linkPattern.exec(codeString)) !== null) {
            const [, label, entityTypeStr, fqn] = pillMatch;
            const entityType = Object.values(EntityType).find(
              (type) => type === entityTypeStr
            );

            if (entityType) {
              pills.push(
                <EntityPill
                  entityType={entityType}
                  fullyQualifiedName={decodeURIComponent(fqn)}
                  key={`${entityTypeStr}/${fqn}`}
                  label={label}
                />
              );
            }
          }

          if (pills.length === 0) {
            return null;
          }

          return (
            <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
              {pills}
            </div>
          );
        }

        if (language === 'card') {
          const codeChildren = codeElement.props?.children;
          const codeString = Array.isArray(codeChildren)
            ? codeChildren.join('')
            : String(codeChildren || '');

          return (
            <div className="sub-thinking-step tw:px-2.5 tw:py-2 tw:rounded-xl bg-grey markdown-card">
              <ReactMarkdown components={getCustomMarkdownComponents()}>
                {codeString.trim()}
              </ReactMarkdown>
            </div>
          );
        }

        if (language === 'sql') {
          const codeChildren = codeElement.props?.children;
          const codeString = Array.isArray(codeChildren)
            ? codeChildren.join('')
            : String(codeChildren || '');

          return (
            <div className="markdown-sql-editor">
              <SchemaEditor
                readOnly
                showCopyButton
                mode={{ name: CSMode.SQL }}
                options={{
                  readOnly: 'nocursor',
                  lineWrapping: true,
                  scrollbarStyle: 'null',
                  gutters: ['CodeMirror-linenumbers'],
                }}
                value={codeString.replace(/\n$/, '')}
              />
            </div>
          );
        }
      }

      return (
        <pre className="markdown-pre" {...restProps}>
          {children}
        </pre>
      );
    },

    code: (props: React.HTMLAttributes<HTMLElement>) => {
      const { className, children, ...restProps } = props;

      return (
        <code className={className || 'markdown-code'} {...restProps}>
          {children}
        </code>
      );
    },

    ...additionalComponents,
  };
};
