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
  BadgeWithIcon,
  Box,
  Button,
  ButtonUtility,
  Card,
  Divider,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ArrowRight,
  Clock,
  Database01,
  ShieldTick,
  Tag01,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { get, startCase } from 'lodash';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import { TagSource } from '../../../../generated/type/tagLabel';
import { EntityIconSize } from '../../../../utils/EntityIconUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { BREADCRUMB_SEPARATOR } from './GlobalSearch.constants';
import { GlobalSearchRow } from './GlobalSearch.types';
import { useAssetSummaryStats } from './useAssetSummaryStats';

const EMPTY_VALUE = '—';
const ELLIPSIS = { excludeTriggerFromTabOrder: true };

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
  refs.map((ref) => ref.displayName || ref.name || '').filter(Boolean);

const lastSegment = (fqn: string) => fqn.split('.').pop() ?? fqn;

const isClassification = (tag: TagRef) =>
  tag.source !== TagSource.Glossary &&
  !tag.tagFQN.startsWith('Tier.') &&
  !tag.tagFQN.startsWith('Certification.');

const AssetSummaryPanel = ({
  row,
  onClose,
  onOpen,
}: AssetSummaryPanelProps) => {
  const { t } = useTranslation();
  const counts = useAssetSummaryStats(row?.source);

  if (!row) {
    return null;
  }

  const source = row.source;
  const entityType = source?.entityType ?? '';
  const tags: TagRef[] = get(source, 'tags', []);
  const tier: string | undefined = get(source, 'tier.tagFQN');
  const certification: string | undefined = get(
    source,
    'certification.tagLabel.tagFQN'
  );
  const status: string | undefined = get(source, 'entityStatus');
  const description: string = get(source, 'description', '');
  const columns = get(source, 'columns') as unknown[] | undefined;
  const formatCount = (count?: number) =>
    count === undefined ? EMPTY_VALUE : String(count);

  const getStats = () => {
    if (entityType === EntityType.TABLE_COLUMN) {
      return [
        {
          key: t('label.data-type'),
          value: get(source, 'dataType', EMPTY_VALUE),
        },
        {
          key: t('label.in-table'),
          value: row.path?.split(BREADCRUMB_SEPARATOR).pop() ?? EMPTY_VALUE,
        },
      ];
    }
    const lineage = [
      { key: t('label.upstream'), value: formatCount(counts.upstream) },
      { key: t('label.downstream'), value: formatCount(counts.downstream) },
    ];

    return columns
      ? [
          { key: t('label.column-plural'), value: String(columns.length) },
          {
            key: t('label.incident-plural'),
            value: formatCount(counts.incidents),
          },
          ...lineage,
        ]
      : lineage;
  };

  const details = [
    { key: t('label.owner-plural'), values: names(get(source, 'owners')) },
    { key: t('label.domain-plural'), values: names(get(source, 'domains')) },
    {
      key: t('label.tag-plural'),
      values: tags.filter(isClassification).map((tag) => tag.tagFQN),
    },
    {
      key: t('label.glossary-term-plural'),
      values: tags
        .filter((tag) => tag.source === TagSource.Glossary)
        .map((tag) => lastSegment(tag.tagFQN)),
    },
  ];

  return (
    <Box className="tw:w-90 tw:flex-none" data-testid="global-search-summary">
      <Divider orientation="vertical" />
      <Box
        aria-label={t('label.summary')}
        className="tw:min-w-0 tw:flex-1"
        direction="col"
        role="complementary">
        <Box align="center" className="tw:px-5 tw:py-4" gap={3}>
          {searchClassBase.getEntityIconWithBg(
            entityType,
            EntityIconSize.Size18
          )}
          <Box className="tw:min-w-0 tw:flex-1" direction="col">
            <Typography ellipsis size="text-sm" weight="semibold">
              {row.title}
            </Typography>
            <Box align="center" className="tw:min-w-0" gap={1}>
              <Database01 size={12} />
              <Typography color="quaternary" ellipsis={ELLIPSIS} size="text-xs">
                {row.path}
              </Typography>
            </Box>
          </Box>
          <ButtonUtility
            color="tertiary"
            data-testid="global-search-summary-close"
            icon={XClose}
            size="md"
            tooltip={t('label.close')}
            onClick={onClose}
          />
        </Box>
        <Divider />

        <Box
          className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-5 tw:py-4"
          direction="col"
          gap={4}>
          <Box gap={1} wrap="wrap">
            <BadgeWithIcon
              color="gray"
              iconLeading={Database01}
              size="sm"
              type="modern">
              {startCase(entityType)}
            </BadgeWithIcon>
            {tier ? (
              <BadgeWithIcon
                color="gray"
                iconLeading={Tag01}
                size="sm"
                type="modern">
                {startCase(lastSegment(tier))}
              </BadgeWithIcon>
            ) : null}
            {certification ? (
              <BadgeWithIcon
                color="gray"
                iconLeading={ShieldTick}
                size="sm"
                type="modern">
                {lastSegment(certification)}
              </BadgeWithIcon>
            ) : null}
            {status ? (
              <BadgeWithIcon
                color="gray"
                iconLeading={Clock}
                size="sm"
                type="modern">
                {status}
              </BadgeWithIcon>
            ) : null}
          </Box>

          <Box direction="col" gap={1}>
            <Typography color="quaternary" size="text-xs" weight="medium">
              {t('label.about')}
            </Typography>
            <Typography ellipsis={{ rows: 3 }} size="text-xs">
              {description || t('label.no-description')}
            </Typography>
          </Box>

          <Card className="tw:flex-none" size="sm" variant="muted">
            <Card.Content>
              <Box align="stretch" gap={3}>
                {getStats().map((stat, index) => (
                  <Fragment key={stat.key}>
                    {index > 0 ? <Divider orientation="vertical" /> : null}
                    <Box className="tw:min-w-0 tw:flex-1" direction="col">
                      <Typography ellipsis color="quaternary" size="text-xs">
                        {stat.key}
                      </Typography>
                      <Typography ellipsis size="text-sm" weight="semibold">
                        {stat.value}
                      </Typography>
                    </Box>
                  </Fragment>
                ))}
              </Box>
            </Card.Content>
          </Card>

          <Box direction="col" gap={3}>
            {details.map((detail) => (
              <Box direction="col" gap={1} key={detail.key}>
                <Box align="center" gap={1}>
                  <Typography color="quaternary" size="text-xs" weight="medium">
                    {detail.key}
                  </Typography>
                  {detail.values.length > 0 ? (
                    <Badge color="gray" size="sm" type="pill-color">
                      {detail.values.length}
                    </Badge>
                  ) : null}
                </Box>
                <Typography
                  ellipsis
                  color={detail.values.length ? undefined : 'quaternary'}
                  size="text-xs">
                  {detail.values.join(', ') ||
                    t('label.no-entity', { entity: detail.key })}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider />
        <Box className="tw:px-5 tw:py-4">
          <Button
            className="tw:w-full"
            color="primary"
            data-testid="global-search-summary-open"
            iconTrailing={ArrowRight}
            size="md"
            onClick={() => onOpen(row)}>
            {t('label.open-entity', { entity: startCase(entityType) })}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default AssetSummaryPanel;
