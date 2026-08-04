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

import { Check } from '@untitledui/icons';
import classNames from 'classnames';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Point, useOntologyGraphEdit } from './hooks/useOntologyGraphEdit';
import {
  OntologyEditNodeClickDetail,
  ONTOLOGY_EDIT_CANCEL_EVENT,
  ONTOLOGY_EDIT_NODE_CLICK_EVENT,
  PortOverlayProps,
} from './PortOverlay.interface';
import RelationshipTypePicker from './RelationshipTypePicker.component';

/**
 * Relationship-editing presentation layer. Node ports and target hit areas are
 * owned by G6 so they share the node transform; this layer only renders the
 * connection instruction, provisional line, and relationship picker.
 */
const PortOverlay: React.FC<PortOverlayProps> = ({
  containerRef,
  isEditMode,
  nodeLabels,
  onCreateRelation,
}) => {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);

  const toLocalPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const rect = overlayRef.current?.getBoundingClientRect();

      return rect ? { x: clientX - rect.left, y: clientY - rect.top } : null;
    },
    []
  );

  const {
    armedAt,
    armedFromId,
    cancel,
    confirmRelationType,
    cursor,
    dismissPending,
    pendingRelation,
    selectTarget,
    startArm,
  } = useOntologyGraphEdit({
    isEditMode,
    nodePositions: {},
    toLocalPoint,
    onCreateRelation,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!isEditMode || !container) {
      return undefined;
    }

    const handleNodeClick = (event: Event) => {
      const editEvent = event as CustomEvent<OntologyEditNodeClickDetail>;
      const { clientX, clientY, isPort, nodeId } = editEvent.detail;
      const point = toLocalPoint(clientX, clientY);
      if (!point) {
        return;
      }
      if (armedFromId !== null && nodeId !== armedFromId) {
        editEvent.preventDefault();
        selectTarget(nodeId, point);

        return;
      }
      if (isPort) {
        editEvent.preventDefault();
        startArm(nodeId, point);
      }
    };
    const handleCancel = () => {
      cancel();
      dismissPending();
    };

    container.addEventListener(ONTOLOGY_EDIT_NODE_CLICK_EVENT, handleNodeClick);
    container.addEventListener(ONTOLOGY_EDIT_CANCEL_EVENT, handleCancel);

    return () => {
      container.removeEventListener(
        ONTOLOGY_EDIT_NODE_CLICK_EVENT,
        handleNodeClick
      );
      container.removeEventListener(ONTOLOGY_EDIT_CANCEL_EVENT, handleCancel);
    };
  }, [
    armedFromId,
    cancel,
    containerRef,
    dismissPending,
    isEditMode,
    selectTarget,
    startArm,
    toLocalPoint,
  ]);

  if (!isEditMode) {
    return null;
  }

  const lineStart = pendingRelation?.from ?? armedAt;
  const lineEnd = pendingRelation?.to ?? cursor;

  return (
    <div
      className="tw:pointer-events-none tw:absolute tw:inset-0 tw:z-5"
      data-testid="ontology-port-overlay"
      ref={overlayRef}>
      {armedFromId ? (
        <div
          className={classNames(
            'tw:absolute tw:left-1/2 tw:top-3.5 tw:z-10 tw:flex tw:-translate-x-1/2 tw:items-center tw:gap-2',
            'tw:rounded-full tw:border tw:border-brand tw:bg-brand-primary tw:px-4 tw:py-2',
            'tw:font-body tw:text-xs tw:leading-normal tw:font-semibold tw:text-brand-secondary tw:shadow-sm'
          )}
          data-testid="ontology-connect-instruction">
          <span className="tw:grid tw:size-3.5 tw:place-items-center tw:rounded tw:border tw:border-brand">
            <Check aria-hidden="true" className="tw:size-2.5" />
          </span>
          <span>
            {t('message.click-another-term-to-draw-connection', {
              term: nodeLabels[armedFromId] ?? armedFromId,
            })}
          </span>
        </div>
      ) : null}

      {lineStart && lineEnd ? (
        <svg
          className="tw:absolute tw:inset-0 tw:h-full tw:w-full"
          style={{ overflow: 'visible' }}>
          <line
            data-testid="ontology-connection-line"
            stroke="var(--color-bg-brand-solid)"
            strokeDasharray="6 5"
            strokeWidth={2.4}
            x1={lineStart.x}
            x2={lineEnd.x}
            y1={lineStart.y}
            y2={lineEnd.y}
          />
        </svg>
      ) : null}

      {pendingRelation ? (
        <div
          className="tw:pointer-events-auto tw:absolute tw:z-10"
          data-testid="ontology-relation-picker-anchor"
          style={{
            left: pendingRelation.at.x,
            top: pendingRelation.at.y,
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
