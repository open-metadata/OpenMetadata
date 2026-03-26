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

import {
  Badge,
  Card,
  Divider,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTermRelationType } from '../../rest/settingConfigAPI';
import { OntologyEdge, OntologyNode } from './OntologyExplorer.interface';

export interface OntologyNodeRelationsContentProps {
  readonly node: OntologyNode;
  readonly edges: OntologyEdge[];
  readonly nodes: OntologyNode[];
  readonly relationTypes: GlossaryTermRelationType[];
}

type RelationRow = OntologyEdge & {
  relatedNode?: OntologyNode;
};

export const OntologyNodeRelationsContent: React.FC<
  OntologyNodeRelationsContentProps
> = ({ node, edges, nodes, relationTypes }) => {
  const { t } = useTranslation();

  const nodeRelations = useMemo(() => {
    const incoming = edges
      .filter((e) => e.to === node.id)
      .map((e) => ({
        ...e,
        relatedNode: nodes.find((n) => n.id === e.from),
      }));
    const outgoing = edges
      .filter((e) => e.from === node.id)
      .map((e) => ({
        ...e,
        relatedNode: nodes.find((n) => n.id === e.to),
      }));

    return { incoming, outgoing };
  }, [node, edges, nodes]);

  const relationTypeMap = useMemo(() => {
    const map = new Map<string, GlossaryTermRelationType>();
    relationTypes.forEach((relationType) => {
      map.set(relationType.name, relationType);
    });

    return map;
  }, [relationTypes]);

  const relationLabelOverrides = useMemo<Record<string, string>>(
    () => ({
      metricFor: `${t('label.metric')} ${t('label.for-lowercase')}`,
      hasGlossaryTerm: t('label.tagged-with'),
    }),
    [t]
  );

  const getDisplayName = useCallback(
    (relationType: string) => {
      const relationMeta = relationTypeMap.get(relationType);

      return (
        relationMeta?.displayName ??
        relationLabelOverrides[relationType] ??
        relationType
      );
    },
    [relationTypeMap, relationLabelOverrides]
  );

  const totalRelations =
    nodeRelations.incoming.length + nodeRelations.outgoing.length;

  const relatedDisplayName = useCallback(
    (rel: RelationRow, end: 'from' | 'to') => {
      return (
        rel.relatedNode?.originalLabel ?? rel.relatedNode?.label ?? rel[end]
      );
    },
    []
  );

  const renderSection = (
    sectionTitle: string,
    count: number,
    rows: RelationRow[],
    labelTestId: string,
    countTestId: string,
    otherEnd: 'from' | 'to'
  ) => {
    if (rows.length === 0) {
      return null;
    }

    return (
      <div className="tw:mb-5 tw:mt-1 tw:last:mb-0">
        <div className="tw:mb-2 tw:flex tw:items-center tw:gap-2">
          <Typography
            as="span"
            className="tw:text-primary"
            data-testid={labelTestId}
            size="text-sm"
            weight="semibold">
            {sectionTitle}
          </Typography>
          <Badge color="gray" data-testid={countTestId} type="color">
            {String(count).padStart(2, '0')}
          </Badge>
        </div>
        <Card className="tw:overflow-hidden tw:rounded-[10px] tw:border tw:border-utility-gray-blue-100 tw:p-4">
          <ul className="tw:m-0 tw:list-none tw:p-0">
            {rows.map((rel, rowIndex) => {
              const labelText = relatedDisplayName(rel, otherEnd);
              const hasRowBelow = rowIndex < rows.length - 1;

              return (
                <li
                  className="tw:flex tw:flex-col tw:gap-2 tw:py-1"
                  key={`${rel.from}-${rel.to}-${rel.relationType}`}>
                  <div className="tw:grid tw:w-full tw:items-center tw:gap-3 tw:grid-cols-2">
                    <Badge color="gray" type="modern">
                      {getDisplayName(rel.relationType)}
                    </Badge>
                    <Tooltip placement="top" title={labelText}>
                      <TooltipTrigger className="tw:min-w-0">
                        <Typography
                          as="span"
                          className="tw:block tw:truncate tw:text-primary"
                          size="text-sm"
                          weight="regular">
                          {labelText}
                        </Typography>
                      </TooltipTrigger>
                    </Tooltip>
                  </div>
                  {hasRowBelow ? <Divider orientation="horizontal" /> : null}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    );
  };

  if (totalRelations === 0) {
    return (
      <Typography
        as="div"
        className="tw:py-8 tw:text-center"
        size="text-sm"
        weight="regular">
        {t('message.no-relations-found')}
      </Typography>
    );
  }

  return (
    <>
      {renderSection(
        t('label.outgoing-relation-plural'),
        nodeRelations.outgoing.length,
        nodeRelations.outgoing,
        'outgoing-relation-label',
        'outgoing-relation-count',
        'to'
      )}
      {renderSection(
        t('label.incoming-relation-plural'),
        nodeRelations.incoming.length,
        nodeRelations.incoming,
        'incoming-relation-label',
        'incoming-relation-count',
        'from'
      )}
    </>
  );
};
