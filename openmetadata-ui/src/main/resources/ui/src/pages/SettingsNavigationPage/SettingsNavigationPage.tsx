/* eslint-disable @typescript-eslint/no-non-null-assertion */
/*
 *  Copyright 2024 Collate.
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
import { CloseOutlined, RedoOutlined, SaveOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Row,
  Space,
  Switch,
  Tree,
  TreeDataNode,
  TreeProps,
  Typography,
} from 'antd';
import { DataNode } from 'antd/lib/tree';
import { cloneDeep, isEmpty, xor } from 'lodash';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconDown } from '../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../assets/svg/ic-arrow-right.svg';
import { LeftSidebarItem } from '../../components/MyData/LeftSidebar/LeftSidebar.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import {
  filterAndArrangeTreeByKeys,
  getNavigationItems,
  getNestedKeys,
  getNestedKeysFromNavigationItems,
} from '../../utils/CustomizaNavigation/CustomizeNavigation';
import leftSidebarClassBase from '../../utils/LeftSidebarClassBase';
import './settings-navigation-page.less';

const sidebarOptions = leftSidebarClassBase.getSidebarItems();

interface Props {
  onSave: (navigationList: NavigationItem[]) => Promise<void>;
  currentNavigation?: NavigationItem[];
}

export const SettingsNavigationPage = ({
  onSave,
  currentNavigation,
}: Props) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const history = useHistory();
  const [targetKeys, setTargetKeys] = useState<string[]>(() => {
    const initialTargetKeys = isEmpty(currentNavigation)
      ? getNestedKeys(sidebarOptions)
      : getNestedKeysFromNavigationItems(currentNavigation ?? []);

    return initialTargetKeys;
  });

  // Internal state to track hidden keys
  const [hiddenKeys, setHiddenKeys] = useState<string[]>(() => {
    const initialHiddenKeys = isEmpty(currentNavigation)
      ? []
      : xor(getNestedKeys(sidebarOptions), targetKeys);

    return initialHiddenKeys;
  });

  // Tree data to display in the UI
  const treeData = filterAndArrangeTreeByKeys<DataNode>(
    cloneDeep(sidebarOptions),
    targetKeys,
    true
  );

  const handleChange = (newTargetKeys: string[]) => {
    setTargetKeys(newTargetKeys);
  };

  const handleSave = async () => {
    setSaving(true);
    const navigationItems = getNavigationItems(
      filterAndArrangeTreeByKeys<LeftSidebarItem>(
        cloneDeep(sidebarOptions),
        targetKeys,
        true
      )
        .map((t) => {
          if (t.children) {
            t.children = t.children.filter((c) => !hiddenKeys.includes(c.key));
          }

          return t;
        })
        .filter(
          (t) =>
            !hiddenKeys.includes(t.key) || (t.children && t.children.length > 0)
        )
    );

    await onSave(navigationItems);
    setSaving(false);
  };

  const onDrop: TreeProps['onDrop'] = (info) => {
    const dropKey = info.node.key;
    const dragKey = info.dragNode.key;
    const dropPos = info.node.pos.split('-');
    const dropPosition =
      info.dropPosition - Number(dropPos[dropPos.length - 1]); // the drop position relative to the drop node, inside 0, top -1, bottom 1

    const loop = (
      data: TreeDataNode[],
      key: React.Key,
      callback: (node: TreeDataNode, i: number, data: TreeDataNode[]) => void
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
    const tempData = cloneDeep(treeData);

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

    handleChange(getNestedKeys(tempData));
  };

  const switcherIcon = useCallback(({ expanded }) => {
    return expanded ? <IconDown /> : <IconRight />;
  }, []);

  const handleReset = () => {
    handleChange(getNestedKeys(sidebarOptions));
  };

  const handleRemoveToggle = (checked: boolean, key: string) => {
    setHiddenKeys((prev) =>
      checked ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const titleRenderer = (node: TreeDataNode) => (
    <div className="space-between">
      {node.title}
      <Switch
        checked={!hiddenKeys.includes(node.key as string)}
        onChange={(checked) => handleRemoveToggle(checked, node.key as string)}
      />
    </div>
  );

  const handleCancel = () => {
    history.goBack();
  };

  return (
    <PageLayoutV1 className="bg-grey" pageTitle="Settings Navigation Page">
      <Row className="p-x-lg" gutter={[0, 20]}>
        <Col span={24}>
          <Card
            bodyStyle={{ padding: 0 }}
            bordered={false}
            extra={
              <Space>
                <Button
                  data-testid="cancel-button"
                  disabled={saving}
                  icon={<CloseOutlined />}
                  onClick={handleCancel}>
                  {t('label.cancel')}
                </Button>
                <Button
                  data-testid="reset-button"
                  disabled={saving}
                  icon={<RedoOutlined />}
                  onClick={handleReset}>
                  {t('label.reset')}
                </Button>
                <Button
                  data-testid="save-button"
                  icon={<SaveOutlined />}
                  loading={saving}
                  type="primary"
                  onClick={handleSave}>
                  {t('label.save')}
                </Button>
              </Space>
            }
            title={
              <div>
                <Typography.Title
                  className="m-0"
                  data-testid="customize-page-title"
                  level={5}>
                  {t('label.customize-your-navigation')}
                </Typography.Title>
                <Typography.Paragraph className="m-0">
                  {t('message.customize-your-navigation-subheader')}
                </Typography.Paragraph>
              </div>
            }
          />
        </Col>

        <Col span={24}>
          <Card
            bodyStyle={{ padding: 20 }}
            bordered={false}
            className="custom-navigation-tree-container"
            title="Navigation Menus">
            <Tree
              autoExpandParent
              blockNode
              defaultExpandAll
              draggable
              showIcon
              itemHeight={48}
              style={{ width: '420px' }}
              switcherIcon={switcherIcon}
              titleRender={titleRenderer}
              treeData={treeData}
              onDrop={onDrop}
            />
          </Card>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};
