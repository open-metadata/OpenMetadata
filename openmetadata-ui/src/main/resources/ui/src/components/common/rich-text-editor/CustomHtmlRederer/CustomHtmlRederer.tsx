/*
 *  Copyright 2023 Collate.
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
import { CodeBlockMdNode, CustomHTMLRenderer } from '@toast-ui/editor';
import { ReactComponent as CopyIcon } from 'assets/svg/icon-copy.svg';
import { t } from 'i18next';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

interface TagToken {
  tagName: string;
  outerNewLine?: boolean;
  innerNewLine?: boolean;
}

export interface OpenTagToken extends TagToken {
  type: 'openTag';
  classNames?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes?: Record<string, any>;
  selfClose?: boolean;
}

export interface CloseTagToken extends TagToken {
  type: 'closeTag';
}

export interface TextToken {
  type: 'text';
  content: string;
}

export interface RawHTMLToken {
  type: 'html';
  content: string;
  outerNewLine?: boolean;
}

export type HTMLToken = OpenTagToken | CloseTagToken | TextToken | RawHTMLToken;

const getHTMLTokens = (node: CodeBlockMdNode): HTMLToken[] => {
  return [
    {
      type: 'openTag',
      tagName: 'div',
      outerNewLine: true,
      classNames: ['admonition', `admonition_${node.info}`],
    },
    {
      type: 'html',
      content: ReactDOMServer.renderToString(
        <p className="admonition-text">{node.literal}</p>
      ),
    },
    { type: 'closeTag', tagName: 'div', outerNewLine: true },
  ];
};

export const customHTMLRenderer: CustomHTMLRenderer = {
  note(node) {
    const tempNode = node as CodeBlockMdNode;

    const htmlTokens = getHTMLTokens(tempNode);

    return htmlTokens;
  },
  warning(node) {
    const tempNode = node as CodeBlockMdNode;

    const htmlTokens = getHTMLTokens(tempNode);

    return htmlTokens;
  },
  danger(node) {
    const tempNode = node as CodeBlockMdNode;

    const htmlTokens = getHTMLTokens(tempNode);

    return htmlTokens;
  },
  info(node) {
    const tempNode = node as CodeBlockMdNode;

    const htmlTokens = getHTMLTokens(tempNode);

    return htmlTokens;
  },
  tip(node) {
    const tempNode = node as CodeBlockMdNode;

    const htmlTokens = getHTMLTokens(tempNode);

    return htmlTokens;
  },
  caution(node) {
    const tempNode = node as CodeBlockMdNode;

    const htmlTokens = getHTMLTokens(tempNode);

    return htmlTokens;
  },
  codeBlock(node) {
    const { fenceLength, info } = node as CodeBlockMdNode;
    const infoWords = info ? info.split(/\s+/) : [];
    const preClasses = ['relative', 'code-block'];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const codeAttrs: Record<string, any> = {};

    const codeText = node.literal ?? '';

    if (fenceLength > 3) {
      codeAttrs['data-backticks'] = fenceLength;
    }
    if (infoWords.length > 0 && infoWords[0].length > 0) {
      const [lang] = infoWords;

      preClasses.push(`lang-${lang}`);
      codeAttrs['data-language'] = lang;
    }

    return [
      {
        type: 'openTag',
        tagName: 'pre',
        classNames: preClasses,
        attributes: { 'data-content': codeText },
      },
      {
        type: 'html',
        content: ReactDOMServer.renderToString(
          <>
            <code {...codeAttrs}>{codeText}</code>
            <span
              className="code-copy-message"
              data-copied="false"
              data-testid="copied-message">
              {t('label.copied')}
            </span>
            <CopyIcon
              className="code-copy-button"
              data-copied="false"
              data-testid="code-block-copy-icon"
            />
          </>
        ),
      },
      { type: 'closeTag', tagName: 'pre' },
    ];
  },
};
