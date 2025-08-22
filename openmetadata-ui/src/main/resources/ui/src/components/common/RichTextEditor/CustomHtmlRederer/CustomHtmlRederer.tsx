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
import CodeMirror from 'codemirror';
import 'codemirror/addon/runmode/runmode';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/sql/sql';
import 'codemirror/mode/yaml/yaml';

import katex from 'katex';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import CopyIcon from '../../../../assets/svg/icon-copy.svg';
import {
  markdownTextAndIdRegex,
  MARKDOWN_MATCH_ID,
} from '../../../../constants/regex.constants';
import { MarkdownToHTMLConverter } from '../../../../utils/FeedUtils';
import i18n from '../../../../utils/i18next/LocalUtil';
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

export const CodeMirrorLanguageAliases: Readonly<Record<string, string>> = {
  // Mappings for C-like languages https://codemirror.net/5/mode/clike/index.html
  c: 'text/x-csrc',
  'c++': 'text/x-c++src',
  java: 'text/x-java',
  csharp: 'text/x-csharp',
  scala: 'text/x-scala',
  kotlin: 'text/x-kotlin',
  objectivec: 'text/x-objectivec',
  'objectivec++': 'text/x-objectivec++',
  // Aliases for convenience
  js: 'javascript',
  py: 'python',
  cpp: 'text/x-c++src',
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
  htmlInline(node, { origin }) {
    // This handles inline HTML elements like <span data-id="value">
    const originResult = origin && origin();

    return originResult || null;
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
    const lang = (infoWords?.[0] && infoWords[0]) || null;
    const codeFragments: React.ReactElement[] = [];
    if (codeText && lang) {
      // normalize CodeMirror language (mode) specifier
      const cmLang = CodeMirrorLanguageAliases[lang] || lang;

      // set attributes
      preClasses.push('cm-s-default', `lang-${cmLang}`);
      codeAttrs['data-language'] = cmLang;

      // apply highlight
      CodeMirror.runMode(codeText, cmLang, (text, style) => {
        if (style) {
          const className = style
            .split(/\s+/g)
            .map((s) => `cm-${s}`)
            .join(' ');
          codeFragments.push(<span className={className}>{text}</span>);
        } else {
          codeFragments.push(<React.Fragment>{text}</React.Fragment>);
        }
      });
    } else {
      // plain code block
      codeFragments.push(<React.Fragment>{codeText}</React.Fragment>);
    }

    return [
      {
        type: 'openTag',
        tagName: 'pre',
        classNames: preClasses,
      },
      {
        type: 'html',
        content: ReactDOMServer.renderToString(
          <>
            <code {...codeAttrs}>{...codeFragments}</code>
            <span
              className="code-copy-message"
              data-copied="false"
              data-testid="copied-message">
              {i18n.t('label.copied').toString()}
            </span>
            <img
              className="code-copy-button"
              data-copied="false"
              data-testid="code-block-copy-icon"
              height={24}
              src={CopyIcon}
              width={24}
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
        'data-highlighted': 'false',
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
  section(node) {
    const blockNode = node as CodeBlockMdNode;
    let literal = blockNode.literal ?? '';

    let id = '';

    // check if node literal has id
    const match = literal.match(MARKDOWN_MATCH_ID);

    if (match) {
      // replace the id text with empty string
      // $(id="schema") --> ''
      // we have to do this as we don't want to render the id text
      literal = literal.replace(match[0], '');

      // store the actual id
      id = match[1];
    }

    // Parse inline markdown to html string
    const htmlContent = MarkdownToHTMLConverter.makeHtml(literal);

    return [
      {
        type: 'openTag',
        tagName: 'section',
        attributes: {
          'data-id': id,
          'data-highlighted': 'false',
        },
      },
      {
        type: 'html',
        content: htmlContent,
        outerNewLine: true,
      },
      { type: 'closeTag', tagName: 'section', outerNewLine: true },
    ];
  },

  latex(node) {
    const content = katex.renderToString(node.literal ?? '', {
      throwOnError: false,
      output: 'mathml',
    });

    return [
      { type: 'openTag', tagName: 'div', outerNewLine: true },
      { type: 'html', content: content },
      { type: 'closeTag', tagName: 'div', outerNewLine: true },
    ];
  },
};

export const replaceLatex = (content: string) => {
  try {
    const latexPattern = /\$\$latex[\s\S]*?\$\$/g;
    const latexContentPattern = /\$\$latex\s*([\s\S]*?)\s*\$\$/g;

    return content.replace(latexPattern, (latex) => {
      const matches = [...latex.matchAll(latexContentPattern)];

      if (matches.length === 0) {
        return latex;
      }

      return katex.renderToString(matches[0][1] ?? '', {
        throwOnError: false,
        output: 'mathml',
      });
    });
  } catch (error) {
    return content;
  }
};
