import { DataNode, EventDataNode, Key } from 'rc-tree/lib/interface';

export interface TreeViewProps {
  treeData: DataNode[];
  defaultExpandAll?: boolean;
  showIcon?: boolean;
  selectedKeys?: string[];
  expandedKeys?: string[];
  loadingKey?: string[];
  handleClick?: (
    event: React.MouseEvent<HTMLElement>,
    node: EventDataNode
  ) => void;
  handleExpand?: (
    expandedKeys: Key[],
    info: {
      node: EventDataNode;
      expanded: boolean;
      nativeEvent: MouseEvent;
    }
  ) => void;
}
