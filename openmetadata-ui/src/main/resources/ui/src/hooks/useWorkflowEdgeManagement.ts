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

import { useCallback } from 'react';
import { Connection, Edge, MarkerType, Node } from 'reactflow';
import { NodeSubType } from '../generated/governance/workflows/elements/nodeSubType';
import { WORKFLOW_EDGE_THEME } from '../utils/WorkflowEdgeTheme';

interface UseWorkflowEdgeManagementProps {
  nodes: Node[];
  edges: Edge[];
  setEdges: (edges: Edge[] | ((prevEdges: Edge[]) => Edge[])) => void;
  editingEdge: Edge | null;
  setEditingEdge: (edge: Edge | null) => void;
  setIsConnectionModalOpen: (open: boolean) => void;
  setPendingConnection: (connection: Connection | null) => void;
  setFocusedConnection: (
    connection: { sourceId: string; targetId: string } | null
  ) => void;
  setModalPosition: (position: { x: number; y: number }) => void;
  isViewMode: boolean;
}

export const useWorkflowEdgeManagement = ({
  nodes,
  edges,
  setEdges,
  editingEdge,
  setEditingEdge,
  setIsConnectionModalOpen,
  setPendingConnection,
  setFocusedConnection,
  setModalPosition,
  isViewMode,
}: UseWorkflowEdgeManagementProps) => {
  const T = WORKFLOW_EDGE_THEME;

  const fixInvalidEdgeConditions = useCallback(
    (updatedNodeId: string, newQualityBands: unknown[]) => {
      if (!newQualityBands || newQualityBands.length === 0) {
        return;
      }

      const validConditionValues = new Set(
        (newQualityBands as { name?: string }[]).map(
          (band) => band.name?.toLowerCase() || band.name
        )
      );

      setEdges((currentEdges) => {
        return currentEdges.map((edge) => {
          if (edge.source !== updatedNodeId) {
            return edge;
          }
          const currentCondition = edge.data?.condition || edge.label;
          if (currentCondition && !validConditionValues.has(currentCondition)) {
            const firstBand = (newQualityBands as { name?: string }[])[0];
            const newCondition =
              firstBand.name?.toLowerCase() || firstBand.name;
            const newLabel = firstBand.name;

            return {
              ...edge,
              label: newLabel,
              data: {
                ...edge.data,
                conditions: [
                  {
                    field: 'result',
                    operator: 'equals',
                    value: newCondition,
                  },
                ],
                condition: newCondition,
              },
              style: {
                stroke: T.success600,
                strokeWidth: 2,
              },
              labelStyle: {
                color: T.success600,
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '1px',
                cursor: 'pointer',
              },
              labelBgStyle: {
                fill: T.success100,
                fillOpacity: 1,
                stroke: T.white,
                strokeWidth: 2,
                rx: 5,
                ry: 5,
              },
            };
          }

          return edge;
        });
      });
    },
    [setEdges, T]
  );

  const fixMissingEdgeLabels = useCallback(() => {
    setEdges((currentEdges) => {
      return currentEdges.map((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (
          edge.label &&
          typeof edge.label === 'string' &&
          edge.label.trim() !== ''
        ) {
          return edge;
        }

        if (
          sourceNode?.data?.subType === NodeSubType.UserApprovalTask ||
          sourceNode?.data?.subType === NodeSubType.CheckEntityAttributesTask ||
          sourceNode?.data?.subType ===
            NodeSubType.CheckChangeDescriptionTask ||
          sourceNode?.data?.subType === NodeSubType.DataCompletenessTask
        ) {
          return {
            ...edge,
            label: 'TRUE',
            data: {
              ...edge.data,
              conditions: [
                {
                  field: 'result',
                  operator: 'equals',
                  value: 'TRUE',
                },
              ],
              condition: 'TRUE',
            },
            style: {
              stroke: T.success600,
              strokeWidth: 2,
            },
            labelStyle: {
              color: T.success600,
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '1px',
              cursor: 'pointer',
            },
            labelBgStyle: {
              fill: T.success100,
              fillOpacity: 1,
              stroke: T.white,
              strokeWidth: 2,
              rx: 5,
              ry: 5,
            },
          };
        }

        return edge;
      });
    });
  }, [nodes, setEdges, T]);

  const handleConnectionSave = useCallback(
    (connection: Connection, conditions: { value: string }[]) => {
      const conditionLabel =
        conditions.length === 1
          ? conditions[0].value
          : `${conditions.length} conditions`;

      const edgeId = `reactflow__edge-${connection.source}-${connection.target}`;
      const newEdge = {
        id: edgeId,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: 'straight',
        label: conditionLabel,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: T.gray400,
        },
        data: {
          conditions,
          condition: conditionLabel,
        },
        style: {
          stroke: T.gray400,
          strokeWidth: 2,
        },
        labelStyle: {
          color: conditions.some(
            (c) => c.value === 'TRUE' || c.value === 'true'
          )
            ? T.success600
            : T.labelFalse,
          fontSize: '14px',
          fontWeight: 600,
          letterSpacing: '1px',
          cursor: 'pointer',
        },
        labelBgStyle: {
          fill: conditions.some((c) => c.value === 'TRUE' || c.value === 'true')
            ? T.success100
            : T.warning100,
          fillOpacity: 1,
          stroke: T.white,
          strokeWidth: 2,
          rx: 5,
          ry: 5,
        },
      };

      if (editingEdge) {
        setEdges((eds) =>
          eds.map((edge) => (edge.id === editingEdge.id ? newEdge : edge))
        );
        setEditingEdge(null);
      } else {
        const existingEdge = edges.find((edge) => edge.id === newEdge.id);

        if (existingEdge) {
          setIsConnectionModalOpen(false);
          setPendingConnection(null);
          setFocusedConnection(null);

          return;
        }

        setEdges((eds) => [...eds, newEdge]);
      }

      setIsConnectionModalOpen(false);
      setPendingConnection(null);
      setFocusedConnection(null);
    },
    [
      setEdges,
      editingEdge,
      T,
      setIsConnectionModalOpen,
      setPendingConnection,
      setFocusedConnection,
      setEditingEdge,
      edges,
    ]
  );

  const handleConnectionCancel = useCallback(() => {
    setIsConnectionModalOpen(false);
    setPendingConnection(null);
    setFocusedConnection(null);
    setEditingEdge(null);
  }, [
    setIsConnectionModalOpen,
    setPendingConnection,
    setFocusedConnection,
    setEditingEdge,
  ]);

  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      if (isViewMode) {
        return;
      }

      if (!edge.data?.conditions) {
        return;
      }

      const targetNode = nodes.find((node) => node.id === edge.target);

      if (targetNode) {
        const nodeElement = document.querySelector(
          `[data-id="${targetNode.id}"]`
        );
        if (nodeElement) {
          const nodeRect = nodeElement.getBoundingClientRect();
          setModalPosition({
            x: nodeRect.left - 10,
            y: nodeRect.top - 35,
          });
        }
      }

      setEditingEdge(edge);
      setPendingConnection({
        source: edge.source,
        target: edge.target,
        sourceHandle: null,
        targetHandle: null,
      });
      setIsConnectionModalOpen(true);
      setFocusedConnection({
        sourceId: edge.source,
        targetId: edge.target,
      });
    },
    [
      isViewMode,
      nodes,
      setEditingEdge,
      setPendingConnection,
      setIsConnectionModalOpen,
      setFocusedConnection,
      setModalPosition,
    ]
  );

  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    },
    [setEdges]
  );

  return {
    fixInvalidEdgeConditions,
    fixMissingEdgeLabels,
    handleConnectionSave,
    handleConnectionCancel,
    handleEdgeClick,
    handleEdgeDelete,
  };
};
