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
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import CopyButton from '../../../common/CopyButton/CopyButton';

const CodeBlockComponent: FC<NodeViewProps> = ({ node }) => {
  const { t } = useTranslation();

  return (
    <NodeViewWrapper as="pre" className="tw:group tw:relative code-block">
      <NodeViewContent<'code'> as="code" />
      <CopyButton
        className="tw:absolute tw:top-1.5 tw:right-1.5 tw:opacity-0 tw:group-hover:opacity-60 tw:hover:opacity-100 tw:focus-visible:opacity-100"
        testId="code-block-copy-icon"
        tooltip={t('label.copy')}
        value={node.textContent}
      />
    </NodeViewWrapper>
  );
};

export default CodeBlockComponent;
