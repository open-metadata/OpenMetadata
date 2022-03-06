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

import RcTree from 'rc-tree';
import 'rc-tree/assets/index.css';
import { DataNode, IconType } from 'rc-tree/lib/interface';
import React, { ForwardedRef, forwardRef } from 'react';
import { normalLink } from '../../../utils/styleconstant';
import { dropdownIcon as DropdownIcon } from '../../../utils/svgconstant';
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
          <DropdownIcon
            style={{
              marginTop: '-5px',
              color: normalLink,
            }}
          />
        ) : (
          <DropdownIcon
            style={{
              transform: 'rotate(-90deg)',
              marginTop: '-5px',
              color: normalLink,
            }}
          />
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
