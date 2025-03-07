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
import Icon from '@ant-design/icons';
import { Button, Col, Row, Tree, TreeDataNode, TreeProps } from 'antd';
import { DataNode } from 'antd/lib/tree';
import { AxiosError } from 'axios';
import { cloneDeep, isEmpty, isNil } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DeleteIcon } from '../../assets/svg/delete-white.svg';
import { ReactComponent as IconDown } from '../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../assets/svg/ic-arrow-right.svg';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { LeftSidebarItem } from '../../components/MyData/LeftSidebar/LeftSidebar.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { Persona } from '../../generated/entity/teams/persona';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import { useFqn } from '../../hooks/useFqn';
import { getPersonaByName } from '../../rest/PersonaAPI';
import {
  filterAndArrangeTreeByKeys,
  getNavigationItems,
  getNestedKeys,
  getNestedKeysFromNavigationItems,
} from '../../utils/CustomizaNavigation/CustomizeNavigation';
import { getEntityName } from '../../utils/EntityUtils';
import leftSidebarClassBase from '../../utils/LeftSidebarClassBase';
import { getPersonaDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
const sidebarOptions = leftSidebarClassBase.getSidebarItems();

interface Props {
  onSave: (navigationList: NavigationItem[]) => Promise<void>;
  currentNavigation?: NavigationItem[];
}

export const SettingsNavigationPage = ({
  onSave,
  currentNavigation,
}: Props) => {
  const { fqn } = useFqn();
  const [isPersonaLoading, setIsPersonaLoading] = useState(true);
  const [personaDetails, setPersonaDetails] = useState<Persona | null>(null);
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [targetKeys, setTargetKeys] = useState<string[]>(
    isEmpty(currentNavigation)
      ? getNestedKeys(sidebarOptions)
      : getNestedKeysFromNavigationItems(currentNavigation ?? [])
  );

  const treeData = filterAndArrangeTreeByKeys<DataNode>(
    cloneDeep(sidebarOptions),
    targetKeys
  );

  const handleChange = (newTargetKeys: string[]) => {
    setTargetKeys(newTargetKeys);
  };

  const titleLinks = useMemo(
    () => [
      {
        name: 'Settings',
        url: '/settings',
      },
      ...(personaDetails
        ? [
            {
              name: getEntityName(personaDetails),
              url: getPersonaDetailsPath(fqn),
            },
          ]
        : []),
    ],
    [personaDetails?.name]
  );

  const fetchPersonaDetails = async () => {
    try {
      setIsPersonaLoading(true);
      const persona = await getPersonaByName(fqn);

      setPersonaDetails(persona);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPersonaLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const navigationItems = getNavigationItems(
      filterAndArrangeTreeByKeys<LeftSidebarItem>(
        cloneDeep(sidebarOptions),
        targetKeys
      ).filter((t) => !isNil(t))
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

  const handleRemove = (key: string) => {
    setTargetKeys(targetKeys.filter((k) => k !== key));
  };

  const switcherIcon = useCallback(({ expanded }) => {
    return expanded ? <IconDown /> : <IconRight />;
  }, []);

  const handleReset = () => {
    handleChange(getNestedKeys(sidebarOptions));
  };

  const titleRenderer = (node: TreeDataNode) => (
    <div className="space-between">
      {node.title}{' '}
      <Icon
        component={DeleteIcon}
        style={{ cursor: 'pointer', fontSize: '18px' }}
        onClick={() => handleRemove(node.key as string)}
      />
    </div>
  );

  useEffect(() => {
    fetchPersonaDetails();
  }, [fqn]);

  if (isPersonaLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle="Settings Navigation Page">
      <Row className="p-x-lg" gutter={[16, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={titleLinks} />
        </Col>
        <Col flex="auto">
          <PageHeader
            data={{
              header: 'Settings Navigation Page',
              subHeader: 'Settings Navigation Page',
            }}
          />
        </Col>
        <Col className="m-auto" flex="180px">
          <Button
            className="float-right"
            loading={saving}
            size="small"
            type="primary"
            onClick={handleSave}>
            {t('label.save')}
          </Button>
          <Button
            className="float-right m-r-sm"
            size="small"
            onClick={handleReset}>
            {t('label.reset')}
          </Button>
        </Col>
        <Col span={24}>
          <Tree
            autoExpandParent
            defaultExpandAll
            draggable
            showIcon
            switcherIcon={switcherIcon}
            titleRender={titleRenderer}
            treeData={treeData}
            onDrop={onDrop}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};
