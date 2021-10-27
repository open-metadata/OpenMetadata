import { SelectedNode } from '../EntityLineage/EntityLineage.interface';

export interface LineageDrawerProps {
  show: boolean;
  onCancel: (value: boolean) => void;
  selectedNode: SelectedNode;
  isMainNode: boolean;
}
