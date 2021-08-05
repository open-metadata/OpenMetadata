/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import gfm from 'remark-gfm';

/*eslint-disable  */
const components = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match ? (
      <SyntaxHighlighter
        children={String(children)
          .replace(/\n$/, '')
          .replaceAll(/&nbsp;/g, ' ')
          .replaceAll('<br/>', ' ')}
        {...props}
        language={match[1]}
        PreTag="code"
      />
    ) : (
      <SyntaxHighlighter
        children={String(children)
          .replace(/\n$/, '')
          .replaceAll(/&nbsp;/g, ' ')
          .replaceAll('<br/>', ' ')}
        {...props}
        PreTag="code"
      />
    );
  },
  p({ children }: any) {
    const modifiedChildren = children?.map((child: any, index: number) => {
      if (typeof child === 'string') {
        if (child.startsWith('**') && child.endsWith('**')) {
          const length = child.length;
          return <strong key={index}>{child.substr(2, length - 4)}</strong>;
        }
        if (child.startsWith('~~') && child.endsWith('~~')) {
          const length = child.length;
          return (
            <p
              key={index}
              style={{
                textDecorationLine: 'line-through',
                textDecorationStyle: 'solid',
              }}>
              {child.substr(2, length - 4)}
            </p>
          );
        }
        if (child.startsWith('*') && child.endsWith('*')) {
          const length = child.length;
          return <em key={index}>{child.substr(1, length - 2)}</em>;
        }
        if (child.startsWith('[') && child.endsWith(')')) {
          const textFIndex = child.indexOf('[');
          const textLIndex = child.indexOf(']');
          const linkFIndex = child.indexOf('(');
          const linkLIndex = child.indexOf(')');
          const text = child.substr(textFIndex + 1, textLIndex - 1);
          const link = child.substr(linkFIndex + 1, linkLIndex - 1);
          return (
            <a key={index} href={`${link}`} target="_blank">
              {text}
            </a>
          );
        }
        if (child.startsWith('# ')) {
          return <h1 key={index}>{child.substr(2)}</h1>;
        }
        if (child.startsWith('## ')) {
          return <h2 key={index}>{child.substr(3)}</h2>;
        }
        if (child.startsWith('### ')) {
          return <h3 key={index}>{child.substr(4)}</h3>;
        }
        if (child.startsWith('#### ')) {
          return <h4 key={index}>{child.substr(5)}</h4>;
        }
        if (child.startsWith('##### ')) {
          return <h5 key={index}>{child.substr(6)}</h5>;
        }
        if (child.startsWith('###### ')) {
          return <h6 key={index}>{child.substr(7)}</h6>;
        }
        if (child === '<br/>') {
          return <br key={index} />;
        }
        return child;
      }
      return child;
    });
    return modifiedChildren ?? null;
  },
};

function RichTextEditorPreviewer({ markdown }: { markdown: string }) {
  const [content, setContent] = useState<string>('');
  useEffect(() => {
    setContent(markdown);
  }, [markdown]);

  return (
    <div className="content-container">
      <ReactMarkdown
        /*eslint-disable */
        children={content
          .replaceAll(/&lt;/g, '<')
          .replaceAll(/&gt;/g, '>')
          .replaceAll(/\n/g, '<br/>')}
        components={components}
        remarkPlugins={[gfm]}
        linkTarget="_blank"
      />
    </div>
  );
}

export default RichTextEditorPreviewer;
