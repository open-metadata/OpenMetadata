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

import { SlideoutMenu } from '@openmetadata/ui-core-components';
import { FC, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import withSuspenseFallback from '../AppRouter/withSuspenseFallback';
import { SearchSourceDetails } from '../Explore/EntitySummaryPanel/EntitySummaryPanel.interface';
import { ENTITY_UUID_REGEX, PANEL_WIDTH } from './KnowledgeGraph.constants';
import { KnowledgeGraphOverlaysProps } from './KnowledgeGraph.interface';

const EntitySummaryPanel = withSuspenseFallback(
  lazy(
    () => import('../Explore/EntitySummaryPanel/EntitySummaryPanel.component')
  )
);

/**
 * Everything drawn on top of the graph canvas: the hidden edge manifest the E2E
 * suite asserts against, the edge hover tooltip, and the entity detail slideout.
 * Split out of KnowledgeGraph so the component owning the canvas lifecycle is
 * not also assembling three unrelated overlays.
 */
const KnowledgeGraphOverlays: FC<KnowledgeGraphOverlaysProps> = ({
  edges,
  edgeTooltip,
  nodeLabelById,
  selectedNode,
  onClosePanel,
  onSlideoutOpenChange,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Not shown: the rendered graph lives on a canvas, so this gives the E2E
          suite a DOM handle on the edges it needs to assert. */}
      <div
        aria-hidden="true"
        className="tw:hidden"
        data-testid="knowledge-graph-edges">
        {edges.map((edge) => (
          <div
            data-edge-label={edge.label}
            data-edge-source={edge.from}
            data-edge-target={edge.to}
            data-testid={`edge-${nodeLabelById.get(edge.from) ?? edge.from}-${
              edge.label
            }-${nodeLabelById.get(edge.to) ?? edge.to}`}
            key={`${edge.from}-${edge.label}-${edge.to}`}
          />
        ))}
      </div>

      {edgeTooltip && (
        <div
          aria-hidden="true"
          className="kg-edge-tooltip"
          data-testid="edge-tooltip"
          style={{
            left: edgeTooltip.x + 12,
            position: 'fixed',
            top: edgeTooltip.y + 12,
          }}>
          <div className="kg-edge-tooltip__direction">
            {`${edgeTooltip.sourceLabel} ${t('label.arrow-symbol')} ${
              edgeTooltip.targetLabel
            }`}
          </div>
          {edgeTooltip.labels.map((label) => (
            <div
              className="kg-edge-tooltip__label"
              key={`${edgeTooltip.edgeId}-${label}`}>
              {label}
            </div>
          ))}
        </div>
      )}

      {selectedNode?.fullyQualifiedName && (
        <SlideoutMenu
          isDismissable
          isOpen
          className="tw:z-1100"
          dialogClassName="tw:gap-0 tw:items-stretch tw:min-h-0 tw:overflow-hidden tw:p-0"
          width={PANEL_WIDTH}
          onOpenChange={onSlideoutOpenChange}>
          {({ close }) => (
            <EntitySummaryPanel
              isSideDrawer
              entityDetails={{
                details: {
                  id:
                    ENTITY_UUID_REGEX.exec(selectedNode.id)?.[1] ??
                    selectedNode.id,
                  fullyQualifiedName: selectedNode.fullyQualifiedName,
                  entityType: selectedNode.type as EntityType,
                  name: selectedNode.name ?? selectedNode.label,
                  displayName: selectedNode.label,
                } as SearchSourceDetails,
              }}
              handleClosePanel={() => {
                onClosePanel();
                close();
              }}
            />
          )}
        </SlideoutMenu>
      )}
    </>
  );
};

export default KnowledgeGraphOverlays;
