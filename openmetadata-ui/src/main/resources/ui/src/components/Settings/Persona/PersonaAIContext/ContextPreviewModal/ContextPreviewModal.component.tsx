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
import {
  Badge,
  Box,
  Button,
  CloseButton,
  Dialog,
  Modal,
  ModalOverlay,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { Copy01, RefreshCcw01, Stars01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../../../hooks/useClipBoard';
import {
  getPersonaAIContextDocument,
  PersonaContextDocument,
  refreshPersonaAIContextDocument,
} from '../../../../../rest/PersonaAPI';
import { getRelativeTime } from '../../../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import Loader from '../../../../common/Loader/Loader';
import RichTextEditorPreviewNew from '../../../../common/RichTextEditor/RichTextEditorPreviewNew';

interface ContextPreviewModalProps {
  open: boolean;
  personaDisplayName: string;
  personaId: string;
  onClose: () => void;
  onDocumentLoaded?: (document: PersonaContextDocument) => void;
}

type PreviewMode = 'rendered' | 'raw';

const FRONT_MATTER_CLASS = [
  'tw:mb-6 tw:shrink-0 tw:rounded-xl tw:border tw:border-secondary',
  'tw:bg-secondary tw:px-5 tw:py-4 tw:font-mono tw:text-[13px]',
  'tw:leading-relaxed tw:wrap-break-word tw:whitespace-pre-wrap tw:text-tertiary',
].join(' ');

const HEADING_BASE_CLASS =
  'tw:w-full tw:cursor-pointer tw:rounded-md tw:px-2.5 tw:py-1.5 tw:text-left tw:transition tw:hover:bg-secondary_hover';

const getHeadingStateClass = (isActive: boolean, isNested: boolean) => {
  let stateClass = 'tw:font-medium tw:text-secondary';
  if (isActive) {
    stateClass = 'tw:bg-brand-primary tw:font-semibold tw:text-brand-secondary';
  } else if (isNested) {
    stateClass = 'tw:font-normal tw:text-tertiary';
  }

  return stateClass;
};

const getHeadingClassName = (isActive: boolean, isNested: boolean) => {
  const sizeClass = isNested
    ? 'tw:pl-5.5 tw:font-mono tw:text-[12px]'
    : 'tw:text-[13px]';

  return [
    HEADING_BASE_CLASS,
    sizeClass,
    getHeadingStateClass(isActive, isNested),
  ].join(' ');
};

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
  const [activeHeading, setActiveHeading] = useState(0);
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
          : await getPersonaAIContextDocument(personaId);
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

  const { frontMatterText, bodyMarkdown } = useMemo(() => {
    const frontMatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!frontMatter) {
      return { bodyMarkdown: markdown, frontMatterText: '' };
    }

    return {
      bodyMarkdown: markdown.slice(frontMatter[0].length).trimStart(),
      frontMatterText: `---\n${frontMatter[1].trim()}\n---`,
    };
  }, [markdown]);

  // Derive the TOC from the rendered body only (not the frontmatter) and ignore
  // heading-looking lines inside fenced code blocks, so the positional index
  // stays aligned with the h1/h2 elements react-markdown renders.
  const headings = useMemo(() => {
    const result: { label: string; level: number }[] = [];
    let insideFence = false;
    for (const line of bodyMarkdown.split('\n')) {
      if (/^\s*(```|~~~)/.test(line)) {
        insideFence = !insideFence;

        continue;
      }
      const match = insideFence ? null : line.match(/^(#{1,2})\s+(.*)/);
      if (!match) {
        continue;
      }
      const level = match[1].length;
      const text = match[2].trim();
      const label =
        level > 1
          ? text
              .replace(/^[\w &/-]+:\s*/, '')
              .split('.')
              .pop() ?? text
          : text;
      result.push({ label, level });
      if (result.length >= 40) {
        break;
      }
    }

    return result;
  }, [bodyMarkdown]);

  const scrollToHeading = useCallback((index: number) => {
    setActiveHeading(index);
    const heading = documentPaneRef.current?.querySelectorAll('h1, h2')[index];
    heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const stats = [
    t('message.persona-context-entities-included', {
      count: contextDocument?.entitiesIncluded ?? 0,
    }),
    t('message.persona-context-truncated-count', {
      count: contextDocument?.truncatedCount ?? 0,
    }),
    t('message.persona-context-token-estimate', {
      count: contextDocument?.tokensEst ?? 0,
    }),
    t('message.persona-context-size', {
      count: Math.max(1, Math.ceil((contextDocument?.bytes ?? 0) / 1024)),
    }),
    ...(contextDocument?.generatedAt
      ? [
          t('message.persona-context-generated-time', {
            time: getRelativeTime(contextDocument.generatedAt),
          }),
        ]
      : []),
  ];

  const renderPreviewContent = (): ReactNode => {
    if (loadError && !contextDocument) {
      return (
        <Box
          align="center"
          className="tw:min-h-0 tw:flex-1 tw:p-10"
          direction="col"
          gap={4}
          justify="center">
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('server.unexpected-error')}
          </Typography>
          <Button color="primary" onClick={() => fetchPreview()}>
            {t('label.try-again')}
          </Button>
        </Box>
      );
    }

    if (loading && !contextDocument) {
      return (
        <Box
          align="center"
          className="tw:min-h-0 tw:flex-1 tw:p-10"
          data-testid="persona-context-preview-loading"
          justify="center">
          <Loader />
        </Box>
      );
    }

    if (mode === 'raw') {
      return (
        <pre
          className="tw:m-0 tw:min-h-0 tw:flex-1 tw:overflow-auto tw:px-9 tw:py-7 tw:font-mono tw:text-[13px] tw:leading-relaxed tw:wrap-break-word tw:whitespace-pre-wrap tw:text-tertiary"
          data-testid="persona-context-raw-document">
          {markdown}
        </pre>
      );
    }

    return (
      <Box className="tw:grid! tw:min-h-0 tw:flex-1 tw:grid-cols-[240px_1fr] tw:overflow-hidden">
        <Box
          className="tw:gap-0.5 tw:overflow-auto tw:border-r tw:border-secondary tw:bg-secondary tw:p-4"
          direction="col">
          <Box className="tw:mb-2 tw:px-2.5">
            <Typography
              className="tw:text-[11px] tw:tracking-wider tw:text-quaternary tw:uppercase"
              weight="semibold">
              {t('label.content')}
            </Typography>
          </Box>
          {headings.map((heading, index) => (
            <Typography
              as="button"
              className={getHeadingClassName(
                activeHeading === index,
                heading.level > 1
              )}
              key={`${heading.label}-${index}`}
              onClick={() => scrollToHeading(index)}>
              {heading.label}
            </Typography>
          ))}
        </Box>
        <Box
          className="tw:min-w-0 tw:overflow-auto tw:px-9 tw:py-7"
          direction="col"
          ref={documentPaneRef}>
          {frontMatterText && (
            <pre className={FRONT_MATTER_CLASS}>{frontMatterText}</pre>
          )}
          <RichTextEditorPreviewNew
            isDescriptionExpanded
            enableSeeMoreVariant={false}
            markdown={bodyMarkdown}
          />
        </Box>
      </Box>
    );
  };

  return (
    <ModalOverlay
      isDismissable
      isOpen={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <Modal>
        <Dialog data-testid="persona-context-preview-modal" width={1150}>
          <Box className="tw:max-h-[85vh]" direction="col">
            <Dialog.Header className="tw:flex tw:flex-col tw:gap-3 tw:border-b tw:border-secondary tw:pb-4">
              <Box align="center" gap={4} justify="between">
                <Box align="center" className="tw:min-w-0" gap={2}>
                  <Stars01 className="tw:size-5 tw:shrink-0 tw:text-brand-secondary" />
                  <Typography ellipsis size="text-lg" weight="semibold">
                    {t('label.ai-context-for-entity', {
                      entity: personaDisplayName,
                    })}
                  </Typography>
                </Box>
                <Box align="center" className="tw:shrink-0" gap={2}>
                  <Tabs
                    className="tw:w-max"
                    data-testid="persona-context-preview-mode"
                    selectedKey={mode}
                    onSelectionChange={(key) => setMode(key as PreviewMode)}>
                    <Tabs.List size="sm" type="button-border">
                      <Tabs.Item
                        className="tw:py-1!"
                        data-testid="persona-context-preview-rendered"
                        id="rendered">
                        {t('label.rendered')}
                      </Tabs.Item>
                      <Tabs.Item
                        className="tw:py-1!"
                        data-testid="persona-context-preview-raw"
                        id="raw">
                        {t('label.raw')}
                      </Tabs.Item>
                    </Tabs.List>
                  </Tabs>
                  <Button
                    color="secondary"
                    data-testid="refresh-persona-context"
                    iconLeading={RefreshCcw01}
                    isLoading={loading}
                    size="sm"
                    onClick={() => fetchPreview(true)}>
                    {t('label.refresh')}
                  </Button>
                  <Button
                    color="secondary"
                    data-testid="copy-persona-context"
                    iconLeading={Copy01}
                    size="sm"
                    onClick={() => onCopyToClipBoard()}>
                    {hasCopied ? t('label.copied') : t('label.copy')}
                  </Button>
                  <CloseButton size="md" onClick={onClose} />
                </Box>
              </Box>
              <Box align="center" gap={2} wrap="wrap">
                {stats.map((stat, index) => (
                  <Box align="center" gap={2} key={stat}>
                    {index > 0 && (
                      <Typography className="tw:text-quaternary" size="text-sm">
                        ·
                      </Typography>
                    )}
                    <Typography className="tw:text-secondary" size="text-sm">
                      {stat}
                    </Typography>
                  </Box>
                ))}
                {contextDocument?.cacheState && (
                  <Badge color="gray" size="sm">
                    {contextDocument.cacheState.toLowerCase()}
                  </Badge>
                )}
              </Box>
            </Dialog.Header>

            {renderPreviewContent()}
          </Box>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
