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
  Alert,
  Box,
  Button,
  Skeleton,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { Send01 } from '@untitledui/icons';
import { KeyboardEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import { searchQuery } from '../../../rest/searchAPI';
import {
  getEntityName,
  getEntityNameLabel,
} from '../../../utils/EntityNameUtils';
import { MetricMentionOption } from './MetricActivity.types';
import {
  getMetricMentionQuery,
  insertMetricMention,
} from './MetricActivity.utils';

export interface MetricCommentComposerProps {
  isDisabled?: boolean;
  isLoading?: boolean;
  labelKey?: string;
  onSubmit: (message: string) => Promise<unknown>;
}

const MetricCommentComposer = ({
  isDisabled,
  isLoading,
  labelKey = 'label.comment',
  onSubmit,
}: MetricCommentComposerProps) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const trimmedMessage = message.trim();
  const mentionQuery = useMemo(() => getMetricMentionQuery(message), [message]);
  const suggestionQuery = useQuery({
    queryKey: [
      'metric-activity-mentions',
      mentionQuery?.denotation,
      mentionQuery?.query,
    ],
    queryFn: () =>
      searchQuery({
        pageNumber: 1,
        pageSize: 5,
        query: mentionQuery?.query ?? '',
        searchIndex:
          mentionQuery?.denotation === '@'
            ? [SearchIndex.USER, SearchIndex.TEAM]
            : SearchIndex.DATA_ASSET,
      }),
    enabled: Boolean(mentionQuery),
  });
  const suggestions = useMemo<MetricMentionOption[]>(
    () =>
      (suggestionQuery.data?.hits.hits ?? []).flatMap((hit) => {
        const source = hit._source;
        const type = source.entityType;
        const fullyQualifiedName = source.fullyQualifiedName ?? source.name;
        if (!type || !fullyQualifiedName) {
          return [];
        }

        return [
          {
            displayName: getEntityName(source),
            fullyQualifiedName,
            id: hit._id,
            type,
          },
        ];
      }),
    [suggestionQuery.data]
  );

  const selectSuggestion = (option: MetricMentionOption) => {
    if (!mentionQuery) {
      return;
    }
    setMessage(insertMetricMention(message, mentionQuery, option));
    setActiveSuggestion(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      setActiveSuggestion(
        (current) =>
          (current + offset + suggestions.length) % suggestions.length
      );
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === 'Escape') {
      setMessage(`${message} `);
    }
  };

  const handleSubmit = async () => {
    if (!trimmedMessage) {
      return;
    }
    await onSubmit(trimmedMessage);
    setMessage('');
  };

  return (
    <Box direction="col" gap={2}>
      <TextArea
        aria-label={t(labelKey)}
        data-testid="metric-activity-composer"
        isDisabled={isDisabled || isLoading}
        placeholder={t('message.write-your-text', {
          text: t('label.comment-lowercase'),
        })}
        rows={3}
        value={message}
        onChange={setMessage}
        onKeyDown={handleKeyDown}
      />
      {mentionQuery && (
        <ul
          aria-label={t('label.suggestion-lowercase-plural')}
          className="tw:flex tw:max-h-56 tw:list-none tw:flex-col tw:overflow-y-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:p-1 tw:shadow-lg"
          data-testid="metric-mention-suggestions">
          {suggestionQuery.isPending ? (
            Array.from({ length: 3 }, (_, index) => (
              <li key={index}>
                <Skeleton height={36} variant="rounded" />
              </li>
            ))
          ) : suggestionQuery.error ? (
            <li>
              <Alert
                title={t('server.entity-fetch-error', {
                  entity: t('label.suggestion-lowercase-plural'),
                })}
                variant="error"
              />
            </li>
          ) : suggestions.length === 0 ? (
            <li>
              <Typography
                className="tw:px-3 tw:py-2 tw:text-tertiary"
                size="text-sm">
                {t('label.no-data-found')}
              </Typography>
            </li>
          ) : (
            suggestions.map((option, index) => (
              <li key={option.id}>
                <Button
                  aria-current={activeSuggestion === index}
                  className="tw:w-full tw:justify-start"
                  color="tertiary"
                  data-testid={`metric-mention-suggestion-${option.id}`}
                  size="sm"
                  onPress={() => selectSuggestion(option)}>
                  {mentionQuery.denotation}
                  {option.displayName} · {getEntityNameLabel(option.type)}
                </Button>
              </li>
            ))
          )}
        </ul>
      )}
      <Box justify="end">
        <Button
          color="primary"
          data-testid="metric-activity-composer-submit"
          iconLeading={Send01}
          isDisabled={isDisabled || !trimmedMessage || isLoading}
          isLoading={isLoading}
          size="sm"
          onPress={handleSubmit}>
          {t(labelKey)}
        </Button>
      </Box>
    </Box>
  );
};

export default MetricCommentComposer;
