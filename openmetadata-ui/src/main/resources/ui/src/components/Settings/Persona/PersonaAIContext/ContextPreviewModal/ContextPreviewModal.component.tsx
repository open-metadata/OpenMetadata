/*
 *  Copyright 2026 Collate.
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
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Button,
  Empty,
  Modal,
  Segmented,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../../../hooks/useClipBoard';
import {
  getPersonaAIContextDocument,
  PersonaContextDocument,
  refreshPersonaAIContextDocument,
} from '../../../../../rest/PersonaAPI';
import { getRelativeTime } from '../../../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import RichTextEditorPreviewNew from '../../../../common/RichTextEditor/RichTextEditorPreviewNew';

interface ContextPreviewModalProps {
  open: boolean;
  personaDisplayName: string;
  personaId: string;
  onClose: () => void;
  onDocumentLoaded?: (document: PersonaContextDocument) => void;
}

type PreviewMode = 'rendered' | 'raw';

export const ContextPreviewModal = ({
  open,
  personaDisplayName,
  personaId,
  onClose,
  onDocumentLoaded,
}: ContextPreviewModalProps) => {
  const { t } = useTranslation();
  const documentPaneRef = useRef<HTMLDivElement>(null);
  const onDocumentLoadedRef = useRef(onDocumentLoaded);
  const previewRequestRef = useRef(0);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contextDocument, setContextDocument] =
    useState<PersonaContextDocument>();
  const [mode, setMode] = useState<PreviewMode>('rendered');
  const markdown = contextDocument?.markdown ?? '';
  const { hasCopied, onCopyToClipBoard } = useClipboard(markdown);

  useEffect(() => {
    onDocumentLoadedRef.current = onDocumentLoaded;
  }, [onDocumentLoaded]);

  const fetchPreview = useCallback(
    async (refresh = false) => {
      const requestId = ++previewRequestRef.current;
      try {
        setLoadError(false);
        setLoading(true);
        const response = refresh
          ? await refreshPersonaAIContextDocument(personaId)
          : await getPersonaAIContextDocument(personaId, 'rendered');
        if (requestId === previewRequestRef.current) {
          setContextDocument(response);
          onDocumentLoadedRef.current?.(response);
        }
      } catch (error) {
        if (requestId === previewRequestRef.current) {
          setLoadError(true);
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (requestId === previewRequestRef.current) {
          setLoading(false);
        }
      }
    },
    [personaId]
  );

  useEffect(() => {
    if (open) {
      setMode('rendered');
      fetchPreview();
    } else {
      previewRequestRef.current++;
      setLoading(false);
    }

    return () => {
      previewRequestRef.current++;
    };
  }, [fetchPreview, open]);

  const headings = useMemo(
    () =>
      markdown
        .split('\n')
        .filter((line) => /^#{1,2}\s/.test(line))
        .map((line) => line.replace(/^#+\s*/, ''))
        .slice(0, 30),
    [markdown]
  );

  const scrollToHeading = useCallback((index: number) => {
    const heading = documentPaneRef.current?.querySelectorAll('h1, h2')[index];
    heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <Modal
      centered
      destroyOnClose
      className="persona-ai-context-preview-modal"
      data-testid="persona-context-preview-modal"
      footer={null}
      open={open}
      title={t('label.ai-context-for-entity', {
        entity: personaDisplayName,
      })}
      width={1150}
      onCancel={onClose}>
      <div className="persona-ai-context-preview-toolbar">
        <Space wrap size={[8, 8]}>
          <Typography.Text>
            {t('message.persona-context-entities-included', {
              count: contextDocument?.entitiesIncluded ?? 0,
            })}
          </Typography.Text>
          <Typography.Text type="secondary">·</Typography.Text>
          <Typography.Text>
            {t('message.persona-context-truncated-count', {
              count: contextDocument?.truncatedCount ?? 0,
            })}
          </Typography.Text>
          <Typography.Text type="secondary">·</Typography.Text>
          <Typography.Text>
            {t('message.persona-context-token-estimate', {
              count: (contextDocument?.tokensEst ?? 0).toLocaleString(),
            })}
          </Typography.Text>
          <Typography.Text type="secondary">·</Typography.Text>
          <Typography.Text>
            {t('message.persona-context-size', {
              count: Math.max(
                1,
                Math.ceil((contextDocument?.bytes ?? 0) / 1024)
              ),
            })}
          </Typography.Text>
          {contextDocument?.generatedAt && (
            <>
              <Typography.Text type="secondary">·</Typography.Text>
              <Typography.Text>
                {t('message.persona-context-generated-time', {
                  time: getRelativeTime(contextDocument.generatedAt),
                })}
              </Typography.Text>
            </>
          )}
          {contextDocument?.cacheState && (
            <Tag>{contextDocument.cacheState.toLowerCase()}</Tag>
          )}
        </Space>

        <Space>
          <Segmented
            data-testid="persona-context-preview-mode"
            options={[
              { label: t('label.rendered'), value: 'rendered' },
              { label: t('label.raw'), value: 'raw' },
            ]}
            value={mode}
            onChange={(value) => setMode(value as PreviewMode)}
          />
          <Button
            data-testid="refresh-persona-context"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => fetchPreview(true)}>
            {t('label.refresh')}
          </Button>
          <Button
            data-testid="copy-persona-context"
            icon={<CopyOutlined />}
            onClick={() => onCopyToClipBoard()}>
            {hasCopied ? t('label.copied') : t('label.copy')}
          </Button>
        </Space>
      </div>

      {loadError && !contextDocument ? (
        <div className="persona-ai-context-preview-empty">
          <Empty description={t('server.unexpected-error')}>
            <Button type="primary" onClick={() => fetchPreview()}>
              {t('label.try-again')}
            </Button>
          </Empty>
        </div>
      ) : (
        <Spin
          data-testid="persona-context-preview-loading"
          spinning={loading && !contextDocument}>
          {mode === 'rendered' ? (
            <div className="persona-ai-context-preview-layout">
              <aside className="persona-ai-context-preview-toc">
                <Typography.Text strong>{t('label.content')}</Typography.Text>
                {headings.map((heading, index) => (
                  <Button
                    block
                    className="persona-ai-context-toc-item"
                    key={`${heading}-${index}`}
                    type="text"
                    onClick={() => scrollToHeading(index)}>
                    <Typography.Text ellipsis>{heading}</Typography.Text>
                  </Button>
                ))}
              </aside>
              <div
                className="persona-ai-context-preview-document"
                ref={documentPaneRef}>
                <RichTextEditorPreviewNew
                  isDescriptionExpanded
                  enableSeeMoreVariant={false}
                  markdown={markdown}
                />
              </div>
            </div>
          ) : (
            <pre
              className="persona-ai-context-raw-editor"
              data-testid="persona-context-raw-document">
              {markdown}
            </pre>
          )}
        </Spin>
      )}
    </Modal>
  );
};
