/*
 *  Copyright 2022 Collate.
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

import { Fragment, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MarkerType,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import {
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
} from '../../../constants/Lineage.constants';
import { EntityLineageNodeType } from '../../../enums/entity.enum';
import { PipelineStatus, Task } from '../../../generated/entity/data/pipeline';
import { replaceSpaceWith_ } from '../../../utils/CommonUtils';
import { getLayoutedElements, onLoad } from '../../../utils/EntityLineageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getTaskExecStatus } from '../../../utils/PipelineDetailsUtils';
import TaskNode from './TaskNode/TaskNode';
import './tasks-dag-view.style.less';

export interface Props {
  tasks: Task[];
  selectedExec?: PipelineStatus;
}

const TasksDAGView = ({ tasks, selectedExec }: Props) => {
  const [nodesData, setNodesData, onNodesChange] = useNodesState([]);
  const [edgesData, setEdgesData, onEdgesChange] = useEdgesState([]);

  const getNodeType = useCallback(
    (task: Task) => {
      // check if current task is downstream task of other tasks
      const isDownStreamTask = tasks.some((taskData) =>
        taskData.downstreamTasks?.includes(task.name)
      );

      // check if current task has downstream task
      const hasDownStreamTask = Boolean(task.downstreamTasks?.length);

      if (isDownStreamTask && !hasDownStreamTask) {
        return EntityLineageNodeType.OUTPUT;
      } else {
        return EntityLineageNodeType.DEFAULT;
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
        className: 'leaf-node',
        id: replaceSpaceWith_(task.name),
        type: getNodeType(task),
        data: {
          label: getEntityName(task),
          taskStatus,
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
      maxZoom={MAX_ZOOM_VALUE}
      minZoom={MIN_ZOOM_VALUE}
      nodeTypes={nodeTypes}
      nodes={nodesData}
      selectNodesOnDrag={false}
      zoomOnDoubleClick={false}
      zoomOnScroll={false}
      onEdgesChange={onEdgesChange}
      onInit={(reactFlowInstance) => {
        onLoad(reactFlowInstance);
      }}
      onNodesChange={onNodesChange}>
      <Background gap={12} size={1} />
      <Controls
        className="task-dag-control-btn"
        position="bottom-right"
        showInteractive={false}
      />
    </ReactFlow>
  ) : (
    <Fragment />
  );
};

export default TasksDAGView;
