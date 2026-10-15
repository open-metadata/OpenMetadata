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
  Box,
  ButtonUtility,
  Card,
  Grid,
  Toggle,
  Tree,
} from '@openmetadata/ui-core-components';
import { DotsGrid } from '@openmetadata/ui-core-components/icons';
import { NavigationTreeNode } from '../../interface/sidebar.interface';

import { isEqual } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigationBlocker } from '../../components/common/NavigationBlocker/NavigationBlocker';
import { CustomizablePageHeader } from '../../components/MyData/CustomizableComponents/CustomizablePageHeader/CustomizablePageHeader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { useApplicationsProvider } from '../../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { Persona } from '../../generated/entity/teams/persona';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import {
  getHiddenKeysFromNavigationItems,
  getTreeDataForNavigationItems,
} from '../../utils/CustomizaNavigation/CustomizeNavigation';
import { getEntityName } from '../../utils/EntityNameUtils';
import {
  getNavigationItems,
  moveNavigationItem,
} from '../../utils/SettingsNavigationPageUtils';
import { useCustomizeStore } from '../CustomizablePage/CustomizeStore';

interface Props {
  persona: Persona;
  onSave: (navigationList: NavigationItem[]) => Promise<void>;
}

export const SettingsNavigationPage = ({ onSave, persona }: Props) => {
  const { t } = useTranslation();
  const { getNavigation } = useCustomizeStore();
  const currentNavigation = getNavigation();
  const { plugins = [] } = useApplicationsProvider();

  const [hiddenKeys, setHiddenKeys] = useState<string[]>(
    getHiddenKeysFromNavigationItems(currentNavigation, plugins)
  );
  const [treeData, setTreeData] = useState<NavigationTreeNode[]>(() =>
    getTreeDataForNavigationItems(currentNavigation, plugins)
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

  const onItemMove = ({
    sourceKey,
    targetKey,
    dropPosition,
  }: {
    sourceKey: string | number;
    targetKey: string | number;
    dropPosition: 'before' | 'after' | 'on';
  }) => {
    setTreeData((nodes) =>
      moveNavigationItem(
        nodes,
        String(sourceKey),
        String(targetKey),
        dropPosition
      )
    );
  };

  const handleReset = () => {
    setTreeData(getTreeDataForNavigationItems(null, plugins));
    setHiddenKeys(getHiddenKeysFromNavigationItems(null, plugins));
  };

  const handleRemoveToggle = (checked: boolean, key: string) => {
    setHiddenKeys((prev) =>
      checked ? prev.filter((i) => i !== key) : [...prev, key]
    );
  };

  const renderNode = (node: NavigationTreeNode): React.ReactNode => (
    <Tree.Item id={node.key} key={node.key} textValue={t(node.title)}>
      <Tree.ItemContent className="tw:min-h-12" icon={node.icon}>
        <Box align="center" className="tw:flex-1" gap={2} justify="between">
          <ButtonUtility
            aria-label={t('label.move')}
            className="tw:invisible tw:group-hover/tree-item:visible tw:group-focus-within/tree-item:visible"
            color="tertiary"
            icon={DotsGrid}
            size="xs"
            slot="drag"
          />
          <span className="tw:flex-1">{t(node.title)}</span>
          <Toggle
            data-testid={`navigation-switch-${node.key}`}
            isSelected={!hiddenKeys.includes(node.key as string)}
            onChange={(isSelected) =>
              handleRemoveToggle(isSelected, node.key as string)
            }
          />
        </Box>
      </Tree.ItemContent>
      {node.children?.map(renderNode)}
    </Tree.Item>
  );

  return (
    <NavigationBlocker enabled={!disableSave} onConfirm={handleSave}>
      <PageLayoutV1
        className="bg-grey"
        pageTitle={t('label.customize-entity', {
          entity: t('label.navigation'),
        })}>
        <Grid
          className="layout-row layout-grid"
          style={{ ...getLayoutGutter(0, 20) }}>
          <Grid.Item className="layout-column" span={24}>
            <CustomizablePageHeader
              disableSave={disableSave}
              personaName={getEntityName(persona)}
              onReset={handleReset}
              onSave={handleSave}
            />
          </Grid.Item>

          <Grid.Item className="layout-column" span={24}>
            <Card className="custom-navigation-tree-container" variant="ghost">
              <Card.Header title={t('label.navigation')} />
              <Card.Content>
                <Tree
                  aria-label={t('label.navigation')}
                  className="tw:max-w-105"
                  defaultExpandedKeys={treeData.flatMap((node) => [
                    node.key,
                    ...(node.children?.map((child) => child.key) ?? []),
                  ])}
                  selectionMode="none"
                  onItemMove={onItemMove}
                  onItemRootDrop={(key) =>
                    setTreeData((nodes) =>
                      moveNavigationItem(nodes, String(key), undefined, 'after')
                    )
                  }>
                  {treeData.map(renderNode)}
                </Tree>
              </Card.Content>
            </Card>
          </Grid.Item>
        </Grid>
      </PageLayoutV1>
    </NavigationBlocker>
  );
};
