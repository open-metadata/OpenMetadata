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

import { ZOOM_VALUE } from '../../../constants/Lineage.constants';
import {
  LineageAction,
  LineageActionType,
  LineagePlatformView,
  LineageState,
} from '../LineageProviderV1.interface';

export const initialLineageState: LineageState = {
  loading: false,
  init: false,
  status: 'initial',
  isDrawerOpen: false,
  isEditMode: false,
  selectedNode: {} as any,
  selectedEdge: undefined,
  selectedColumn: '',
  activeLayer: [],
  nodes: [],
  edges: [],
  entityLineage: {
    nodes: [],
    edges: [],
    entity: {} as any,
  },
  lineageConfig: {
    upstreamDepth: 3,
    downstreamDepth: 3,
    nodesPerLayer: 50,
  },
  tracedNodes: [],
  tracedColumns: [],
  columnsHavingLineage: [],
  zoomValue: ZOOM_VALUE,
  platformView: LineagePlatformView.None,
  expandAllColumns: false,
  isPlatformLineage: false,
  entityFqn: '',
  showDeleteModal: false,
  showAddEdgeModal: false,
  deletionState: {
    loading: false,
    status: 'initial',
  },
};

export const lineageReducer = (
  state: LineageState,
  action: LineageAction
): LineageState => {
  switch (action.type) {
    case LineageActionType.SET_LOADING:
      return { ...state, loading: action.payload };

    case LineageActionType.SET_INIT:
      return { ...state, init: action.payload };

    case LineageActionType.SET_STATUS:
      return { ...state, status: action.payload };

    case LineageActionType.SET_DRAWER_OPEN:
      return { ...state, isDrawerOpen: action.payload };

    case LineageActionType.SET_EDIT_MODE:
      return { ...state, isEditMode: action.payload };

    case LineageActionType.SET_SELECTED_NODE:
      return { ...state, selectedNode: action.payload };

    case LineageActionType.SET_SELECTED_EDGE:
      return { ...state, selectedEdge: action.payload };

    case LineageActionType.SET_SELECTED_COLUMN:
      return { ...state, selectedColumn: action.payload };

    case LineageActionType.SET_ACTIVE_LAYER:
      return { ...state, activeLayer: action.payload };

    case LineageActionType.SET_NODES:
      return { ...state, nodes: action.payload };

    case LineageActionType.SET_EDGES:
      return { ...state, edges: action.payload };

    case LineageActionType.SET_ENTITY_LINEAGE:
      return { ...state, entityLineage: action.payload };

    case LineageActionType.SET_LINEAGE_CONFIG:
      return { ...state, lineageConfig: action.payload };

    case LineageActionType.SET_TRACED_NODES:
      return { ...state, tracedNodes: action.payload };

    case LineageActionType.SET_TRACED_COLUMNS:
      return { ...state, tracedColumns: action.payload };

    case LineageActionType.SET_ZOOM_VALUE:
      return { ...state, zoomValue: action.payload };

    case LineageActionType.SET_PLATFORM_VIEW:
      return { ...state, platformView: action.payload };

    case LineageActionType.SET_EXPAND_ALL_COLUMNS:
      return { ...state, expandAllColumns: action.payload };

    case LineageActionType.SET_MODAL_STATE:
      return {
        ...state,
        showDeleteModal:
          action.payload.showDeleteModal ?? state.showDeleteModal,
        showAddEdgeModal:
          action.payload.showAddEdgeModal ?? state.showAddEdgeModal,
      };

    case LineageActionType.SET_DELETION_STATE:
      return { ...state, deletionState: action.payload };

    case LineageActionType.BATCH_UPDATE:
      // Batch update for multiple state changes at once
      return { ...state, ...action.payload };

    default:
      return state;
  }
};
