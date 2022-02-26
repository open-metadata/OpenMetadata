import RcTree from 'rc-tree';
import 'rc-tree/assets/index.css';
import { DataNode, IconType } from 'rc-tree/lib/interface';
import React, { ForwardedRef, forwardRef } from 'react';
import './treeView.css';
import { TreeViewProps } from './TreeView.interface';

const TreeView = forwardRef(
  (props: TreeViewProps, ref: ForwardedRef<RcTree<DataNode>>) => {
    const {
      treeData,
      selectedKeys,
      expandedKeys,
      defaultExpandAll = false,
      showIcon = false,
      handleClick,
      handleExpand,
    } = props;

    const getIcon: IconType = (props): React.ReactNode => {
      const { data, expanded } = props;
      if (data?.children) {
        return expanded ? (
          <i className="fas fa-caret-down" />
        ) : (
          <i className="fas fa-caret-right" />
        );
      }

      return;
    };

    return (
      <div>
        <RcTree
          defaultExpandAll={defaultExpandAll}
          expandedKeys={expandedKeys}
          ref={ref}
          selectedKeys={selectedKeys}
          showIcon={showIcon}
          switcherIcon={getIcon}
          treeData={treeData}
          onClick={handleClick}
          onExpand={handleExpand}
        />
      </div>
    );
  }
);

export default TreeView;
