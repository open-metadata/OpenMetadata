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
import { Box } from '@openmetadata/ui-core-components';
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { FC, Fragment, useMemo } from 'react';
import QueryBuilderAddGroup from './QueryBuilderAddGroup';
import type {
  QueryBuilderCanvasProps,
  QueryBuilderNode,
} from './QueryBuilderCanvas.types';
import {
  buildRuleIndex,
  countRules,
  QUERY_BUILDER_GROUP_TYPE,
} from './QueryBuilderCanvas.utils';
import QueryBuilderGroupCard from './QueryBuilderGroupCard';
import QueryBuilderGroupConnector from './QueryBuilderGroupConnector';

// The builder's surface, in place of RAQB's `<Builder>`.
const QueryBuilderCanvas: FC<QueryBuilderCanvasProps> = ({
  tree,
  actions,
  config,
  surface,
  allowGroups,
  preset,
  readonly,
  showConjunction,
}) => {
  const root = useMemo(
    () =>
      tree
        ? (QbUtils.getTree(tree as never) as QueryBuilderNode | undefined)
        : undefined,
    [tree]
  );

  const context = useMemo(
    () => ({
      actions,
      config,
      surface,
      allowGroups,
      preset,
      readonly,
      showConjunction,
      canRemoveRule: countRules(root) > 1,
      ruleIndexById: buildRuleIndex(root),
    }),
    [
      actions,
      config,
      surface,
      allowGroups,
      preset,
      readonly,
      showConjunction,
      root,
    ]
  );

  if (!root) {
    return null;
  }

  // RAQB seeds a wrapper group around the first real one, and every group the user adds lands beside it.
  const rootPath = [String(root.id)];
  const rootChildren = root.children1 ?? [];
  const asSiblings =
    rootChildren.length > 0 &&
    rootChildren.every((child) => child.type === QUERY_BUILDER_GROUP_TYPE);
  const conjunctions = Object.keys(config.conjunctions ?? {});

  const addGroup = (conjunction?: string) => {
    if (conjunction) {
      actions.setConjunction(rootPath, conjunction);
    }
    actions.addGroup(rootPath);
  };

  return (
    <Box data-testid="query-builder" direction="col">
      {asSiblings ? (
        rootChildren.map((child, index) => (
          <Fragment key={child.id ?? index}>
            {index > 0 && (
              <QueryBuilderGroupConnector
                conjunction={root.properties?.conjunction ?? 'AND'}
                conjunctions={conjunctions}
                readonly={readonly}
                onChange={(next) => actions.setConjunction(rootPath, next)}
              />
            )}

            <QueryBuilderGroupCard
              canRemove={rootChildren.length > 1}
              context={context}
              depth={0}
              group={child}
              path={[...rootPath, String(child.id ?? index)]}
            />
          </Fragment>
        ))
      ) : (
        <QueryBuilderGroupCard
          canRemove={false}
          context={context}
          depth={0}
          group={root}
          path={rootPath}
        />
      )}

      {allowGroups && !readonly && (
        <QueryBuilderAddGroup
          conjunctions={conjunctions}
          testId={preset.testIds.addGroup}
          onAdd={addGroup}
        />
      )}
    </Box>
  );
};

export default QueryBuilderCanvas;
