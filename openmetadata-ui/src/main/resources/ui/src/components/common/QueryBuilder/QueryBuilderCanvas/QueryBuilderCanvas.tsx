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
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { FC, Fragment, useMemo } from 'react';
import {
  buildRuleIndex,
  countRules,
  QUERY_BUILDER_GROUP_TYPES,
} from './QueryBuilderCanvas.utils';
import QueryBuilderAddGroup from './QueryBuilderAddGroup';
import QueryBuilderGroupCard from './QueryBuilderGroupCard';
import QueryBuilderGroupConnector from './QueryBuilderGroupConnector';
import type {
  QueryBuilderCanvasProps,
  QueryBuilderNode,
} from './QueryBuilderCanvas.types';

/**
 * The builder's surface, in place of RAQB's `<Builder>`.
 *
 * RAQB keeps every job it is good at — it owns the tree, validates it, and
 * applies each mutation through `actions`. What it no longer does is render:
 * its markup carries a stylesheet that cannot be restyled from outside (the
 * group card, the row layout and the theme all arrive under one `.query-builder`
 * scope), and it exposes no class hook or `renderGroup` to reach them. So the
 * tree is walked here instead, and drawn with core components only.
 */
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

  // RAQB seeds a wrapper group around the first real one, and every group the
  // user adds lands beside it. Those are peers, so they are drawn as a stack
  // of cards joined by the conjunction that combines them — not as cards
  // inside cards, which is what nesting them would look like.
  const rootPath = [String(root.id)];
  const rootChildren = root.children1 ?? [];
  const asSiblings =
    rootChildren.length > 0 &&
    rootChildren.every((child) =>
      QUERY_BUILDER_GROUP_TYPES.includes(child.type ?? '')
    );
  const conjunctions = Object.keys(config.conjunctions ?? {});

  const addGroup = (conjunction?: string) => {
    if (conjunction) {
      actions.setConjunction(rootPath, conjunction);
    }
    actions.addGroup(rootPath);
  };

  return (
    <div className="tw:flex tw:flex-col" data-testid="query-builder">
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
    </div>
  );
};

export default QueryBuilderCanvas;
