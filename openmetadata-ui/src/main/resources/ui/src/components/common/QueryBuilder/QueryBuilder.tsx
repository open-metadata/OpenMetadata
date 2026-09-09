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
import { Divider, Typography } from '@openmetadata/ui-core-components';
import type {
  Actions,
  BuilderProps,
  Config,
  ImmutableTree,
  JsonTree,
} from '@react-awesome-query-builder/ui';
import { Query, Utils as QbUtils } from '@react-awesome-query-builder/ui';
// Both stylesheets target RAQB's own markup, which the canvas no longer
// renders, so neither reaches this component's DOM. They are left in place for
// the cleanup PR rather than removed here.
import '@react-awesome-query-builder/ui/css/styles.css';
import { debounce, isEqual } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import type { QueryFilterInterface } from '../../../interface/queryFilter.interface';
import { buildQueryBuilderConfig } from '../../../utils/queryBuilder/config';
import {
  fetchQueryBuilderCount,
  getScopedQueryFilter,
} from '../../../utils/queryBuilder/count';
import {
  formatQuery,
  isQueryTreeComplete,
} from '../../../utils/queryBuilder/formatters';
import { loadQueryBuilderTree } from '../../../utils/queryBuilder/tree';
import {
  QUERY_BUILDER_CONJUNCTION_MODE,
  QUERY_BUILDER_GROUP_MODE,
  QUERY_BUILDER_SURFACE,
} from '../../../utils/queryBuilder/types';
import { getQueryBuilderExploreUrl } from '../../../utils/queryBuilder/url';
import searchClassBase from '../../../utils/SearchClassBase';
import { SearchOutputType } from '../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import QueryBuilderCanvas from './QueryBuilderCanvas/QueryBuilderCanvas';
import {
  COMPACT_BUTTON_PRESET,
  CONDITION_BUTTON_PRESET,
  EXPLORE_BUTTON_PRESET,
} from './QueryBuilderButton/QueryBuilderButton.constants';
import type { QueryBuilderButtonPreset } from './QueryBuilderButton/QueryBuilderButton.types';
import '../QueryBuilderWidgetV1/query-builder-widget-v1.less';
import QueryBuilderCountBanner from './QueryBuilderCountBanner/QueryBuilderCountBanner';
import type { QueryBuilderProps } from './QueryBuilder.types';

const COUNT_DEBOUNCE_MS = 300;

/**
 * Nested groups only exist on Explore, which is also the only screen whose
 * addGroup/delGroup testids Playwright depends on. JSONLogic builders sit in
 * denser forms and label their add button differently.
 */
function pickButtonPreset(
  isNested: boolean,
  isJsonLogic: boolean
): QueryBuilderButtonPreset {
  if (isNested) {
    return EXPLORE_BUTTON_PRESET;
  }

  return isJsonLogic ? COMPACT_BUTTON_PRESET : CONDITION_BUTTON_PRESET;
}

/**
 * The only component in the codebase that renders a RAQB `<Query>`.
 *
 * Everything specific to a caller — field definitions, storage format,
 * JSONLogic post-processing, Explore URL writing — stays outside. What lives
 * here is the builder itself plus the chrome that every caller had duplicated:
 * tree rehydration, count preview, and the emitted value.
 */
const QueryBuilder: FC<QueryBuilderProps> = ({
  value,
  tree,
  fields,
  outputType = SearchOutputType.ElasticSearch,
  groupMode = QUERY_BUILDER_GROUP_MODE.FLAT,
  conjunctionMode = QUERY_BUILDER_CONJUNCTION_MODE.EDITABLE,
  showConjunction = true,
  entityType = EntityType.ALL,
  defaultField,
  subField,
  readonly = false,
  label,
  showCountPreview = true,
  showExploreLink = true,
  configOverrides,
  buttonPreset,
  surface = QUERY_BUILDER_SURFACE.SUBTLE,
  onChange,
  onActionsReady,
  onValidityChange,
}) => {
  const [matchedCount, setMatchedCount] = useState<number>();
  const [isCountLoading, setIsCountLoading] = useState(false);
  const [exploreUrl, setExploreUrl] = useState('');
  const isJsonLogic = outputType === SearchOutputType.JSONLogic;

  const searchIndex =
    searchClassBase.getEntityTypeSearchIndexMapping()[entityType as string];

  const config = useMemo(
    () =>
      buildQueryBuilderConfig({
        outputType,
        searchIndex,
        entityType,
        groupMode,
        conjunctionMode,
        readonly,
        fields,
        configOverrides,
        // The three jobs `isExplorePage` used to conflate, now derived from
        // the mode the caller actually asked for.
        showLabels: groupMode === QUERY_BUILDER_GROUP_MODE.NESTED,
        useFriendlyOperatorLabels:
          groupMode !== QUERY_BUILDER_GROUP_MODE.NESTED,
      }),
    [
      outputType,
      searchIndex,
      entityType,
      groupMode,
      conjunctionMode,
      readonly,
      fields,
      configOverrides,
    ]
  );

  const preset = useMemo(
    () =>
      buttonPreset ??
      pickButtonPreset(
        groupMode === QUERY_BUILDER_GROUP_MODE.NESTED,
        isJsonLogic
      ),
    [buttonPreset, groupMode, isJsonLogic]
  );

  const configRef = useRef(config);
  configRef.current = config;

  // The tree we last handed to `onChange`. Without it the `tree` effect below
  // would reload the builder from our own emission and drop the user's cursor.
  const lastEmittedTreeRef = useRef<JsonTree>();
  const actionsRef = useRef<Actions>();

  const [treeInternal, setTreeInternal] = useState<ImmutableTree>(() =>
    loadQueryBuilderTree({
      config,
      value,
      tree,
      outputType,
      groupMode,
      defaultField,
      subField,
    })
  );

  useEffect(() => {
    setTreeInternal((current) => QbUtils.checkTree(current, config));
  }, [config]);

  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (isEqual(tree, lastEmittedTreeRef.current)) {
      return;
    }
    lastEmittedTreeRef.current = undefined;
    setTreeInternal(
      loadQueryBuilderTree({
        config: configRef.current,
        value: valueRef.current,
        tree,
        outputType,
        groupMode,
        defaultField,
        subField,
      })
    );
  }, [tree, outputType, groupMode, defaultField, subField]);

  const fetchCount = useCallback(async (scopedFilter: QueryFilterInterface) => {
    setIsCountLoading(true);
    try {
      setMatchedCount(await fetchQueryBuilderCount(scopedFilter));
    } finally {
      setIsCountLoading(false);
    }
  }, []);

  const debouncedFetchCount = useMemo(
    () => debounce(fetchCount, COUNT_DEBOUNCE_MS),
    [fetchCount]
  );

  const handleChange = (nextTree: ImmutableTree, nextConfig: Config) => {
    setTreeInternal(nextTree);
    configRef.current = nextConfig;

    const { value: nextValue, queryFilter } = formatQuery(
      nextTree,
      nextConfig,
      outputType
    );

    let nextExploreUrl: string | undefined;

    if (!isJsonLogic) {
      // Same tree and config the emitted filter is built from, so a caller can
      // block a save that would otherwise drop an unfinished condition and
      // silently widen the filter.
      onValidityChange?.(isQueryTreeComplete(nextTree, nextConfig));

      if (queryFilter) {
        // One scoping pass feeds both: addEntityTypeFilter mutates in place,
        // so scoping twice would double the entity-type clause.
        const scopedFilter = getScopedQueryFilter(queryFilter, entityType);
        nextExploreUrl = getQueryBuilderExploreUrl(scopedFilter, nextConfig);
        setExploreUrl(nextExploreUrl);

        if (showCountPreview) {
          debouncedFetchCount(scopedFilter);
        }
      } else {
        setMatchedCount(undefined);
      }
    }

    const jsonTree = QbUtils.getTree(nextTree);
    lastEmittedTreeRef.current = jsonTree;
    onChange?.(nextValue, jsonTree, {
      queryFilter,
      exploreUrl: nextExploreUrl,
      outputType,
    });
  };

  useEffect(() => {
    if (actionsRef.current) {
      onActionsReady?.(actionsRef.current);
    }
  }, [treeInternal, onActionsReady]);

  const renderBuilder = useCallback(
    (builderProps: BuilderProps) => {
      actionsRef.current = builderProps.actions;

      return (
        <QueryBuilderCanvas
          actions={builderProps.actions}
          allowGroups={groupMode === QUERY_BUILDER_GROUP_MODE.NESTED}
          config={builderProps.config}
          preset={preset}
          readonly={readonly}
          showConjunction={showConjunction}
          surface={surface}
          tree={builderProps.tree}
        />
      );
    },
    [groupMode, preset, readonly, showConjunction, surface]
  );

  return (
    // No chrome here on purpose: the card belongs to each group, and anything
    // around the builder belongs to the screen embedding it.
    <div
      className="tw:flex tw:flex-col tw:gap-3"
      data-testid="query-builder-form-field">
      {isJsonLogic && label && (
        <>
          <Typography
            as="span"
            className="query-filter-label tw:text-tertiary tw:capitalize"
            size="text-sm">
            {label}
          </Typography>
          <Divider className="tw:my-2" />
        </>
      )}

      <Query
        {...config}
        renderBuilder={renderBuilder}
        value={treeInternal}
        onChange={handleChange}
      />

      {/* One banner implementation for every query-builder surface. The
          count is fetched here, but screens that count something this builder
          cannot derive render the same component with their own number. */}
      {showCountPreview && !isJsonLogic && (
        <QueryBuilderCountBanner
          count={matchedCount}
          exploreUrl={showExploreLink ? exploreUrl : undefined}
          isLoading={isCountLoading}
        />
      )}
    </div>
  );
};

export default QueryBuilder;
