import { DeleteOutlined } from '@ant-design/icons';
import { Transfer, Tree, TreeDataNode, TreeProps } from 'antd';
import type { TransferDirection, TransferItem } from 'antd/es/transfer';
import type { DataNode } from 'antd/es/tree';
import { cloneDeep } from 'lodash';
import React from 'react';
import {
  filterAndArrangeTreeByKeys,
  generateTree,
  getNestedKeys,
  isChecked,
} from '../../../utils/CustomizaNavigation/CustomizeNavigation';

interface TreeTransferProps
  extends Omit<
    React.ComponentProps<typeof Transfer>,
    'dataSource' | 'targetKeys' | 'onChange'
  > {
  dataSource: DataNode[];
  targetKeys: string[];
  onChange: (
    targetKeys: string[],
    direction: TransferDirection,
    moveKeys: string[]
  ) => void;
}

export const TreeTransfer = ({
  dataSource,
  targetKeys,
  ...restProps
}: TreeTransferProps) => {
  const transferDataSource: TransferItem[] = [];

  function flatten(list: DataNode[] = []) {
    list.forEach((item) => {
      transferDataSource.push(item as TransferItem);
      flatten(item.children);
    });
  }
  flatten(dataSource);

  return (
    <Transfer
      {...restProps}
      className="tree-transfer"
      dataSource={transferDataSource}
      showSelectAll={false}
      targetKeys={targetKeys}>
      {({ direction, onItemSelect, selectedKeys, onItemRemove }) => {
        if (direction === 'left') {
          const checkedKeys = [...selectedKeys, ...targetKeys];

          return (
            <Tree
              blockNode
              checkStrictly
              checkable
              defaultExpandAll
              checkedKeys={checkedKeys}
              treeData={generateTree(dataSource, targetKeys)}
              onCheck={(_, { node: { key } }) => {
                onItemSelect(key as string, !isChecked(checkedKeys, key));
              }}
              onSelect={(_, { node: { key } }) => {
                onItemSelect(key as string, !isChecked(checkedKeys, key));
              }}
            />
          );
        } else {
          const data = filterAndArrangeTreeByKeys(
            cloneDeep(dataSource),
            targetKeys
          );

          const onDrop: TreeProps['onDrop'] = (info) => {
            const dropKey = info.node.key;
            const dragKey = info.dragNode.key;
            const dropPos = info.node.pos.split('-');
            const dropPosition =
              info.dropPosition - Number(dropPos[dropPos.length - 1]); // the drop position relative to the drop node, inside 0, top -1, bottom 1

            const loop = (
              data: TreeDataNode[],
              key: React.Key,
              callback: (
                node: TreeDataNode,
                i: number,
                data: TreeDataNode[]
              ) => void
            ) => {
              for (let i = 0; i < data.length; i++) {
                if (data[i].key === key) {
                  return callback(data[i], i, data);
                }
                if (data[i].children) {
                  loop(data[i].children!, key, callback);
                }
              }
            };
            const tempData = cloneDeep(data);

            // Find dragObject
            let dragObj: TreeDataNode;
            loop(tempData, dragKey, (item, index, arr) => {
              arr.splice(index, 1);
              dragObj = item;
            });

            if (!info.dropToGap) {
              // Drop on the content
              loop(tempData, dropKey, (item) => {
                item.children = item.children || [];
                // where to insert. New item was inserted to the start of the array in this example, but can be anywhere
                item.children.unshift(dragObj);
              });
            } else {
              let ar: TreeDataNode[] = [];
              let i: number;
              loop(tempData, dropKey, (_item, index, arr) => {
                ar = arr;
                i = index;
              });
              if (dropPosition === -1) {
                // Drop on the top of the drop node
                ar.splice(i!, 0, dragObj!);
              } else {
                // Drop on the bottom of the drop node
                ar.splice(i! + 1, 0, dragObj!);
              }
            }
            // setGData(data);

            restProps.onChange?.(getNestedKeys(tempData), direction);
            console.log('data: ', tempData);
          };

          return (
            <Tree
              autoExpandParent
              blockNode
              defaultExpandAll
              draggable
              titleRender={(node) => (
                <div className="space-between">
                  {node.title}{' '}
                  <DeleteOutlined onClick={() => onItemRemove?.([node.key])} />{' '}
                </div>
              )}
              treeData={data}
              onDrop={onDrop}
            />
          );
        }
      }}
    </Transfer>
  );
};
