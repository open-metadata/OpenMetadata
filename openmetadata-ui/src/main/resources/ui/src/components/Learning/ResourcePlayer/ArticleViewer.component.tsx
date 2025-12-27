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

import { LinkOutlined } from '@ant-design/icons';
import { Alert, Button, Spin } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LearningResource } from '../../../rest/learningResourceAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditorPreviewer from '../../common/RichTextEditor/RichTextEditorPreviewer';
import './ArticleViewer.less';

interface ArticleViewerProps {
  resource: LearningResource;
}

export const ArticleViewer: React.FC<ArticleViewerProps> = ({ resource }) => {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check for embedded content in embedConfig first
      if (resource.source.embedConfig?.content) {
        setContent(resource.source.embedConfig.content);
      } else if (resource.source.url.startsWith('http')) {
        const response = await fetch(resource.source.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch article: ${response.statusText}`);
        }
        const text = await response.text();
        setContent(text);
      } else {
        setContent(resource.source.url);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load article';
      setError(errorMessage);
      showErrorToast(err as AxiosError, t('server.article-fetch-error'));
    } finally {
      setIsLoading(false);
    }
  }, [resource.source.url, resource.source.embedConfig, t]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  if (isLoading) {
    return (
      <div className="article-viewer-loading">
        <Spin size="large" tip={t('label.loading-article')} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="article-viewer-error">
        <Alert
          showIcon
          action={
            <Button
              href={resource.source.url}
              icon={<LinkOutlined />}
              rel="noopener noreferrer"
              size="small"
              target="_blank"
              type="link">
              {t('label.open-original')}
            </Button>
          }
          description={error}
          message={t('message.failed-to-load-article')}
          type="error"
        />
      </div>
    );
  }

  return (
    <div className="article-viewer-container">
      <div className="article-viewer-content">
        <RichTextEditorPreviewer
          enableSeeMoreVariant={false}
          markdown={content}
        />
      </div>
    </div>
  );
};
