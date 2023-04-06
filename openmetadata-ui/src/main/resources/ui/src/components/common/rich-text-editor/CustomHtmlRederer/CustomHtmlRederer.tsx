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

/**
 * This file contains code for custom renderers read more
 * @see {@link https://github.com/nhn/tui.editor/blob/master/docs/en/custom-html-renderer.md}
 */

import {
  CodeBlockMdNode,
  CustomHTMLRenderer,
  HeadingMdNode,
  LinkMdNode,
  MdNode,
} from '@toast-ui/editor';
import { ReactComponent as CopyIcon } from 'assets/svg/icon-copy.svg';
import { markdownTextAndIdRegex } from 'constants/regex.constants';
import { t } from 'i18next';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { MarkdownToHTMLConverter } from 'utils/FeedUtils';
import {
  HTMLToken,
  OpenTagToken,
  TextToken,
} from './CustomHtmlRederer.interface';

const getHTMLTokens = (node: MdNode): HTMLToken[] => {
  const blockNode = node as CodeBlockMdNode;

  // Parse inline markdown to html string
  const htmlContent = MarkdownToHTMLConverter.makeHtml(blockNode.literal ?? '');

  return [
    {
      type: 'openTag',
      tagName: 'div',
      outerNewLine: true,
      classNames: ['admonition', `admonition_${blockNode.info}`],
    },
    {
      type: 'html',
      content: htmlContent,
      outerNewLine: true,
    },
    { type: 'closeTag', tagName: 'div', outerNewLine: true },
  ];
};

export const customHTMLRenderer: CustomHTMLRenderer = {
  note(node) {
    return getHTMLTokens(node);
  },
  warning(node) {
    return getHTMLTokens(node);
  },
  danger(node) {
    return getHTMLTokens(node);
  },
  info(node) {
    return getHTMLTokens(node);
  },
  tip(node) {
    return getHTMLTokens(node);
  },
  caution(node) {
    return getHTMLTokens(node);
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
  link(node, { origin, entering }) {
    const linkNode = node as LinkMdNode;

    // get the origin result
    const originResult = (origin && origin()) as OpenTagToken;

    // get the attributes
    const attributes = originResult.attributes ?? {};

    // derive the target
    const target = linkNode.destination?.startsWith('#') ? '_self' : '_blank';

    if (entering) {
      originResult.attributes = {
        ...attributes,
        target,
      };
    }

    return originResult;
  },
  heading(node, { entering, origin, getChildrenText }) {
    // get the origin result
    const originResult = (origin && origin()) as OpenTagToken;

    // get the attributes
    const attributes = originResult.attributes ?? {};

    const headingNode = node as HeadingMdNode;
    const childrenText = getChildrenText(headingNode);

    /**
     * create an id from the child text without any space and punctuation
     * and make it lowercase for bookmarking
     * @example (Postgres) will be postgres
     */
    let id = childrenText
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();

    const match = childrenText.match(markdownTextAndIdRegex);

    // if id regex matched then override the id with matched ID
    if (match) {
      id = match[2];
    }

    // if it is a opening tag
    if (entering) {
      originResult.attributes = {
        ...attributes,
        id,
      };
    }

    return originResult;
  },
  text(node) {
    let nodeText = '';
    const nodeLiteral = node.literal ?? '';

    // check if node literal has id and text
    const match = nodeLiteral.match(markdownTextAndIdRegex);

    // get the text only (without $(id="some_value"))
    if (match) {
      nodeText = match[1];
    } else {
      nodeText = nodeLiteral;
    }

    return {
      type: 'text',
      content: nodeText,
    } as TextToken;
  },
};
