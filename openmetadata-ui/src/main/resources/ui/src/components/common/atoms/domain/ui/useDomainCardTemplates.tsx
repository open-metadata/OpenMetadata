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

import { Grid, Typography } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataProduct } from '../../../../../generated/entity/domains/dataProduct';
import { Domain } from '../../../../../generated/entity/domains/domain';
import {
  getClassificationTags,
  getGlossaryTags,
} from '../../../../../utils/TagsUtils';
import { ColumnConfig } from '../../shared/types';

/**
 * Provides card layout templates for different entity types
 *
 * @description
 * Creates flexible card templates that define how different entity types
 * should be displayed in card view. Each template uses the renderCell
 * function to maintain consistency with table rendering.
 *
 * Templates are completely flexible and can be customized per entity type:
 * - Single column rows for full-width content
 * - Two column rows for compact side-by-side content
 * - Different layouts for different entity types
 *
 * @example
 * ```typescript
 * const { domainCardTemplate, dataProductCardTemplate } = useDomainCardTemplates();
 *
 * // Use with useCardView:
 * const { cardView } = useCardView({
 *   listing: domainListing,
 *   cardTemplate: domainCardTemplate
 * });
 * ```
 *
 * @stability Stable - Pure template functions
 * @complexity Medium - Multiple layout configurations
 */
export const useDomainCardTemplates = () => {
  const { t } = useTranslation();

  // Domain card template
  const domainCardTemplate = useMemo(
    () =>
      (
        entity: Domain,
        renderCell: (
          entity: Domain,
          column: ColumnConfig<Domain>
        ) => React.ReactNode
      ) =>
        (
          <>
            <div className="tw:mb-3">
              {renderCell(entity, {
                key: 'name',
                labelKey: 'label.domain',
                render: 'entityName',
              })}
            </div>

            <Grid className="tw:mb-3" gap="4">
              <Grid.Item span={12}>
                <Typography
                  className="tw:mb-0.5 tw:text-gray-700"
                  size="text-xs">
                  {t('label.owner')}
                </Typography>
                {renderCell(entity, {
                  key: 'owners',
                  labelKey: 'label.owner-plural',
                  render: 'owners',
                })}
              </Grid.Item>
              <Grid.Item span={12}>
                <Typography
                  className="tw:mb-0.5 tw:text-gray-700"
                  size="text-xs">
                  {t('label.domain-type')}
                </Typography>
                {renderCell(entity, {
                  key: 'domainType',
                  labelKey: 'label.domain-type',
                  render: 'custom',
                  customRenderer: 'domainTypeChip',
                })}
              </Grid.Item>
            </Grid>

            <Grid gap="4">
              <Grid.Item span={12}>
                <Typography
                  className="tw:mb-0.5 tw:text-gray-700"
                  size="text-xs">
                  {t('label.glossary-term-plural')}
                </Typography>
                {renderCell(entity, {
                  key: 'glossaryTerms',
                  labelKey: 'label.glossary-term-plural',
                  render: 'tags',
                  getValue: (entity) => getGlossaryTags(entity.tags),
                })}
              </Grid.Item>
              <Grid.Item span={12}>
                <Typography
                  className="tw:mb-0.5 tw:text-gray-700"
                  size="text-xs">
                  {t('label.tag-plural')}
                </Typography>
                {renderCell(entity, {
                  key: 'classificationTags',
                  labelKey: 'label.tag-plural',
                  render: 'tags',
                  getValue: (entity) => getClassificationTags(entity.tags),
                })}
              </Grid.Item>
            </Grid>
          </>
        ),
    []
  );

  // Data product card template (different layout)
  const dataProductCardTemplate = useMemo(
    () =>
      (
        entity: DataProduct,
        renderCell: (
          entity: DataProduct,
          column: ColumnConfig<DataProduct>
        ) => React.ReactNode
      ) =>
        (
          <>
            <div className="tw:mb-3">
              {renderCell(entity, {
                key: 'name',
                labelKey: 'label.data-product',
                render: 'entityName',
              })}
            </div>

            <Grid className="tw:mb-3" gap="4">
              <Grid.Item className="tw:min-w-0 tw:overflow-hidden" span={12}>
                <Typography
                  className="tw:mb-0.5 tw:text-gray-700"
                  size="text-xs">
                  {t('label.owner-plural')}
                </Typography>
                {renderCell(entity, {
                  key: 'owners',
                  labelKey: 'label.owner',
                  render: 'owners',
                })}
              </Grid.Item>
              <Grid.Item className="tw:min-w-0 tw:overflow-hidden" span={12}>
                <Typography
                  className="tw:mb-0.5 tw:text-gray-700"
                  size="text-xs">
                  {t('label.expert-plural')}
                </Typography>
                {renderCell(entity, {
                  key: 'experts',
                  labelKey: 'label.expert-plural',
                  render: 'owners',
                })}
              </Grid.Item>
            </Grid>

            <Grid gap="4">
              <Grid.Item className="tw:min-w-0 tw:overflow-hidden" span={12}>
                <Typography
                  className="tw:mb-0.5 tw:text-gray-700"
                  size="text-xs">
                  {t('label.glossary-term-plural')}
                </Typography>
                {renderCell(entity, {
                  key: 'glossaryTerms',
                  labelKey: 'label.glossary-term-plural',
                  render: 'tags',
                  getValue: (entity) => getGlossaryTags(entity.tags),
                })}
              </Grid.Item>
              <Grid.Item className="tw:min-w-0 tw:overflow-hidden" span={12}>
                <Typography
                  className="tw:mb-0.5 tw:text-gray-700"
                  size="text-xs">
                  {t('label.tag-plural')}
                </Typography>
                {renderCell(entity, {
                  key: 'classificationTags',
                  labelKey: 'label.tag-plural',
                  render: 'tags',
                  getValue: (entity) => getClassificationTags(entity.tags),
                })}
              </Grid.Item>
            </Grid>
          </>
        ),
    []
  );

  return {
    domainCardTemplate,
    dataProductCardTemplate,
  };
};
