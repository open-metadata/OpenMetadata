import { LineagePos } from 'Models';
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
  entityLineage: EntityLineage;
  loadNodeHandler: (node: EntityReference, pos: LineagePos) => void;
}
