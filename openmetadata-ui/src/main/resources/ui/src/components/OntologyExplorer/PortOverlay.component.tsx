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

import { ButtonUtility } from '@openmetadata/ui-core-components';
import { Link01, XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Point, useOntologyGraphEdit } from './hooks/useOntologyGraphEdit';
import {
  OntologyEditNodeClickDetail,
  OntologyEditPortDownDetail,
  ONTOLOGY_EDIT_CANCEL_EVENT,
  ONTOLOGY_EDIT_NODE_CLICK_EVENT,
  ONTOLOGY_EDIT_PORT_DOWN_EVENT,
  ONTOLOGY_EDIT_PORT_DRAG_END_EVENT,
  PortOverlayProps,
} from './PortOverlay.interface';
import RelationshipTypePicker from './RelationshipTypePicker.component';
import { useRelationWarning } from './RelationWarning.context';
import { NODE_HEIGHT, NODE_WIDTH } from './utils/graphConfig';

const DRAG_THRESHOLD_PX = 6;

interface ClientPoint {
  x: number;
  y: number;
}

/** The node under a client point, read from the positions the graph publishes on its container. */
const nodeAtClientPoint = (
  container: HTMLElement,
  point: ClientPoint
): string | undefined => {
  try {
    const positions: Record<string, ClientPoint> = JSON.parse(
      container.dataset.nodePositions ?? '{}'
    );
    const zoom = Number(container.dataset.graphZoom ?? 1) || 1;

    return Object.entries(positions).find(
      ([, center]) =>
        Math.abs(center.x - point.x) <= (NODE_WIDTH / 2) * zoom &&
        Math.abs(center.y - point.y) <= (NODE_HEIGHT / 2) * zoom
    )?.[0];
  } catch {
    return undefined;
  }
};

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
  relationTypeGroups,
  canCreateRelationType,
  checkRelation,
}) => {
  const { t } = useTranslation();
  const warnRelation = useRelationWarning();
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
    connect,
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

  const gesture = useRef({ cancel, connect, startArm, toLocalPoint });
  gesture.current = { cancel, connect, startArm, toLocalPoint };

  useEffect(() => {
    const container = containerRef.current;
    if (!isEditMode || !container) {
      return undefined;
    }
    let drag: { nodeId: string; start: ClientPoint; isActive: boolean } | null =
      null;
    const handleDragMove = (event: PointerEvent) => {
      if (
        drag &&
        !drag.isActive &&
        Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) >
          DRAG_THRESHOLD_PX
      ) {
        drag.isActive = true;
        const origin = gesture.current.toLocalPoint(drag.start.x, drag.start.y);
        if (origin) {
          gesture.current.startArm(drag.nodeId, origin);
        }
      }
    };
    // stopDrag and handleDragEnd detach each other, so the pointerup handler is
    // held here until it is defined.
    const listeners: { end: (event: PointerEvent) => void } = {
      end: () => undefined,
    };
    const stopDrag = () => {
      drag = null;
      window.removeEventListener('pointermove', handleDragMove);
      window.removeEventListener('pointerup', listeners.end);
    };
    const handleDragEnd = (event: PointerEvent) => {
      const dragged = drag?.isActive ? drag : null;
      stopDrag();
      if (!dragged) {
        return;
      }
      container.dispatchEvent(new Event(ONTOLOGY_EDIT_PORT_DRAG_END_EVENT));
      const targetId = nodeAtClientPoint(container, {
        x: event.clientX,
        y: event.clientY,
      });
      const point = gesture.current.toLocalPoint(event.clientX, event.clientY);
      const origin = gesture.current.toLocalPoint(
        dragged.start.x,
        dragged.start.y
      );
      if (targetId && point && origin) {
        gesture.current.connect(dragged.nodeId, origin, targetId, point);
      } else {
        gesture.current.cancel();
      }
    };
    listeners.end = handleDragEnd;
    const handlePortDown = (event: Event) => {
      const { clientX, clientY, nodeId } = (
        event as CustomEvent<OntologyEditPortDownDetail>
      ).detail;
      stopDrag();
      drag = { isActive: false, nodeId, start: { x: clientX, y: clientY } };
      window.addEventListener('pointermove', handleDragMove);
      window.addEventListener('pointerup', listeners.end);
    };
    container.addEventListener(ONTOLOGY_EDIT_PORT_DOWN_EVENT, handlePortDown);

    return () => {
      stopDrag();
      container.removeEventListener(
        ONTOLOGY_EDIT_PORT_DOWN_EVENT,
        handlePortDown
      );
    };
  }, [containerRef, isEditMode]);

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
      if (armedFromId !== null || nodeId === pendingRelation?.fromId) {
        editEvent.preventDefault();
        selectTarget(nodeId, point, { isPort });

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
    pendingRelation,
    selectTarget,
    startArm,
    toLocalPoint,
  ]);

  if (!isEditMode) {
    return null;
  }

  const getNodeLabel = (nodeId: string) => nodeLabels[nodeId] ?? nodeId;

  const renderInstruction = (fromId: string) => (
    <div
      className={classNames(
        'tw:absolute tw:top-4 tw:left-4 tw:z-10 tw:flex tw:h-10 tw:items-center tw:gap-2.5',
        'tw:rounded-full tw:border tw:border-brand tw:bg-brand-primary tw:pr-2 tw:pl-3.5 tw:font-body tw:whitespace-nowrap tw:shadow-md'
      )}
      data-testid="ontology-connect-instruction"
      role="status">
      <Link01
        aria-hidden="true"
        className="tw:size-4 tw:text-fg-brand-primary"
      />
      <span className="tw:text-sm tw:font-medium tw:text-brand-secondary">
        {t('message.click-another-term-to-draw-connection', {
          term: getNodeLabel(fromId),
        })}
      </span>
      <kbd className="tw:rounded tw:border tw:border-secondary tw:bg-primary tw:px-1.5 tw:font-body tw:text-xs tw:text-tertiary">
        {t('label.esc')}
      </kbd>
      <ButtonUtility
        className="tw:pointer-events-auto"
        data-testid="ontology-connect-cancel"
        icon={XClose}
        size="xs"
        tooltip={t('label.cancel')}
        onClick={() => {
          cancel();
          dismissPending();
        }}
      />
    </div>
  );

  const lineStart = pendingRelation?.from ?? armedAt;
  const lineEnd = pendingRelation?.to ?? cursor;

  return (
    <div
      className="tw:pointer-events-none tw:absolute tw:inset-0 tw:z-5"
      data-testid="ontology-port-overlay"
      ref={overlayRef}>
      {armedFromId ? renderInstruction(armedFromId) : null}

      {lineStart && lineEnd ? (
        <svg
          className="tw:absolute tw:inset-0 tw:h-full tw:w-full"
          style={{ overflow: 'visible' }}>
          <line
            className="tw:motion-safe:animate-pulse"
            data-testid="ontology-connection-line"
            stroke="var(--tw-color-bg-brand-solid)"
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
            canCreateType={canCreateRelationType}
            checkRelation={(relationType) =>
              checkRelation?.(
                pendingRelation.fromId,
                pendingRelation.toId,
                relationType
              )
            }
            groups={relationTypeGroups}
            sourceId={pendingRelation.fromId}
            sourceLabel={getNodeLabel(pendingRelation.fromId)}
            targetId={pendingRelation.toId}
            targetLabel={getNodeLabel(pendingRelation.toId)}
            warnRelation={(relationType) =>
              warnRelation?.(
                pendingRelation.fromId,
                pendingRelation.toId,
                relationType
              ) ?? Promise.resolve(undefined)
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
