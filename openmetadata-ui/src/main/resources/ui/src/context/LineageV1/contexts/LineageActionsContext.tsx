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

import { createContext, ReactNode, useRef } from 'react';
import { CSVExportResponse } from '../../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { LineageActionsContextType } from '../LineageProviderV1.interface';

// Default no-op implementations
const noop = () => {
  // No operation placeholder
};
const asyncNoop = async () => {
  // Async no-op placeholder
};
const promiseNoop = async () => ({} as CSVExportResponse);

export const LineageActionsContext = createContext<LineageActionsContextType>({
  onInitReactFlow: noop,
  onPaneClick: noop,
  onNodeClick: noop,
  onEdgeClick: noop,
  onColumnClick: noop,
  onLineageEditClick: noop,
  onZoomUpdate: noop,
  onLineageConfigUpdate: noop,
  onQueryFilterUpdate: noop,
  onDrawerClose: noop,
  onNodeDrop: noop,
  onNodeCollapse: noop,
  onNodesChange: noop,
  onEdgesChange: noop,
  onConnect: noop,
  onColumnEdgeRemove: noop,
  onAddPipelineClick: noop,
  onUpdateLayerView: noop,
  onExportClick: noop,
  onPlatformViewChange: noop,
  onCloseDrawer: noop,
  toggleColumnView: noop,
  loadChildNodesHandler: asyncNoop,
  fetchLineageData: noop,
  removeNodeHandler: noop,
  updateEntityData: noop,
  updateEntityFqn: noop,
  redraw: asyncNoop,
  exportLineageData: promiseNoop,
});

interface LineageActionsProviderProps {
  children: ReactNode;
  actions: LineageActionsContextType;
}

export const LineageActionsProvider = ({
  children,
  actions,
}: LineageActionsProviderProps) => {
  // Store actions in a ref to ensure they never cause re-renders
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  return (
    <LineageActionsContext.Provider value={actionsRef.current}>
      {children}
    </LineageActionsContext.Provider>
  );
};
