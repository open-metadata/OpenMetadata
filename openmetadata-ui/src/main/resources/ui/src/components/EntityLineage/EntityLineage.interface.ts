import { LeafNodes, LineagePos } from 'Models';
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
  lineageLeafNodes: LeafNodes;
  entityLineage: EntityLineage;
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void;
}
