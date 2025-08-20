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
import {
  CloseOutlined,
  HolderOutlined,
  RedoOutlined,
  SaveOutlined,
} from '@ant-design/icons';
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
import { cloneDeep, isEqual } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import IconDown from '../../assets/svg/ic-arrow-down.svg?react';
import IconRight from '../../assets/svg/ic-arrow-right.svg?react';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import {
  getHiddenKeysFromNavigationItems,
  getTreeDataForNavigationItems,
} from '../../utils/CustomizaNavigation/CustomizeNavigation';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';
import './settings-navigation-page.less';

interface Props {
  onSave: (navigationList: NavigationItem[]) => Promise<void>;
}

const getNavigationItems = (
  treeData: TreeDataNode[],
  hiddenKeys: string[]
): NavigationItem[] => {
  return treeData.map((item) => {
    return {
      id: item.key,
      title: item.title,
      isHidden: hiddenKeys.includes(item.key as string),
      children: getNavigationItems(item.children ?? [], hiddenKeys),
    } as NavigationItem;
  });
};

export const SettingsNavigationPage = ({ onSave }: Props) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { getNavigation } = useCustomizeStore();
  const currentNavigation = getNavigation();

  const [hiddenKeys, setHiddenKeys] = useState<string[]>(
    getHiddenKeysFromNavigationItems(currentNavigation)
  );
  const [treeData, setTreeData] = useState<TreeDataNode[]>(() =>
    currentNavigation ? getTreeDataForNavigationItems(currentNavigation) : []
  );

  const disableSave = useMemo(() => {
    // Get the initial hidden keys from the current navigation
    const initialHiddenKeys =
      getHiddenKeysFromNavigationItems(currentNavigation);

    // Get the current navigation items from the tree data
    const currentNavigationItems =
      getNavigationItems(treeData, hiddenKeys) || [];

    // Get the current hidden keys from the current navigation items
    const currentHiddenKeys =
      getHiddenKeysFromNavigationItems(currentNavigationItems) || [];

    // Check if the initial hidden keys are the same as the current hidden keys
    return isEqual(initialHiddenKeys, currentHiddenKeys);
  }, [currentNavigation, treeData, hiddenKeys]);

  const handleSave = async () => {
    setSaving(true);

    const navigationItems = getNavigationItems(treeData, hiddenKeys);

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

    setTreeData(tempData);
  };

  const switcherIcon = useCallback(({ expanded }: { expanded?: boolean }) => {
    return expanded ? <IconDown /> : <IconRight />;
  }, []);

  const handleReset = () => {
    setTreeData(getTreeDataForNavigationItems());
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

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <PageLayoutV1 className="bg-grey" pageTitle="Settings Navigation Page">
      <Row gutter={[0, 20]}>
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
                  disabled={disableSave}
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
                <Typography.Paragraph className="m-0 text-sm font-normal">
                  {t('message.customize-your-navigation-subheader')}
                </Typography.Paragraph>
              </div>
            }
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
  );
};
