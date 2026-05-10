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
import { Button, Tooltip } from 'antd';
import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../../assets/svg/icon-copy.svg';
import { useClipboard } from '../../../../hooks/useClipBoard';

const CodeBlockComponent: FC<NodeViewProps> = ({ node }) => {
  const { t } = useTranslation();
  const { onCopyToClipBoard, hasCopied } = useClipboard('', 2000);

  const handleCopy = useCallback(async () => {
    await onCopyToClipBoard(node.textContent);
  }, [node, onCopyToClipBoard]);

  return (
    <NodeViewWrapper as="pre" className="relative code-block">
      <NodeViewContent as="code" />
      <span className="code-copy-button" data-copied={hasCopied}>
        <Tooltip
          open={hasCopied || undefined}
          title={hasCopied ? t('label.copied') : t('label.copy')}>
          <Button
            data-testid="code-block-copy-icon"
            icon={<CopyIcon height={24} width={24} />}
            type="text"
            onClick={handleCopy}
          />
        </Tooltip>
      </span>
    </NodeViewWrapper>
  );
};

export default CodeBlockComponent;
