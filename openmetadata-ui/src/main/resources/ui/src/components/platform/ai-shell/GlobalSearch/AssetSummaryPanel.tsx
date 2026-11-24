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
import { Badge, Button, ButtonUtility } from '@openmetadata/ui-core-components';
import { ArrowRight, XClose } from '@openmetadata/ui-core-components/icons';
import { get, startCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import { TagSource } from '../../../../generated/type/tagLabel';
import { GlobalSearchRow } from './GlobalSearch.types';

interface NamedRef {
  displayName?: string;
  name?: string;
}

interface TagRef {
  tagFQN: string;
  source?: TagSource;
}

export interface AssetSummaryPanelProps {
  row?: GlobalSearchRow;
  onClose: () => void;
  onOpen: (row: GlobalSearchRow) => void;
}

const names = (refs: NamedRef[] = []) =>
  refs
    .map((ref) => ref.displayName || ref.name)
    .filter(Boolean)
    .join(', ');

const AssetSummaryPanel = ({
  row,
  onClose,
  onOpen,
}: AssetSummaryPanelProps) => {
  const { t } = useTranslation();
  if (!row) {
    return null;
  }
  const source = row.source;
  const tags: TagRef[] = get(source, 'tags', []);
  const columnCount = (get(source, 'columns') as unknown[] | undefined)?.length;
  const status: string | undefined = get(source, 'entityStatus');
  const description: string = get(source, 'description', '');
  const isTier = (tag: TagRef) => tag.tagFQN.startsWith('Tier.');
  const isCertification = (tag: TagRef) =>
    tag.tagFQN.startsWith('Certification.');

  const stats = [
    columnCount === undefined
      ? null
      : { key: t('label.column-plural'), value: String(columnCount) },
    get(source, 'dataType')
      ? { key: t('label.data-type'), value: String(get(source, 'dataType')) }
      : null,
    get(source, 'service.displayName') || get(source, 'service.name')
      ? {
          key: t('label.service'),
          value: String(
            get(source, 'service.displayName') || get(source, 'service.name')
          ),
        }
      : null,
  ].filter((stat): stat is { key: string; value: string } => stat !== null);

  const details = [
    { key: t('label.owner-plural'), value: names(get(source, 'owners')) },
    { key: t('label.domain-plural'), value: names(get(source, 'domains')) },
    {
      key: t('label.tag-plural'),
      value: tags
        .filter(
          (tag) =>
            tag.source !== TagSource.Glossary &&
            !isTier(tag) &&
            !isCertification(tag)
        )
        .map((tag) => tag.tagFQN)
        .join(', '),
    },
    {
      key: t('label.glossary-term-plural'),
      value: tags
        .filter((tag) => tag.source === TagSource.Glossary)
        .map((tag) => tag.tagFQN)
        .join(', '),
    },
  ];

  return (
    <aside
      aria-label={t('label.summary')}
      className="tw:flex tw:w-90 tw:shrink-0 tw:flex-col tw:border-l tw:border-secondary"
      data-testid="global-search-summary">
      <div className="tw:flex tw:items-start tw:gap-3 tw:p-4">
        <span className="tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center">
          {row.icon}
        </span>
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
          <span className="tw:truncate tw:text-sm tw:font-semibold tw:text-primary">
            {row.title}
          </span>
          <span className="tw:truncate tw:text-xs tw:text-tertiary">
            {row.meta}
          </span>
        </div>
        <ButtonUtility
          color="tertiary"
          data-testid="global-search-summary-close"
          icon={XClose}
          size="xs"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      </div>
      <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-4 tw:overflow-y-auto tw:px-4 tw:pb-4">
        <div className="tw:flex tw:flex-wrap tw:gap-1.5">
          <Badge size="sm">{startCase(source?.entityType)}</Badge>
          {row.badges?.map((badge) => (
            <Badge key={badge} size="sm">
              {badge}
            </Badge>
          ))}
          {status ? <Badge size="sm">{status}</Badge> : null}
        </div>
        <div className="tw:flex tw:flex-col tw:gap-1">
          <span className="tw:text-xs tw:font-medium tw:text-tertiary">
            {t('label.description')}
          </span>
          <p className="tw:m-0 tw:line-clamp-4 tw:text-sm tw:text-secondary">
            {description || t('label.no-description')}
          </p>
        </div>
        {stats.length > 0 ? (
          <dl className="tw:m-0 tw:grid tw:grid-cols-2 tw:gap-3">
            {stats.map((stat) => (
              <div className="tw:flex tw:flex-col" key={stat.key}>
                <dt className="tw:text-xs tw:text-tertiary">{stat.key}</dt>
                <dd className="tw:m-0 tw:truncate tw:text-sm tw:font-medium tw:text-primary">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        <dl className="tw:m-0 tw:flex tw:flex-col tw:divide-y tw:divide-secondary">
          {details.map((detail) => (
            <div
              className="tw:flex tw:flex-col tw:gap-0.5 tw:py-2"
              key={detail.key}>
              <dt className="tw:text-xs tw:text-tertiary">{detail.key}</dt>
              <dd className="tw:m-0 tw:truncate tw:text-sm tw:text-primary">
                {detail.value || '--'}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="tw:border-t tw:border-secondary tw:p-3">
        <Button
          className="tw:w-full"
          color="secondary"
          data-testid="global-search-summary-open"
          iconTrailing={ArrowRight}
          size="sm"
          onClick={() => onOpen(row)}>
          {t('label.open')}
        </Button>
      </div>
    </aside>
  );
};

export default AssetSummaryPanel;
