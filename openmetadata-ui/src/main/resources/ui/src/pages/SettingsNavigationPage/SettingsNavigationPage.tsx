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
import { HolderOutlined } from '@ant-design/icons';
import { Card, Col, Row, Switch, Tree, TreeDataNode, TreeProps } from 'antd';
import { cloneDeep, isEqual } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDown } from '../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../assets/svg/ic-arrow-right.svg';
import { NavigationBlocker } from '../../components/common/NavigationBlocker/NavigationBlocker';
import { CustomizablePageHeader } from '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { useApplicationsProvider } from '../../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import {
  getHiddenKeysFromNavigationItems,
  getTreeDataForNavigationItems,
} from '../../utils/CustomizaNavigation/CustomizeNavigation';
import { getNavigationItems } from '../../utils/SettingsNavigationPageUtils';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';
import './settings-navigation-page.less';

interface Props {
  onSave: (navigationList: NavigationItem[]) => Promise<void>;
}

export const SettingsNavigationPage = ({ onSave }: Props) => {
  const { t } = useTranslation();
  const { getNavigation } = useCustomizeStore();
  const currentNavigation = getNavigation();
  const { plugins = [] } = useApplicationsProvider();

  const [hiddenKeys, setHiddenKeys] = useState<string[]>(
    getHiddenKeysFromNavigationItems(currentNavigation, plugins)
  );
  const [treeData, setTreeData] = useState<TreeDataNode[]>(() =>
    currentNavigation
      ? getTreeDataForNavigationItems(currentNavigation, plugins)
      : []
  );

  const disableSave = useMemo(() => {
    // Get the current navigation items from the modified tree data
    const currentNavigationItems = getNavigationItems(treeData, hiddenKeys);

    // Compare the entire structure including order, names, hidden status, and all properties
    return isEqual(currentNavigation, currentNavigationItems);
  }, [currentNavigation, treeData, hiddenKeys]);

  const handleSave = async () => {
    const navigationItems = getNavigationItems(treeData, hiddenKeys);
    await onSave(navigationItems);
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

    setTreeData(tempData);
  };

  const switcherIcon = useCallback(({ expanded }: { expanded?: boolean }) => {
    return expanded ? <IconDown /> : <IconRight />;
  }, []);

  const handleReset = () => {
    setTreeData(getTreeDataForNavigationItems(undefined, plugins));
    setHiddenKeys(getHiddenKeysFromNavigationItems());
  };

  const handleRemoveToggle = (checked: boolean, key: string) => {
    setHiddenKeys((prev) =>
      checked ? prev.filter((i) => i !== key) : [...prev, key]
    );
  };

  const titleRenderer = (node: TreeDataNode) => (
    <div className="space-between">
      {t(node.title as string)}
      <Switch
        checked={!hiddenKeys.includes(node.key as string)}
        onChange={(checked) => handleRemoveToggle(checked, node.key as string)}
      />
    </div>
  );

  return (
    <NavigationBlocker enabled={!disableSave} onConfirm={handleSave}>
      <PageLayoutV1 className="bg-grey" pageTitle="Settings Navigation Page">
        <Row gutter={[0, 20]}>
          <Col span={24}>
            <CustomizablePageHeader
              disableSave={disableSave}
              personaName={t('label.customize-your-navigation')}
              onReset={handleReset}
              onSave={handleSave}
            />
          </Col>

          <Col span={24}>
            <Card
              bordered={false}
              className="custom-navigation-tree-container"
              title="Navigation Menus">
              <Tree
                autoExpandParent
                blockNode
                defaultExpandAll
                showIcon
                draggable={{ icon: <HolderOutlined /> }}
                itemHeight={48}
                switcherIcon={switcherIcon}
                titleRender={titleRenderer}
                treeData={treeData}
                onDrop={onDrop}
              />
            </Card>
          </Col>
        </Row>
      </PageLayoutV1>
    </NavigationBlocker>
  );
};
