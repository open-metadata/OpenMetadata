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
import gfm from 'remark-gfm';

/*eslint-disable  */
const RichTextEditorPreviewer = ({ markdown }: { markdown: string }) => {
  const [content, setContent] = useState<string>('');
  useEffect(() => {
    setContent(markdown);
  }, [markdown]);
  return (
    <div className="content-container">
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
              <ul style={{ marginLeft: '14px' }} {...rest}>
                {children}
              </ul>
            );
          },
        }}
        remarkPlugins={[gfm]}
      />
    </div>
  );
};

export default RichTextEditorPreviewer;
