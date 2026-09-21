/*
 *  Copyright 2024 Collate.
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

import { useEffect, useState } from 'react';
import { PreviewRendererProps } from './FilePreviewer.interface';

const TextRenderer = ({ content }: PreviewRendererProps) => {
  const [text, setText] = useState('');

  useEffect(() => {
    let active = true;
    content.text().then((t) => active && setText(t));

    return () => {
      active = false;
    };
  }, [content]);

  return (
    <pre className="tw:whitespace-pre-wrap tw:break-words tw:text-sm tw:text-primary tw:p-4">
      {text}
    </pre>
  );
};

export default TextRenderer;
