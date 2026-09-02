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
import { Skeleton } from '@openmetadata/ui-core-components';
import type { Actions, Config } from '@react-awesome-query-builder/ui';
import { WidgetProps } from '@rjsf/utils';
import { FC, useEffect } from 'react';
import { EntityType } from '../../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../../enums/search.enum';
import searchClassBase from '../../../../../../utils/SearchClassBase';
import { withAdvanceSearch } from '../../../../../AppRouter/withAdvanceSearch';
import { useAdvanceSearch } from '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { SearchOutputType } from '../../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import QueryBuilder from '../../../../QueryBuilder/QueryBuilder';

/**
 * RJSF adapter over the canonical `QueryBuilder`.
 *
 * This is registered by `FormBuilder` for every JSON-schema form, so it is the
 * widest-reaching caller in the tree. It now does two things and nothing else:
 * map `WidgetProps` onto the component's props, and source `fields` from
 * `AdvanceSearchProvider`.
 *
 * The provider stays because it owns something the component deliberately does
 * not: it fetches custom properties and grafts them onto
 * `config.fields.extension.subfields`, and it applies `fieldOverrides`. Those
 * are feature field definitions, not builder mechanics.
 */
const QueryBuilderWidget: FC<
  WidgetProps & {
    fields?: Config['fields'];
    defaultField?: string;
    subField?: string;
    getQueryActions?: (actions: Actions) => void;
  }
> = ({
  onChange,
  schema,
  value,
  fields,
  defaultField,
  subField,
  getQueryActions,
  label,
  readonly,
  formContext,
}) => {
  const {
    config,
    onChangeSearchIndex,
    searchIndex: searchIndexFromContext,
    isUpdating,
  } = useAdvanceSearch();

  const entityType =
    (formContext?.entityType ?? schema?.entityType) || EntityType.ALL;
  const outputType = schema?.outputType ?? SearchOutputType.ElasticSearch;
  const showExploreLink = schema?.showExploreLink ?? true;

  const searchIndex =
    searchClassBase.getEntityTypeSearchIndexMapping()[entityType as string];
  const resolvedSearchIndex =
    searchIndex === SearchIndex.ALL ? SearchIndex.DATA_ASSET : searchIndex;

  useEffect(() => {
    onChangeSearchIndex(resolvedSearchIndex);
  }, [resolvedSearchIndex, onChangeSearchIndex]);

  // Mounting before the provider has loaded this index's fields would seed a
  // tree against the wrong field set, so the builder waits.
  const isReady = searchIndexFromContext === resolvedSearchIndex && !isUpdating;

  if (!isReady) {
    // A skeleton rather than `null`: if the provider never settles on this
    // index the section stays in a visibly loading state instead of rendering
    // an empty box that reads as a broken builder.
    return (
      <Skeleton
        animation="pulse"
        data-testid="query-builder-loading"
        height={64}
        variant="rectangular"
      />
    );
  }

  return (
    <QueryBuilder
      defaultField={defaultField}
      entityType={entityType}
      fields={fields ?? config?.fields}
      groupMode="flat"
      label={label}
      outputType={outputType}
      readonly={readonly}
      showExploreLink={showExploreLink}
      subField={subField}
      value={value}
      onActionsReady={getQueryActions}
      onChange={(nextValue) => onChange(nextValue)}
    />
  );
};

export default withAdvanceSearch(QueryBuilderWidget, {
  isExplorePage: false,
});
