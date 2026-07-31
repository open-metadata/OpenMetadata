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

import React, { lazy } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import EntityMarkdownLink from './EntityMarkdownLink/EntityMarkdownLink';
import EntityPill from './EntityPill/EntityPill';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../Database/SchemaEditor/SchemaEditor'))
);

/**
 * Preprocesses markdown text to handle entity links that might be wrapped in backticks
 * Removes backticks around entity markdown links so they can be properly rendered
 */
export const preprocessMarkdownText = (text: string): string => {
  // Pattern to match entity links wrapped in backticks
  // Example: `[customers](#table/red.dev.dbt_jaffle.customers)`
  // becomes [customers](#table/red.dev.dbt_jaffle.customers)
  // This allows the EntityMarkdownLink component to properly handle them
  const backtickWrappedLinkPattern = /`(\[[^\]]+\]\(#[^)]+\))`/g;

  // Pattern to match HTML comments (<!-- ... -->)
  // GitHub markdown hides these in preview, so we should remove them
  const htmlCommentPattern = /<!--[\s\S]*?-->/g;

  // Pattern to match entity links with unencoded special characters in the FQN
  // Example: [Active Customer](#glossaryTerm/eCommerce.Active Customer)
  // becomes [Active Customer](#glossaryTerm/eCommerce.Active%20Customer)
  // This is necessary because markdown parsers don't recognize URLs with unencoded spaces
  const entityLinkPattern = /(\[[^\]]+\]\(#([^/]+)\/([^)]+)\))/g;

  // Remove backticks around entity links
  let processedText = text.replace(backtickWrappedLinkPattern, '$1');

  // Remove HTML comments — loop until stable to handle nested/adjacent patterns
  // e.g. <!-- <!-- --> still injected --> would survive a single pass
  let previousText: string;
  do {
    previousText = processedText;
    processedText = processedText.replace(htmlCommentPattern, '');
  } while (processedText !== previousText);

  // URL-encode special characters in entity link FQNs
  processedText = processedText.replace(
    entityLinkPattern,
    (match, _, entityType, fqn) => {
      // Only encode if the FQN contains characters that need encoding
      // Common characters in FQNs that need encoding: spaces, parentheses, etc.
      if (/[\s()]/.test(fqn)) {
        const encodedFqn = encodeURIComponent(fqn);

        return `[${
          match.match(/\[([^\]]+)\]/)?.[1]
        }](#${entityType}/${encodedFqn})`;
      }

      return match;
    }
  );

  // Clean up multiple consecutive newlines (left by removed comments)
  processedText = processedText.replace(/\n{3,}/g, '\n\n');

  // Convert GitHub task list checkboxes to regular unordered list items
  // Matches patterns like "- [ ] Task" or "- [x] Task" and converts to "- Task"
  processedText = processedText.replace(/^(\s*)-\s*\[[ xX]\]\s+/gm, '$1- ');

  // Convert :::card ... ::: directive blocks into fenced code blocks
  // so the custom `pre` renderer can detect and render them as styled cards.
  // Handles both multi-line (:::card\n...\n:::) and inline (:::card ... :::) forms.
  processedText = processedText.replace(
    /:::card\s*([\s\S]*?):::/g,
    (_, content) => `\`\`\`card\n${content.trim()}\n\`\`\``
  );

  // Convert :::pills ... ::: directive blocks into fenced code blocks
  // so the custom `pre` renderer can detect and render them as entity pill rows.
  // Handles both multi-line (:::pills\n...\n:::) and inline (:::pills ... :::) forms.
  processedText = processedText.replace(
    /:::pills\s*([\s\S]*?):::/g,
    (_, content) => `\`\`\`pills\n${content.trim()}\n\`\`\``
  );

  return processedText;
};

export const getCustomMarkdownComponents = (
  additionalComponents?: Partial<Components>,
  depth = 0
): Partial<Components> => {
  return {
    // Custom link component for entity references
    a: ({ href, children, ...props }) => (
      <EntityMarkdownLink href={href} {...props}>
        {children}
      </EntityMarkdownLink>
    ),

    // Pre component for code blocks
    pre: (props: React.HTMLAttributes<HTMLPreElement>) => {
      const { children, ...restProps } = props;
      // Check if this is a SQL code block
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

          // Parse markdown links: [label](#entityType/fqn)
          const linkPattern = /\[([^\]]+)\]\(#([^/]+)\/([^)]+)\)/g;
          const pills: React.ReactNode[] = [];
          let match;

          while ((match = linkPattern.exec(codeString)) !== null) {
            const [, label, entityTypeStr, fqn] = match;
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

          if (depth >= 3) {
            return <div className="markdown-card">{codeString.trim()}</div>;
          }

          return (
            <div className="sub-thinking-step tw:px-2.5 tw:py-2 tw:rounded-xl bg-grey markdown-card">
              <ReactMarkdown
                components={getCustomMarkdownComponents(undefined, depth + 1)}>
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

      // Default pre rendering
      return (
        <pre className="markdown-pre" {...restProps}>
          {children}
        </pre>
      );
    },

    // Code component for inline code and code blocks
    code: (props: React.HTMLAttributes<HTMLElement>) => {
      const { className, children, ...restProps } = props;

      return (
        <code className={className || 'markdown-code'} {...restProps}>
          {children}
        </code>
      );
    },

    // Merge with any additional components
    ...additionalComponents,
  };
};
