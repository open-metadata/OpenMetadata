import { LeafNodes, LineagePos, LoadingNodeState } from 'Models';
import {
  EntityLineage,
  EntityReference,
} from '../../generated/type/entityLineage';

export interface SelectedNode {
  name: string;
  type: string;
  id?: string;
}

export interface EntityLineageProp {
  isNodeLoading: LoadingNodeState;
  lineageLeafNodes: LeafNodes;
  entityLineage: EntityLineage;
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void;
}
