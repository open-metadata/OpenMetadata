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

import { AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isEmpty, isUndefined, lowerCase, uniqueId, upperCase } from 'lodash';
import { LoadingState } from 'Models';
import React, {
  DragEvent,
  Fragment,
  FunctionComponent,
  useEffect,
  useRef,
  useState,
} from 'react';
import ReactFlow, {
  addEdge,
  ArrowHeadType,
  Background,
  BackgroundVariant,
  Connection,
  Edge,
  Elements,
  FlowElement,
  OnLoadParams,
  ReactFlowProvider,
  removeElements,
} from 'react-flow-renderer';
import { getTableDetails } from '../../axiosAPIs/tableAPI';
import { Column } from '../../generated/entity/data/table';
import {
  Edge as EntityEdge,
  EntityLineage,
} from '../../generated/type/entityLineage';
import { EntityReference } from '../../generated/type/entityReference';
import useToastContext from '../../hooks/useToastContext';
import {
  dragHandle,
  getDataLabel,
  getLayoutedElements,
  getLineageData,
  getModalBodyText,
  getNoLineageDataPlaceholder,
  onLoad,
  onNodeContextMenu,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeMouseMove,
} from '../../utils/EntityLineageUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getEntityIcon } from '../../utils/TableUtils';
import EntityInfoDrawer from '../EntityInfoDrawer/EntityInfoDrawer.component';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import CustomControls, { ControlButton } from './CustomControls.component';
import { CustomEdge } from './CustomEdge.component';
import CustomNode from './CustomNode.component';
import {
  CustomEdgeData,
  Edge as NewEdge,
  EdgeData,
  EntityLineageProp,
  SelectedEdge,
  SelectedNode,
} from './EntityLineage.interface';
import EntityLineageSidebar from './EntityLineageSidebar.component';
import NodeSuggestions from './NodeSuggestions.component';

const Entitylineage: FunctionComponent<EntityLineageProp> = ({
  entityLineage,
  loadNodeHandler,
  lineageLeafNodes,
  isNodeLoading,
  deleted,
  addLineageHandler,
  removeLineageHandler,
}: EntityLineageProp) => {
  const showToast = useToastContext();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [lineageData, setLineageData] = useState<EntityLineage>(entityLineage);
  const [reactFlowInstance, setReactFlowInstance] = useState<OnLoadParams>();
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<SelectedNode>(
    {} as SelectedNode
  );
  const expandButton = useRef<HTMLButtonElement | null>(null);
  const [expandNode, setExpandNode] = useState<EntityReference | undefined>(
    undefined
  );
  const [isEditMode, setEditMode] = useState<boolean>(false);

  const [tableColumns, setTableColumns] = useState<Column[]>([] as Column[]);
  const [newAddedNode, setNewAddedNode] = useState<FlowElement>(
    {} as FlowElement
  );
  const [selectedEntity, setSelectedEntity] = useState<EntityReference>(
    {} as EntityReference
  );
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const [showdeleteModal, setShowDeleteModal] = useState<boolean>(false);

  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge>(
    {} as SelectedEdge
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<LoadingState>('initial');
  const [deletionState, setDeletionState] = useState<{
    loading: boolean;
    status: Exclude<LoadingState, 'waiting'>;
  }>({
    loading: false,
    status: 'initial',
  });

  const getNodeClass = (node: FlowElement) => {
    return `${
      node.id.includes(lineageData.entity.id) && !isEditMode
        ? 'leaf-node core'
        : 'leaf-node'
    }`;
  };

  const selectedEntityHandler = (entity: EntityReference) => {
    setSelectedEntity(entity);
  };
  const selectNodeHandler = (state: boolean, value: SelectedNode) => {
    setIsDrawerOpen(state);
    setSelectedNode(value);
  };

  const getNodeLable = (node: EntityReference) => {
    return (
      <>
        {node.type === 'table' && !isEditMode ? (
          <button
            className="tw-absolute tw--top-4 tw--left-5 tw-cursor-pointer tw-z-9999"
            onClick={(e) => {
              expandButton.current = expandButton.current
                ? null
                : e.currentTarget;
              setExpandNode(expandNode ? undefined : node);
              setIsDrawerOpen(false);
            }}>
            <SVGIcons
              alt="plus"
              icon={expandNode?.id === node.id ? 'icon-minus' : 'icon-plus'}
              width="16px"
            />
          </button>
        ) : null}
        <p className="tw-flex">
          <span className="tw-mr-2">{getEntityIcon(node.type)}</span>
          {getDataLabel(node.displayName, node.name)}
        </p>
      </>
    );
  };

  const removeEdgeHandler = (data: SelectedEdge, confirmDelete: boolean) => {
    if (confirmDelete) {
      const edgeData: EdgeData = {
        fromEntity: data.source.type,
        fromId: data.source.id,
        toEntity: data.target.type,
        toId: data.target.id,
      };

      removeLineageHandler(edgeData);
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      setElements((es) => es.filter((e) => e.id !== data.id));
      setLineageData((pre) => {
        const newDownStreamEdges = pre.downstreamEdges?.filter(
          (d) => d.toEntity !== data.target.id
        );
        const newUpStreamEdges = pre.upstreamEdges?.filter(
          (d) => d.toEntity !== data.target.id
        );
        const newNodes = pre.nodes?.filter((n) => n.id !== data.target.id);

        return {
          ...pre,
          downstreamEdges: newDownStreamEdges,
          upstreamEdges: newUpStreamEdges,
          nodes: newNodes,
        };
      });
    }
  };

  const onEdgeClick = (
    evt: React.MouseEvent<HTMLButtonElement>,
    data: CustomEdgeData
  ) => {
    setShowDeleteModal(true);
    evt.stopPropagation();
    setSelectedEdge(() => {
      let targetNode = lineageData.nodes?.find((n) =>
        data.target?.includes(n.id)
      );

      let sourceNode = lineageData.nodes?.find((n) =>
        data.source?.includes(n.id)
      );

      if (isUndefined(targetNode)) {
        targetNode = isEmpty(selectedEntity)
          ? lineageData.entity
          : selectedEntity;
      }
      if (isUndefined(sourceNode)) {
        sourceNode = isEmpty(selectedEntity)
          ? lineageData.entity
          : selectedEntity;
      }

      return { id: data.id, source: sourceNode, target: targetNode };
    });
  };

  const setElementsHandle = () => {
    const flag: { [x: string]: boolean } = {};
    const uniqueElements: Elements = [];
    if (!isEmpty(lineageData)) {
      const graphElements = getLineageData(
        lineageData,
        selectNodeHandler,
        loadNodeHandler,
        lineageLeafNodes,
        isNodeLoading,
        getNodeLable,
        isEditMode,
        'buttonedge',
        onEdgeClick
      ) as Elements;

      graphElements.forEach((elem) => {
        if (!flag[elem.id]) {
          flag[elem.id] = true;
          uniqueElements.push(elem);
        }
      });
    }

    return uniqueElements;
  };

  const [elements, setElements] = useState<Elements>(
    getLayoutedElements(setElementsHandle())
  );

  const closeDrawer = (value: boolean) => {
    setIsDrawerOpen(value);
    setElements((prevElements) => {
      return prevElements.map((el) => {
        if (el.id === selectedNode.id) {
          return {
            ...el,
            className: getNodeClass(el),
          };
        } else {
          return el;
        }
      });
    });
    setSelectedNode({} as SelectedNode);
  };

  const onElementsRemove = (elementsToRemove: Elements) =>
    setElements((els) => removeElements(elementsToRemove, els));

  const onConnect = (params: Edge | Connection) => {
    setStatus('waiting');
    setLoading(true);
    const { target, source } = params;

    const downstreamNode = lineageData.downstreamEdges?.find((d) =>
      source?.includes(d.toEntity as string)
    );

    let targetNode = lineageData.nodes?.find((n) => target?.includes(n.id));

    let sourceNode = lineageData.nodes?.find((n) => source?.includes(n.id));

    if (isUndefined(targetNode)) {
      targetNode = target?.includes(lineageData.entity.id)
        ? lineageData.entity
        : selectedEntity;
    }
    if (isUndefined(sourceNode)) {
      sourceNode = source?.includes(lineageData.entity.id)
        ? lineageData.entity
        : selectedEntity;
    }

    const newEdge: NewEdge = {
      edge: {
        fromEntity: {
          id: sourceNode.id,
          type: sourceNode.type,
        },
        toEntity: {
          id: targetNode.id,
          type: targetNode.type,
        },
      },
    };

    setTimeout(() => {
      addLineageHandler(newEdge)
        .then(() => {
          setStatus('success');
          setLoading(false);
          setTimeout(() => {
            setElements((els) =>
              addEdge(
                { ...params, arrowHeadType: ArrowHeadType.ArrowClosed },
                els
              )
            );
            setLineageData((pre) => {
              return {
                ...pre,
                nodes: selectedEntity
                  ? [...(pre.nodes as Array<EntityReference>), selectedEntity]
                  : pre.nodes,
                downstreamEdges:
                  !isUndefined(downstreamNode) ||
                  sourceNode?.id === pre.entity.id
                    ? [
                        ...(pre.downstreamEdges as EntityEdge[]),
                        {
                          fromEntity: sourceNode?.id,
                          toEntity: targetNode?.id,
                        },
                      ]
                    : pre.downstreamEdges,
                upstreamEdges:
                  isUndefined(downstreamNode) &&
                  sourceNode?.id !== pre.entity.id
                    ? [
                        ...(pre.upstreamEdges as EntityEdge[]),
                        {
                          fromEntity: sourceNode?.id,
                          toEntity: targetNode?.id,
                        },
                      ]
                    : pre.upstreamEdges,
              };
            });
            setStatus('initial');
          }, 1000);
          setNewAddedNode({} as FlowElement);
          setSelectedEntity({} as EntityReference);
        })
        .catch(() => {
          setStatus('initial');
          setLoading(false);
        });
    }, 500);
  };

  const onElementClick = (el: FlowElement) => {
    const node = [
      ...(lineageData.nodes as Array<EntityReference>),
      lineageData.entity,
    ].find((n) => el.id.includes(n.id));
    if (!expandButton.current) {
      selectNodeHandler(true, {
        name: node?.name as string,
        id: el.id,
        type: node?.type as string,
        entityId: node?.id as string,
      });
      setElements((prevElements) => {
        return prevElements.map((preEl) => {
          if (preEl.id === el.id) {
            return { ...preEl, className: `${preEl.className} selected-node` };
          } else {
            return {
              ...preEl,
              className: getNodeClass(preEl),
            };
          }
        });
      });
    } else {
      expandButton.current = null;
    }
  };

  const onNodeExpand = (tableColumns?: Column[]) => {
    const elements = getLayoutedElements(setElementsHandle());
    setElements(
      elements.map((preEl) => {
        if (preEl.id.includes(expandNode?.id as string)) {
          return {
            ...preEl,
            className: `${preEl.className} selected-node`,
            data: { ...preEl.data, columns: tableColumns },
          };
        } else {
          return {
            ...preEl,
            className: getNodeClass(preEl),
          };
        }
      })
    );
  };

  const getTableColumns = (expandNode?: EntityReference) => {
    if (expandNode) {
      getTableDetails(expandNode.id, ['columns'])
        .then((res: AxiosResponse) => {
          const { columns } = res.data;
          setTableColumns(columns);
        })
        .catch(() => {
          showToast({
            variant: 'error',
            body: `Error while fetching ${getDataLabel(
              expandNode.displayName,
              expandNode.name,
              '.',
              true
            )} columns`,
          });
        });
    }
  };

  const removeNodeHandler = (node: FlowElement) => {
    setElements((es) => es.filter((n) => n.id !== node.id));
    setNewAddedNode({} as FlowElement);
  };

  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();

    const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
    const type = event.dataTransfer.getData('application/reactflow');
    if (type.trim()) {
      const position = reactFlowInstance?.project({
        x: event.clientX - (reactFlowBounds?.left ?? 0),
        y: event.clientY - (reactFlowBounds?.top ?? 0),
      });
      const [lable, nodeType] = type.split('-');
      const newNode = {
        id: uniqueId(),
        nodeType,
        position,
        className: 'leaf-node',
        connectable: false,
        data: {
          label: (
            <div className="tw-relative">
              <button
                className="tw-absolute tw--top-4 tw--right-6 tw-cursor-pointer tw-z-9999 tw-bg-body-hover tw-rounded-full"
                onClick={() => {
                  removeNodeHandler(newNode as FlowElement);
                }}>
                <SVGIcons
                  alt="times-circle"
                  icon="icon-times-circle"
                  width="16px"
                />
              </button>
              <div className="tw-flex">
                <SVGIcons
                  alt="entity-icon"
                  className="tw-mr-2"
                  icon={`${lowerCase(lable)}-grey`}
                  width="16px"
                />
                <NodeSuggestions
                  entityType={upperCase(lable)}
                  onSelectHandler={selectedEntityHandler}
                />
              </div>
            </div>
          ),
          isNewNode: true,
        },
      };
      setNewAddedNode(newNode as FlowElement);

      setElements((es) => es.concat(newNode as FlowElement));
    }
  };

  const onEntitySelect = () => {
    if (!isEmpty(selectedEntity)) {
      const isExistingNode = elements.some((n) =>
        n.id.includes(selectedEntity.id)
      );
      if (isExistingNode) {
        setElements((es) =>
          es
            .map((n) =>
              n.id.includes(selectedEntity.id)
                ? { ...n, className: `${n.className} selected-node` }
                : n
            )
            .filter((es) => es.id !== newAddedNode.id)
        );
        setNewAddedNode({} as FlowElement);
        setSelectedEntity({} as EntityReference);
      } else {
        setElements((es) => {
          return es.map((el) => {
            if (el.id === newAddedNode.id) {
              return {
                ...el,
                connectable: true,
                id: selectedEntity.id,
                data: {
                  label: (
                    <Fragment>
                      {getNodeLable(selectedEntity)}
                      <button
                        className="tw-absolute tw--top-5 tw--right-4 tw-cursor-pointer tw-z-9999 tw-bg-body-hover tw-rounded-full"
                        onClick={() => {
                          removeNodeHandler({
                            ...el,
                            id: selectedEntity.id,
                          } as FlowElement);
                        }}>
                        <SVGIcons
                          alt="times-circle"
                          icon="icon-times-circle"
                          width="16px"
                        />
                      </button>
                    </Fragment>
                  ),
                },
              };
            } else {
              return el;
            }
          });
        });
      }
    }
  };

  const onRemove = () => {
    setDeletionState({ loading: true, status: 'initial' });
    setTimeout(() => {
      setDeletionState({ loading: false, status: 'success' });
      setTimeout(() => {
        setShowDeleteModal(false);
        setConfirmDelete(true);
        setDeletionState((pre) => ({ ...pre, status: 'initial' }));
      }, 500);
    }, 500);
  };

  useEffect(() => {
    setElements(getLayoutedElements(setElementsHandle()));
    setExpandNode(undefined);
    setTableColumns([]);
    setConfirmDelete(false);
  }, [lineageData, isNodeLoading, isEditMode]);

  useEffect(() => {
    onNodeExpand();
    getTableColumns(expandNode);
  }, [expandNode]);

  useEffect(() => {
    if (!isEmpty(selectedNode)) {
      setExpandNode(undefined);
    }
  }, [selectedNode]);

  useEffect(() => {
    if (tableColumns.length) {
      onNodeExpand(tableColumns);
    }
  }, [tableColumns]);

  useEffect(() => {
    onEntitySelect();
  }, [selectedEntity]);

  useEffect(() => {
    removeEdgeHandler(selectedEdge, confirmDelete);
  }, [selectedEdge, confirmDelete]);

  useEffect(() => {
    setLineageData((pre) => ({
      ...pre,
      nodes: [
        ...(pre.nodes as EntityReference[]),
        ...(entityLineage.nodes as EntityReference[]),
      ],
      downstreamEdges: [
        ...(pre.downstreamEdges as EntityEdge[]),
        ...(entityLineage.downstreamEdges as EntityEdge[]),
      ],
      upstreamEdges: [
        ...(pre.upstreamEdges as EntityEdge[]),
        ...(entityLineage.upstreamEdges as EntityEdge[]),
      ],
    }));
  }, [entityLineage]);

  return (
    <Fragment>
      {(entityLineage?.downstreamEdges ?? []).length > 0 ||
      (entityLineage?.upstreamEdges ?? []).length > 0 ? (
        <div className="tw-relative tw-h-full tw--mx-4 tw--mt-4">
          <div className="tw-w-full tw-h-full" ref={reactFlowWrapper}>
            <ReactFlowProvider>
              <ReactFlow
                edgeTypes={{ buttonedge: CustomEdge }}
                elements={elements as Elements}
                elementsSelectable={!isEditMode}
                maxZoom={2}
                minZoom={0.5}
                nodeTypes={{
                  output: CustomNode,
                  input: CustomNode,
                  default: CustomNode,
                }}
                nodesConnectable={isEditMode}
                selectNodesOnDrag={false}
                zoomOnDoubleClick={false}
                zoomOnPinch={false}
                zoomOnScroll={false}
                onConnect={onConnect}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onElementClick={(_e, el) => onElementClick(el)}
                onElementsRemove={onElementsRemove}
                onLoad={(reactFlowInstance: OnLoadParams) => {
                  onLoad(reactFlowInstance);
                  setReactFlowInstance(reactFlowInstance);
                }}
                onNodeContextMenu={onNodeContextMenu}
                onNodeDrag={dragHandle}
                onNodeDragStart={dragHandle}
                onNodeDragStop={dragHandle}
                onNodeMouseEnter={onNodeMouseEnter}
                onNodeMouseLeave={onNodeMouseLeave}
                onNodeMouseMove={onNodeMouseMove}>
                <CustomControls
                  className="tw-absolute tw-top-1 tw-right-1 tw-bottom-full tw-ml-4 tw-mt-4"
                  fitViewParams={{ minZoom: 0.5, maxZoom: 2.5 }}>
                  {!deleted && (
                    <ControlButton
                      className={classNames(
                        'tw-h-9 tw-w-9 tw-rounded-full tw-px-1 tw-shadow-lg tw-cursor-pointer',
                        {
                          'tw-bg-primary': isEditMode,
                          'tw-bg-primary-hover-lite': !isEditMode,
                        }
                      )}
                      onClick={() => {
                        setEditMode((pre) => !pre && !deleted);
                        setSelectedNode({} as SelectedNode);
                        setIsDrawerOpen(false);
                        setNewAddedNode({} as FlowElement);
                      }}>
                      {loading ? (
                        <Loader size="small" type="white" />
                      ) : status === 'success' ? (
                        <i
                          aria-hidden="true"
                          className="fa fa-check tw-text-white"
                        />
                      ) : (
                        <SVGIcons
                          alt="icon-edit-lineag"
                          className="tw--mt-1"
                          data-testid="edit-lineage"
                          icon={
                            !isEditMode
                              ? 'icon-edit-lineage-color'
                              : 'icon-edit-lineage'
                          }
                          width="14"
                        />
                      )}
                    </ControlButton>
                  )}
                </CustomControls>
                {isEditMode ? (
                  <Background
                    gap={12}
                    size={1}
                    variant={BackgroundVariant.Lines}
                  />
                ) : null}
              </ReactFlow>
            </ReactFlowProvider>
            :
          </div>
          <EntityInfoDrawer
            isMainNode={selectedNode.name === entityLineage.entity.name}
            selectedNode={selectedNode}
            show={isDrawerOpen && !isEditMode}
            onCancel={closeDrawer}
          />
          <EntityLineageSidebar newAddedNode={newAddedNode} show={isEditMode} />
          {showdeleteModal ? (
            <ConfirmationModal
              bodyText={getModalBodyText(selectedEdge)}
              cancelText={
                <span
                  className={classNames({
                    'tw-pointer-events-none tw-opacity-70':
                      deletionState.loading,
                  })}>
                  Cancel
                </span>
              }
              confirmText={
                deletionState.loading ? (
                  <Loader size="small" type="white" />
                ) : deletionState.status === 'success' ? (
                  <i aria-hidden="true" className="fa fa-check tw-text-white" />
                ) : (
                  'Confirm'
                )
              }
              header="Remove lineage edge"
              onCancel={() => {
                setShowDeleteModal(false);
              }}
              onConfirm={onRemove}
            />
          ) : null}
        </div>
      ) : (
        getNoLineageDataPlaceholder()
      )}
    </Fragment>
  );
};

export default Entitylineage;
