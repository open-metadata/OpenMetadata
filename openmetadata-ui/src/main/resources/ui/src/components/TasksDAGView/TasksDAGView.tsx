/*
 *  Copyright 2021 Collate
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
import React, { Fragment, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Edge,
  MarkerType,
  useEdgesState,
  useNodesState,
} from 'react-flow-renderer';
import { PipelineStatus, Task } from '../../generated/entity/data/pipeline';
import { EntityReference } from '../../generated/type/entityReference';
import { getEntityName, replaceSpaceWith_ } from '../../utils/CommonUtils';
import { getLayoutedElements, onLoad } from '../../utils/EntityLineageUtils';
import { getTaskExecStatus } from '../../utils/PipelineDetailsUtils';
import TaskNode from './TaskNode';

export interface Props {
  tasks: Task[];
  selectedExec?: PipelineStatus;
}

const TasksDAGView = ({ tasks, selectedExec }: Props) => {
  const [nodesData, setNodesData, onNodesChange] = useNodesState([]);
  const [edgesData, setEdgesData, onEdgesChange] = useEdgesState([]);

  const getNodeType = useCallback(
    (task: Task) => {
      const isDownStreamTask = tasks.some((taskData) =>
        taskData.downstreamTasks?.includes(task.name)
      );

      if (isDownStreamTask) {
        return 'output';
      } else {
        return 'default';
      }
    },
    [tasks]
  );

  const nodeTypes = useMemo(
    () => ({
      output: TaskNode,
      input: TaskNode,
      default: TaskNode,
    }),
    []
  );

  useEffect(() => {
    const nodes = tasks.map((task) => {
      const taskStatus = getTaskExecStatus(
        task.name,
        selectedExec?.taskStatus || []
      );

      return {
        className: classNames('leaf-node', taskStatus),
        id: replaceSpaceWith_(task.name),
        type: getNodeType(task),
        data: {
          label: getEntityName(task as EntityReference),
        },
        position: { x: 0, y: 0 },
        isConnectable: false,
      };
    });

    const edges = tasks.reduce((prev, task) => {
      const src = replaceSpaceWith_(task.name);
      const taskEdges = (task.downstreamTasks || []).map((dwTask) => {
        const dest = replaceSpaceWith_(dwTask);

        return {
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          id: `${src}-${dest}`,
          type: 'custom',
          source: src,
          target: dest,
        } as Edge;
      });

      return [...prev, ...taskEdges];
    }, [] as Edge[]);

    const { node: nodeValue, edge: edgeValue } = getLayoutedElements({
      node: nodes,
      edge: edges,
    });
    setNodesData(nodeValue);
    setEdgesData(edgeValue);
  }, [tasks, selectedExec]);

  return nodesData.length ? (
    <ReactFlow
      data-testid="react-flow-component"
      edges={edgesData}
      maxZoom={2}
      minZoom={0.5}
      nodeTypes={nodeTypes}
      nodes={nodesData}
      selectNodesOnDrag={false}
      zoomOnDoubleClick={false}
      zoomOnScroll={false}
      onEdgesChange={onEdgesChange}
      onInit={(reactFlowInstance) => {
        onLoad(reactFlowInstance, nodesData.length, true);
      }}
      onNodesChange={onNodesChange}
    />
  ) : (
    <Fragment />
  );
};

export default TasksDAGView;
