import { DataNode } from 'antd/lib/tree';

export const filterAndArrangeTreeByKeys = (
  tree: DataNode[],
  keys: string[]
) => {
  // Sort nodes according to the keys order
  function sortByKeys(nodeArray: DataNode[]) {
    return nodeArray.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
  }

  // Helper function to recursively filter and arrange the tree
  function filterAndArrange(node: DataNode) {
    // If the current node's key is in the keys array, process it
    if (keys.includes(node.key)) {
      // If the node has children, we recursively filter and arrange them
      if (node.children && node.children.length > 0) {
        node.children = node.children
          .map(filterAndArrange) // Recursively filter and arrange children
          .filter(Boolean); // Remove any undefined children

        // Sort the children according to the order of the keys array
        node.children = sortByKeys(node.children);
      }

      return node; // Return the node if it has the required key
    }

    return null; // Return null if the key doesn't match
  }

  // Apply the filter and arrange function to the entire tree
  let filteredTree = tree.map(filterAndArrange).filter(Boolean);

  // Sort the filtered tree based on the order of keys at the root level
  filteredTree = sortByKeys(filteredTree);

  return filteredTree;
};

export const getNestedKeys = (data: DataNode[]) =>
  data.reduce((acc: string[], item: DataNode): string[] => {
    if (item.children) {
      return [...acc, item.key as string, ...getNestedKeys(item.children)];
    }

    return [...acc, item.key as string];
  }, [] as string[]);

// Customize Table Transfer
export const isChecked = (selectedKeys: React.Key[], eventKey: React.Key) =>
  selectedKeys.includes(eventKey);

export const generateTree = (
  treeNodes: DataNode[] = [],
  checkedKeys: string[] = []
): DataNode[] =>
  treeNodes.map(({ children, ...props }) => ({
    ...props,
    disabled: checkedKeys.includes(props.key as string),
    children: generateTree(children, checkedKeys),
  }));
