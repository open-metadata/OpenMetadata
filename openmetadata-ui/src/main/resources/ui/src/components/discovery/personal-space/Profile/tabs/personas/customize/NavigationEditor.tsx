/*
 *  Copyright 2026 Collate.
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
  Toggle,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { DotsGrid } from '@openmetadata/ui-core-components/icons';
import { TreeDataNode } from 'antd';
import { AxiosError } from 'axios';
import { isEqual } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigationItem } from '../../../../../../../generated/system/ui/uiCustomization';
import {
  getHiddenKeysFromNavigationItems,
  getTreeDataForNavigationItems,
} from '../../../../../../../utils/CustomizaNavigation/CustomizeNavigation';
import { getNavigationItems } from '../../../../../../../utils/SettingsNavigationPageUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import { useApplicationsProvider } from '../../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { CustomizeEditorProps } from './customizeEditor.types';
import { savePersonaDocument } from './customizeEditor.utils';
import {
  getParentKeys,
  moveNavNode,
  moveNavNodeToRoot,
} from './NavigationEditor.utils';

const NavigationEditor = ({
  document,
  onDocumentSaved,
  onActionsChange,
}: CustomizeEditorProps) => {
  const { t } = useTranslation();
  const { plugins = [] } = useApplicationsProvider();

  const navigation = useMemo(
    () => (document.data.navigation ?? null) as NavigationItem[] | null,
    [document]
  );

  const [treeData, setTreeData] = useState<TreeDataNode[]>(() =>
    getTreeDataForNavigationItems(navigation, plugins)
  );
  const [hiddenKeys, setHiddenKeys] = useState<string[]>(() =>
    getHiddenKeysFromNavigationItems(navigation, plugins)
  );
  const [isSaving, setIsSaving] = useState(false);

  const baseline = useMemo(
    () =>
      getNavigationItems(
        getTreeDataForNavigationItems(navigation, plugins),
        getHiddenKeysFromNavigationItems(navigation, plugins)
      ),
    [navigation, plugins]
  );

  const current = useMemo(
    () => getNavigationItems(treeData, hiddenKeys),
    [treeData, hiddenKeys]
  );

  const canSave = useMemo(
    () => !isEqual(baseline, current),
    [baseline, current]
  );

  const handleToggle = useCallback((checked: boolean, key: string) => {
    setHiddenKeys((prev) =>
      checked ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const handleReset = useCallback(() => {
    setTreeData(getTreeDataForNavigationItems(null, plugins));
    setHiddenKeys(getHiddenKeysFromNavigationItems(null, plugins));
  }, [plugins]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const saved = await savePersonaDocument(document, (draft) => {
        draft.data.navigation = current;
      });
      onDocumentSaved(saved);
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.navigation') })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  }, [document, current, onDocumentSaved, t]);

  const handleItemMove = useCallback(
    ({
      sourceKey,
      targetKey,
      dropPosition,
    }: {
      sourceKey: Key;
      targetKey: Key;
      dropPosition: 'before' | 'after' | 'on';
    }) => {
      setTreeData((prev) =>
        moveNavNode(prev, String(sourceKey), String(targetKey), dropPosition)
      );
    },
    []
  );

  const handleItemRootDrop = useCallback((sourceKey: Key) => {
    setTreeData((prev) => moveNavNodeToRoot(prev, String(sourceKey)));
  }, []);

  useEffect(() => {
    onActionsChange({
      onSave: handleSave,
      onReset: handleReset,
      canSave,
      isSaving,
    });
  }, [handleSave, handleReset, canSave, isSaving, onActionsChange]);

  const expandedKeys = useMemo(
    () => new Set(getParentKeys(treeData)),
    [treeData]
  );

  const renderNode = (node: TreeDataNode) => {
    const key = String(node.key);
    const label = t(node.title as string);

    return (
      <Tree.Item id={key} key={key} textValue={label}>
        <Tree.ItemContent
          className="tw:py-0 tw:px-3 tw:border-b tw:border-secondary"
          hasChildItems={Boolean(node.children?.length)}>
          <Box
            align="center"
            className="tw:w-full tw:justify-between tw:py-3 tw:group"
            direction="row">
            <Box align="center" direction="row" gap={2}>
              <DotsGrid
                aria-hidden
                className="tw:size-4 tw:shrink-0 tw:cursor-grab tw:text-fg-quaternary tw:invisible tw:group-hover:visible"
                data-testid="navigation-drag-handle"
              />
              <Typography size="text-sm">{label}</Typography>
            </Box>
            <Toggle
              aria-label={label}
              data-testid={`navigation-switch-${key}`}
              isSelected={!hiddenKeys.includes(key)}
              onChange={(checked) => handleToggle(checked, key)}
            />
          </Box>
        </Tree.ItemContent>
        {node.children?.map((child) => renderNode(child))}
      </Tree.Item>
    );
  };

  return (
    <Box
      className="tw:w-[40%] tw:overflow-hidden tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary"
      data-testid="navigation-editor"
      direction="col">
      <Tree
        aria-label={t('label.navigation')}
        defaultExpandedKeys={expandedKeys}
        selectionMode="none"
        onItemMove={handleItemMove}
        onItemRootDrop={handleItemRootDrop}>
        {treeData.map((node) => renderNode(node))}
      </Tree>
    </Box>
  );
};

export default NavigationEditor;
