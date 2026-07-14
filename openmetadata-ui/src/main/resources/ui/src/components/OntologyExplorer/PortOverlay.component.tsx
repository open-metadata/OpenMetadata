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

import { Check, Plus } from '@untitledui/icons';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Point, useOntologyGraphEdit } from './hooks/useOntologyGraphEdit';
import { PortOverlayProps } from './PortOverlay.interface';
import RelationshipTypePicker from './RelationshipTypePicker.component';
import { MODEL_NODE_MAX_WIDTH, NODE_HEIGHT } from './utils/graphConfig';

const PORT_SIZE = 18;

interface OverlayViewport {
  height: number;
  width: number;
}

const readClientPositions = (
  container: HTMLDivElement | null
): Record<string, Point> => {
  if (!container?.dataset.nodePositions) {
    return {};
  }
  try {
    return JSON.parse(container.dataset.nodePositions) as Record<string, Point>;
  } catch {
    return {};
  }
};

/**
 * Click-to-connect overlay for Ontology Studio Edit mode. Renders a DOM/SVG layer
 * over the read-only G6 canvas: a "+" port per node, selectable target surfaces,
 * a provisional line, and a relation-type picker. It only reads node positions
 * (client coords the graph already emits to `container.dataset.nodePositions` on
 * every layout/pan/zoom) and converts them to container-local coords — no G6 edge
 * manipulation, so it stays decoupled from the graph internals.
 */
const PortOverlay: React.FC<PortOverlayProps> = ({
  containerRef,
  isEditMode,
  isolatedNodeIds,
  nodeLabels,
  onCreateRelation,
}) => {
  const { t } = useTranslation();
  const [centers, setCenters] = useState<Record<string, Point>>({});
  const [zoom, setZoom] = useState(1);
  const [viewport, setViewport] = useState<OverlayViewport>({
    height: 0,
    width: 0,
  });

  const toLocalPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const rect = containerRef.current?.getBoundingClientRect();

      return rect ? { x: clientX - rect.left, y: clientY - rect.top } : null;
    },
    [containerRef]
  );

  const sync = useCallback(() => {
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    if (!container || !rect) {
      return;
    }
    const raw = readClientPositions(container);
    const next: Record<string, Point> = {};
    Object.entries(raw).forEach(([id, p]) => {
      next[id] = { x: p.x - rect.left, y: p.y - rect.top };
    });
    setCenters(next);
    const graphZoom = Number(container.dataset.graphZoom);
    setZoom(Number.isFinite(graphZoom) && graphZoom > 0 ? graphZoom : 1);
    setViewport({ height: rect.height, width: rect.width });
  }, [containerRef]);

  const {
    armedFromId,
    cursor,
    candidateTargetId,
    pendingRelation,
    startArm,
    selectTarget,
    setCandidateTarget,
    confirmRelationType,
    dismissPending,
  } = useOntologyGraphEdit({
    isEditMode,
    nodePositions: centers,
    toLocalPoint,
    onCreateRelation,
  });

  useEffect(() => {
    if (!isEditMode) {
      setCenters({});

      return undefined;
    }
    sync();
    const container = containerRef.current;
    const observer = new MutationObserver(sync);
    if (container) {
      observer.observe(container, {
        attributes: true,
        attributeFilter: ['data-node-positions'],
      });
    }
    // Zoom/pan re-emit positions to the dataset, but as a safety net also poll so
    // the ports never drift from their nodes during a long-running transform.
    const interval = window.setInterval(sync, 400);
    window.addEventListener('resize', sync);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener('resize', sync);
    };
  }, [isEditMode, sync, containerRef]);

  if (!isEditMode) {
    return null;
  }

  const armedCenter = armedFromId ? centers[armedFromId] : null;
  const candidateCenter = candidateTargetId ? centers[candidateTargetId] : null;
  const lineEnd = candidateCenter ?? cursor;
  const nodeWidth = MODEL_NODE_MAX_WIDTH * zoom;
  const nodeHeight = NODE_HEIGHT * zoom;
  const pickerX = pendingRelation
    ? Math.min(
        Math.max(pendingRelation.at.x, 142),
        Math.max(142, viewport.width - 142)
      )
    : 0;
  const pickerY = pendingRelation
    ? Math.min(
        Math.max(pendingRelation.at.y, 8),
        Math.max(8, viewport.height - 330)
      )
    : 0;

  return (
    <div
      className="tw:pointer-events-none tw:absolute tw:inset-0 tw:z-5"
      data-testid="ontology-port-overlay">
      {armedFromId ? (
        <div
          className={classNames(
            'tw:absolute tw:left-1/2 tw:top-3.5 tw:z-10 tw:flex tw:-translate-x-1/2 tw:items-center tw:gap-2',
            'tw:rounded-full tw:border tw:border-brand-200 tw:bg-brand-50 tw:px-4 tw:py-2',
            'tw:font-body tw:text-xs tw:leading-[normal] tw:font-semibold tw:text-brand-700 tw:shadow-sm'
          )}
          data-testid="ontology-connect-instruction">
          <span className="tw:grid tw:size-3.5 tw:place-items-center tw:rounded-[3px] tw:border tw:border-brand-600">
            <Check aria-hidden="true" className="tw:size-2.5" />
          </span>
          <span>
            {t('message.click-another-term-to-draw-connection', {
              term: nodeLabels[armedFromId] ?? armedFromId,
            })}
          </span>
        </div>
      ) : null}

      {armedCenter && lineEnd ? (
        <svg
          className="tw:absolute tw:inset-0 tw:h-full tw:w-full"
          style={{ overflow: 'visible' }}>
          <line
            stroke="#1570EF"
            strokeDasharray="5 4"
            strokeWidth={2}
            x1={armedCenter.x}
            x2={lineEnd.x}
            y1={armedCenter.y}
            y2={lineEnd.y}
          />
        </svg>
      ) : null}

      {armedFromId
        ? Object.entries(centers).map(([id, center]) => {
            const isSource = id === armedFromId;
            const isCandidate = id === candidateTargetId;
            const isIsolated = isolatedNodeIds.has(id);
            const isStrong = isSource || isCandidate;

            return (
              <button
                aria-label={t('label.select-entity', {
                  entity: t('label.term'),
                })}
                className={classNames(
                  'tw:absolute tw:rounded-[9px] tw:bg-transparent',
                  isSource
                    ? 'tw:pointer-events-none'
                    : 'tw:pointer-events-auto tw:cursor-pointer'
                )}
                data-testid={`ontology-target-${id}`}
                key={id}
                style={{
                  borderColor: isStrong
                    ? '#1570EF'
                    : isIsolated
                    ? '#FEDF89'
                    : '#B2DDFF',
                  borderStyle: 'solid',
                  borderWidth: isStrong ? 2 : 1.5,
                  boxShadow: isStrong
                    ? '0 0 0 4px rgba(21, 112, 239, 0.14)'
                    : 'none',
                  height: nodeHeight,
                  left: center.x - nodeWidth / 2,
                  top: center.y - nodeHeight / 2,
                  width: nodeWidth,
                }}
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectTarget(id);
                }}
                onMouseEnter={() => setCandidateTarget(id)}
                onMouseLeave={() => setCandidateTarget(null)}
              />
            );
          })
        : pendingRelation
        ? null
        : Object.entries(centers).map(([id, center]) => (
            <button
              aria-label={t('label.add-entity', {
                entity: t('label.relationship'),
              })}
              className={classNames(
                'tw:pointer-events-auto tw:absolute tw:flex tw:items-center tw:justify-center',
                'tw:rounded-full tw:border-0 tw:bg-brand-solid tw:text-white',
                'tw:shadow-[0_2px_5px_rgba(21,112,239,0.4)] tw:transition-transform tw:hover:scale-110'
              )}
              data-testid={`ontology-port-${id}`}
              key={id}
              style={{
                height: PORT_SIZE,
                left: center.x + nodeWidth / 2 - PORT_SIZE / 2,
                top: center.y - PORT_SIZE / 2,
                width: PORT_SIZE,
              }}
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                startArm(id, center);
              }}>
              <Plus aria-hidden="true" className="tw:size-[11px]" />
            </button>
          ))}

      {pendingRelation ? (
        <div
          className="tw:pointer-events-auto tw:absolute tw:z-10"
          style={{
            left: pickerX,
            top: pickerY,
            transform: 'translate(-50%, 16px)',
          }}>
          <RelationshipTypePicker
            sourceLabel={
              nodeLabels[pendingRelation.fromId] ?? pendingRelation.fromId
            }
            targetLabel={
              nodeLabels[pendingRelation.toId] ?? pendingRelation.toId
            }
            onCancel={dismissPending}
            onSelect={(relationType) => confirmRelationType(relationType)}
          />
        </div>
      ) : null}
    </div>
  );
};

export default PortOverlay;
