import React, {
  MouseEvent as ReactMouseEvent,
  useEffect,
  useState,
} from 'react';
import ReactFlow, {
  addEdge,
  ArrowHeadType,
  Connection,
  Controls,
  Edge,
  Elements,
  FlowElement,
  Node,
  OnLoadParams,
  Position,
  ReactFlowProvider,
  removeElements,
} from 'react-flow-renderer';
import {
  Edge as LineageEdge,
  EntityLineage,
} from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';

const onLoad = (reactFlowInstance: OnLoadParams) => {
  reactFlowInstance.fitView();
};
/* eslint-disable-next-line */
const onNodeMouseEnter = (_event: ReactMouseEvent, _node: Node | Edge) => {
  return;
};
/* eslint-disable-next-line */
const onNodeMouseMove = (_event: ReactMouseEvent, _node: Node | Edge) => {
  return;
};
/* eslint-disable-next-line */
const onNodeMouseLeave = (_event: ReactMouseEvent, _node: Node | Edge) => {
  return;
};
/* eslint-disable-next-line */
const onNodeContextMenu = (_event: ReactMouseEvent, _node: Node | Edge) => {
  _event.preventDefault();
};

const getDataLabel = (v = '', separator = '.') => {
  const length = v.split(separator).length;

  return (
    <p className="tw-break-words description-text">
      {v.split(separator)[length - 1]}
    </p>
  );
};

const positionX = 150;
const positionY = 60;

const getLineageData = (entityLineage: EntityLineage) => {
  const [x, y] = [0, 0];
  const nodes = entityLineage['nodes'];
  let upstreamEdges: Array<LineageEdge & { isMapped: boolean }> =
    entityLineage['upstreamEdges']?.map((up) => ({ isMapped: false, ...up })) ||
    [];
  let downstreamEdges: Array<LineageEdge & { isMapped: boolean }> =
    entityLineage['downstreamEdges']?.map((down) => ({
      isMapped: false,
      ...down,
    })) || [];
  const mainNode = entityLineage['entity'];

  const UPStreamNodes: Elements = [];
  const DOWNStreamNodes: Elements = [];
  const lineageEdges: Elements = [];

  const getNodes = (
    id: string,
    pos: 'from' | 'to',
    depth: number,
    NodesArr: Array<EntityReference & { lDepth: number }> = []
  ): Array<EntityReference & { lDepth: number }> => {
    if (pos === 'to') {
      let upDepth = NodesArr.filter((nd) => nd.lDepth === depth).length;
      const UPNodes: Array<EntityReference> = [];
      const updatedUpStreamEdge = upstreamEdges.map((up) => {
        if (up.toEntity === id) {
          const edg = UPStreamNodes.find((up) => up.id.includes(`node-${id}`));
          const node = nodes?.find((nd) => nd.id === up.fromEntity);
          if (node) {
            UPNodes.push(node);
            UPStreamNodes.push({
              id: `node-${node.id}-${depth}`,
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
              type: 'default',
              className: 'leaf-node',
              data: { label: getDataLabel(node.name as string) },
              position: {
                x: -positionX * 2 * depth,
                y: y + positionY * upDepth,
              },
            });
            lineageEdges.push({
              id: `edge-${up.fromEntity}-${id}-${depth}`,
              source: `node-${node.id}-${depth}`,
              target: edg ? edg.id : `node-${id}-${depth}`,
              type: 'custom',
              arrowHeadType: ArrowHeadType.ArrowClosed,
            });
          }
          upDepth += 1;

          return {
            ...up,
            isMapped: true,
          };
        } else {
          return up;
        }
      });

      upstreamEdges = updatedUpStreamEdge;

      return UPNodes?.map((upNd) => ({ lDepth: depth, ...upNd })) || [];
    } else {
      let downDepth = NodesArr.filter((nd) => nd.lDepth === depth).length;
      const DOWNNodes: Array<EntityReference> = [];
      const updatedDownStreamEdge = downstreamEdges.map((down) => {
        if (down.fromEntity === id) {
          const edg = DOWNStreamNodes.find((down) =>
            down.id.includes(`node-${id}`)
          );
          const node = nodes?.find((nd) => nd.id === down.toEntity);
          if (node) {
            DOWNNodes.push(node);
            DOWNStreamNodes.push({
              id: `node-${node.id}-${depth}`,
              sourcePosition: Position.Right,
              targetPosition: Position.Left,
              type: 'default',
              className: 'leaf-node',
              data: { label: getDataLabel(node.name as string) },
              position: {
                x: positionX * 2 * depth,
                y: y + positionY * downDepth,
              },
            });
            lineageEdges.push({
              id: `edge-${id}-${down.toEntity}`,
              source: edg ? edg.id : `node-${id}-${depth}`,
              target: `node-${node.id}-${depth}`,
              type: 'custom',
              arrowHeadType: ArrowHeadType.ArrowClosed,
            });
          }
          downDepth += 1;

          return {
            ...down,
            isMapped: true,
          };
        } else {
          return down;
        }
      });

      downstreamEdges = updatedDownStreamEdge;

      return DOWNNodes?.map((downNd) => ({ lDepth: depth, ...downNd })) || [];
    }
  };

  const getUpStreamData = (
    Entity: EntityReference,
    depth = 1,
    upNodesArr: Array<EntityReference & { lDepth: number }> = []
  ) => {
    const upNodes = getNodes(Entity.id, 'to', depth, upNodesArr);
    upNodesArr.push(...upNodes);
    upNodes.forEach((up) => {
      if (
        upstreamEdges.some((upE) => upE.toEntity === up.id && !upE.isMapped)
      ) {
        getUpStreamData(up, depth + 1, upNodesArr);
      }
    });

    return upNodesArr;
  };

  const getDownStreamData = (
    Entity: EntityReference,
    depth = 1,
    downNodesArr: Array<EntityReference & { lDepth: number }> = []
  ) => {
    const downNodes = getNodes(Entity.id, 'from', depth, downNodesArr);
    downNodesArr.push(...downNodes);
    downNodes.forEach((down) => {
      if (
        downstreamEdges.some(
          (downE) => downE.fromEntity === down.id && !downE.isMapped
        )
      ) {
        getDownStreamData(down, depth + 1, downNodesArr);
      }
    });

    return downNodesArr;
  };

  getUpStreamData(mainNode);

  getDownStreamData(mainNode);

  const lineageData = [
    {
      id: `node-${mainNode.id}-1`,
      sourcePosition: 'right',
      targetPosition: 'left',
      type: 'default',
      className: 'leaf-node core',
      data: { label: getDataLabel(mainNode.name as string) },
      position: { x: x, y: y },
    },
    ...UPStreamNodes.map((up) => {
      return lineageEdges.find(
        (ed: FlowElement) => (ed as Edge).target === up.id
      )
        ? up
        : { ...up, type: 'input' };
    }),
    ...DOWNStreamNodes.map((down) => {
      return lineageEdges.find((ed: FlowElement) =>
        (ed as Edge).source.includes(down.id)
      )
        ? down
        : { ...down, type: 'output' };
    }),
    ...lineageEdges,
  ];

  return lineageData;
};

const Entitylineage = ({ entityLineage }: { entityLineage: EntityLineage }) => {
  const [elements, setElements] = useState<Elements>(
    getLineageData(entityLineage) as Elements
  );
  const onElementsRemove = (elementsToRemove: Elements) =>
    setElements((els) => removeElements(elementsToRemove, els));
  const onConnect = (params: Edge | Connection) =>
    setElements((els) => addEdge(params, els));

  useEffect(() => {
    setElements(getLineageData(entityLineage) as Elements);
  }, [entityLineage]);

  return (
    <>
      {(entityLineage?.downstreamEdges ?? []).length > 0 ||
      (entityLineage.upstreamEdges ?? []).length ? (
        <ReactFlowProvider>
          <ReactFlow
            panOnScroll
            elements={elements as Elements}
            nodesConnectable={false}
            onConnect={onConnect}
            onElementsRemove={onElementsRemove}
            onLoad={onLoad}
            onNodeContextMenu={onNodeContextMenu}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            onNodeMouseMove={onNodeMouseMove}>
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      ) : (
        <div className="tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8">
          No Lineage data available
        </div>
      )}
    </>
  );
};

export default Entitylineage;
