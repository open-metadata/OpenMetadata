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
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CopyIcon from '../../../../assets/svg/icon-copy.svg';

const CodeBlockComponent: FC<NodeViewProps> = ({ node }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard write failed silently
    }
  }, [node]);

  return (
    <NodeViewWrapper as="pre" className="relative code-block">
      <NodeViewContent as="code" />
      <span
        className="code-copy-message"
        data-copied={copied}
        data-testid="copied-message">
        {t('label.copied')}
      </span>
      <button
        className="code-copy-button"
        data-copied={copied}
        data-testid="code-block-copy-icon"
        type="button"
        onClick={handleCopy}>
        <img alt="copy" height={24} src={CopyIcon} width={24} />
      </button>
    </NodeViewWrapper>
  );
};

export default CodeBlockComponent;
