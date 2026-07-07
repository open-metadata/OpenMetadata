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

import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Point, useOntologyGraphEdit } from './hooks/useOntologyGraphEdit';
import { PortOverlayProps } from './PortOverlay.interface';
import RelationshipTypePicker from './RelationshipTypePicker.component';

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
 * Draw-to-connect overlay for Ontology Studio Edit mode. Renders a DOM/SVG layer
 * over the read-only G6 canvas: a "+" port per node, a provisional line while
 * dragging, and an on-drop relation-type picker. It only READS node positions
 * (client coords the graph already emits to `container.dataset.nodePositions` on
 * every layout/pan/zoom) and converts them to container-local coords — no G6 edge
 * manipulation, so it stays decoupled from the graph internals.
 */
const PortOverlay: React.FC<PortOverlayProps> = ({
  containerRef,
  isEditMode,
  onCreateRelation,
}) => {
  const { t } = useTranslation();
  const [centers, setCenters] = useState<Record<string, Point>>({});

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
  }, [containerRef]);

  const {
    armedFromId,
    cursor,
    candidateTargetId,
    pendingRelation,
    startArm,
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

  return (
    <div
      className="tw:pointer-events-none tw:absolute tw:inset-0 tw:z-1"
      data-testid="ontology-port-overlay">
      {armedCenter && cursor ? (
        <svg
          className="tw:absolute tw:inset-0 tw:h-full tw:w-full"
          style={{ overflow: 'visible' }}>
          <line
            stroke="var(--color-bg-brand-solid)"
            strokeDasharray="5 4"
            strokeWidth={2}
            x1={armedCenter.x}
            x2={cursor.x}
            y1={armedCenter.y}
            y2={cursor.y}
          />
        </svg>
      ) : null}

      {Object.entries(centers).map(([id, c]) => (
        <button
          aria-label={t('label.add-entity', {
            entity: t('label.relationship'),
          })}
          className={classNames(
            'tw:pointer-events-auto tw:absolute tw:flex tw:h-4 tw:w-4 tw:items-center tw:justify-center',
            'tw:rounded-full tw:border tw:border-white tw:text-xs tw:leading-none tw:text-white tw:shadow-md tw:transition-transform',
            candidateTargetId === id
              ? 'tw:scale-150 tw:ring-2 tw:ring-brand'
              : 'tw:hover:scale-125'
          )}
          data-testid={`ontology-port-${id}`}
          key={id}
          style={{
            left: c.x - 8,
            top: c.y - 26,
            backgroundColor: 'var(--color-bg-brand-solid)',
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startArm(id, centers[id]);
          }}>
          +
        </button>
      ))}

      {pendingRelation ? (
        <div
          className="tw:pointer-events-auto tw:absolute tw:z-10"
          style={{ left: pendingRelation.at.x, top: pendingRelation.at.y }}>
          <RelationshipTypePicker
            onCancel={dismissPending}
            onSelect={(relationType) => confirmRelationType(relationType)}
          />
        </div>
      ) : null}
    </div>
  );
};

export default PortOverlay;
