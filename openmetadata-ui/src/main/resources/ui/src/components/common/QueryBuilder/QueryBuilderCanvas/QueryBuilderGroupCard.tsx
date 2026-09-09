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
import { Button } from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import classNames from 'classnames';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { QUERY_BUILDER_SURFACE_CLASS } from '../../../../utils/queryBuilder/types';
import type { QueryBuilderGroupCardProps } from './QueryBuilderCanvas.types';
import {
  getSurfaceForDepth,
  QUERY_BUILDER_GROUP_TYPES,
} from './QueryBuilderCanvas.utils';
import QueryBuilderGroupHeader from './QueryBuilderGroupHeader';
import QueryBuilderRuleRow from './QueryBuilderRuleRow';

const QueryBuilderGroupCard: FC<QueryBuilderGroupCardProps> = ({
  group,
  path,
  context,
  canRemove,
  depth,
}) => {
  const { t } = useTranslation();
  const { actions, surface, preset, readonly } = context;
  const conjunction = group.properties?.conjunction ?? 'AND';
  const children = group.children1 ?? [];
  // A `rule_group` owns the field its children filter subfields of. Its rows
  // edit that field in their own Field column, so the card never shows two.
  const ownField = group.properties?.field;
  const groupField = ownField ? { field: ownField, path } : undefined;

  const surfaceClass =
    QUERY_BUILDER_SURFACE_CLASS[getSurfaceForDepth(surface, depth)];

  return (
    <div
      className={classNames(
        // `overflow-hidden` so the header strip takes the card's top corners
        'tw:flex tw:flex-col tw:overflow-hidden tw:rounded-[10px]',
        surfaceClass.card
      )}
      data-testid="query-builder-group-card">
      <div className={classNames('tw:px-5 tw:py-3', surfaceClass.header)}>
        <QueryBuilderGroupHeader
          canRemove={canRemove}
          conjunction={conjunction}
          context={context}
          path={path}
        />
      </div>

      <div className="tw:flex tw:flex-col tw:gap-6 tw:px-5 tw:pt-4 tw:pb-5">
        {children.map((child, index) => {
          const childPath = [...path, String(child.id ?? index)];

          return QUERY_BUILDER_GROUP_TYPES.includes(child.type ?? '') ? (
            <QueryBuilderGroupCard
              canRemove
              context={context}
              depth={depth + 1}
              group={child}
              key={child.id ?? index}
              path={childPath}
            />
          ) : (
            <QueryBuilderRuleRow
              context={context}
              groupField={groupField}
              key={child.id ?? index}
              path={childPath}
              rule={child}
            />
          );
        })}

        {!readonly && (
          <Button
            className="tw:self-start"
            color="link-color"
            data-testid={preset.testIds.addRule}
            iconLeading={Plus}
            size="sm"
            onClick={() => actions.addRule(path)}>
            {preset.addRuleLabel?.() ??
              t('label.add-new-entity', { entity: t('label.field') })}
          </Button>
        )}
      </div>
    </div>
  );
};

export default QueryBuilderGroupCard;
