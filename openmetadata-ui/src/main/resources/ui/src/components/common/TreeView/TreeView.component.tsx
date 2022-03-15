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

import classNames from 'classnames';
import { debounce } from 'lodash';
import RcTree from 'rc-tree';
import 'rc-tree/assets/index.css';
import { DataNode, EventDataNode, IconType } from 'rc-tree/lib/interface';
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
      showIcon = true,
      handleClick,
      handleExpand,
    } = props;

    const treeRef = React.createRef<RcTree>();

    // Need to disable below rule to support only non-null value for treeRef.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    React.useImperativeHandle(ref, () => treeRef.current as RcTree<DataNode>);

    const getIcon: IconType = (props): React.ReactNode => {
      const { data, expanded } = props;
      // TODO: Uncomment in case of showing loader icon
      // if (loadingKey?.includes(data?.key as string)) {
      //   return <Loader size="small" type="default" />;
      // } else
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

    const expandFolderNode = (
      event: React.MouseEvent<HTMLElement, MouseEvent>,
      node: EventDataNode
    ) => {
      const { isLeaf } = node;

      if (isLeaf || event.shiftKey || event.metaKey || event.ctrlKey) {
        return;
      }

      // Call internal rc-tree expand function
      // https://github.com/ant-design/ant-design/issues/12567
      if (treeRef && treeRef?.current) {
        treeRef.current.onNodeExpand(
          event as React.MouseEvent<HTMLDivElement, MouseEvent>,
          node
        );
      }
    };

    const onDebounceExpand = debounce(expandFolderNode, 200, {
      leading: true,
    });

    const onClick = (
      event: React.MouseEvent<HTMLElement, MouseEvent>,
      node: EventDataNode
    ) => {
      onDebounceExpand(event, node);
      handleClick?.(event, node);
    };

    return (
      <div>
        <RcTree
          className={classNames({
            //  This class will show switcher element
            'show-switcher': !showIcon,
          })}
          defaultExpandAll={defaultExpandAll}
          expandedKeys={expandedKeys}
          icon={getIcon}
          ref={treeRef}
          selectedKeys={selectedKeys}
          showIcon={showIcon}
          treeData={treeData}
          onClick={onClick}
          onExpand={handleExpand}
        />
      </div>
    );
  }
);

export default TreeView;
