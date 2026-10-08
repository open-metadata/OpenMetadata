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
import { AxiosError } from 'axios';
import { isEqual } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigationItem } from '../../../../../../../generated/system/ui/uiCustomization';
import {
  getSidebarHiddenKeys,
  getSidebarNavigationItems,
  getSidebarTreeData,
  moveSidebarNode,
  moveSidebarNodeToRoot,
  SidebarDropPosition,
  SidebarTreeNode,
} from '../../../../../../../utils/CustomizePage/AppModeSidebar.utils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import { useAllAppModules } from '../../../../../../platform/ai-shell/sharedAppModules';
import {
  APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT,
  APP_MODE_SIDEBAR_CUSTOMIZATION_KEY,
  APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT,
} from '../../../../../../platform/ai-shell/Sidebar/appModeSidebar.constants';
import {
  buildMainNavItems,
  MORE_NAV_KEY,
} from '../../../../../../platform/ai-shell/Sidebar/navConfig';
import { CustomizeEditorProps } from './customizeEditor.types';
import { savePersonaDocument } from './customizeEditor.utils';

const AiSidebarEditor = ({
  document,
  onDocumentSaved,
  onActionsChange,
}: CustomizeEditorProps) => {
  const { t } = useTranslation();
  const modules = useAllAppModules();
  const items = useMemo(() => buildMainNavItems(modules), [modules]);

  const storedNavigation = useMemo(
    () =>
      (document.data?.[APP_MODE_SIDEBAR_CUSTOMIZATION_KEY] ?? null) as
        | NavigationItem[]
        | null,
    [document]
  );

  const [treeData, setTreeData] = useState<SidebarTreeNode[]>(() =>
    getSidebarTreeData(
      items,
      storedNavigation,
      APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT
    )
  );
  const [hiddenKeys, setHiddenKeys] = useState<string[]>(() =>
    getSidebarHiddenKeys(items, storedNavigation)
  );
  const [isSaving, setIsSaving] = useState(false);

  const baseline = useMemo(
    () =>
      getSidebarNavigationItems(
        items,
        getSidebarTreeData(
          items,
          storedNavigation,
          APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT
        ),
        getSidebarHiddenKeys(items, storedNavigation)
      ),
    [items, storedNavigation]
  );

  const current = useMemo(
    () => getSidebarNavigationItems(items, treeData, hiddenKeys),
    [items, treeData, hiddenKeys]
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
    setTreeData(
      getSidebarTreeData(items, null, APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT)
    );
    setHiddenKeys(getSidebarHiddenKeys(items, null));
  }, [items]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const saved = await savePersonaDocument(document, (draft) => {
        draft.data = {
          ...draft.data,
          [APP_MODE_SIDEBAR_CUSTOMIZATION_KEY]: current,
        };
      });
      onDocumentSaved(saved);
      window.dispatchEvent(
        new CustomEvent(APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT)
      );
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.app-mode-sidebar'),
        })
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
      dropPosition: SidebarDropPosition;
    }) => {
      setTreeData((prev) =>
        moveSidebarNode(
          prev,
          String(sourceKey),
          String(targetKey),
          dropPosition
        )
      );
    },
    []
  );

  const handleItemRootDrop = useCallback((sourceKey: Key) => {
    setTreeData((prev) => moveSidebarNodeToRoot(prev, String(sourceKey)));
  }, []);

  useEffect(() => {
    onActionsChange({
      onSave: handleSave,
      onReset: handleReset,
      canSave,
      isSaving,
    });
  }, [handleSave, handleReset, canSave, isSaving, onActionsChange]);

  const renderNode = (node: SidebarTreeNode) => {
    const Icon = node.navIcon;

    return (
      <Tree.Item id={node.key} key={node.key} textValue={node.title}>
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
                data-testid="ai-sidebar-drag-handle"
              />
              {Icon && (
                <Icon className="tw:text-fg-tertiary" height={20} width={20} />
              )}
              <Typography size="text-sm">{node.title}</Typography>
            </Box>
            <Toggle
              aria-label={node.title}
              data-testid={`ai-sidebar-switch-${node.key}`}
              isDisabled={node.disablePersonaHide}
              isSelected={!hiddenKeys.includes(node.key)}
              onChange={(checked) => handleToggle(checked, node.key)}
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
      data-testid="ai-sidebar-editor"
      direction="col">
      <Tree
        aria-label={t('label.app-mode-sidebar')}
        defaultExpandedKeys={new Set([MORE_NAV_KEY])}
        selectionMode="none"
        onItemMove={handleItemMove}
        onItemRootDrop={handleItemRootDrop}>
        {treeData.map((node) => renderNode(node))}
      </Tree>
    </Box>
  );
};

export default AiSidebarEditor;
