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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  ArrowHeadType,
  Edge,
  Elements,
  Node,
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
  const [elements, setElements] = useState<Elements>([]);

  const getNodeType = useCallback(
    (index: number) => {
      return index === 0
        ? 'input'
        : index === tasks.length - 1
        ? 'output'
        : 'default';
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

  const nodes: Node[] = useMemo(() => {
    const posY = 0;
    let posX = 0;
    const deltaX = 250;

    return tasks.map((task, index) => {
      posX += deltaX;
      const taskStatus = getTaskExecStatus(
        task.name,
        selectedExec?.taskStatus || []
      );

      return {
        className: classNames('leaf-node', taskStatus),
        id: replaceSpaceWith_(task.name),
        type: getNodeType(index),
        data: {
          label: getEntityName(task as EntityReference),
        },
        position: { x: posX, y: posY },
      };
    });
  }, [tasks, selectedExec]);

  const edges: Edge[] = useMemo(() => {
    return tasks.reduce((prev, task) => {
      const src = replaceSpaceWith_(task.name);
      const taskEdges = (task.downstreamTasks || []).map((dwTask) => {
        const dest = replaceSpaceWith_(dwTask);

        return {
          arrowHeadType: ArrowHeadType.ArrowClosed,
          id: `${src}-${dest}`,
          type: 'custom',
          source: src,
          target: dest,
          label: '',
        } as Edge;
      });

      return [...prev, ...taskEdges];
    }, [] as Edge[]);
  }, [tasks]);

  useEffect(() => {
    setElements(getLayoutedElements([...nodes, ...edges]));
  }, [nodes, edges]);

  return (
    <ReactFlow
      data-testid="react-flow-component"
      elements={elements}
      maxZoom={2}
      minZoom={0.5}
      nodeTypes={nodeTypes}
      selectNodesOnDrag={false}
      zoomOnDoubleClick={false}
      zoomOnScroll={false}
      onLoad={onLoad}
    />
  );
};

export default TasksDAGView;
