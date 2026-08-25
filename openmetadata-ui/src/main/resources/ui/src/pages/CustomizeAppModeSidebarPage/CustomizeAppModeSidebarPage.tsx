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

import { CloseOutlined, RedoOutlined, SaveOutlined } from '@ant-design/icons';
import type { Key } from '@openmetadata/ui-core-components';
import {
  Box,
  Button,
  Card,
  Toggle,
  Tree,
  Typography,
} from '@openmetadata/ui-core-components';
import { DotsGrid } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEqual } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { NavigationBlocker } from '../../components/common/NavigationBlocker/NavigationBlocker';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { useAllAppModules } from '../../components/platform/ai-shell/sharedAppModules';
import {
  APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT,
  APP_MODE_SIDEBAR_CUSTOMIZATION_KEY,
  APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT,
} from '../../components/platform/ai-shell/Sidebar/appModeSidebar.constants';
import {
  buildMainNavItems,
  MORE_NAV_KEY,
} from '../../components/platform/ai-shell/Sidebar/navConfig';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { ClientErrors } from '../../enums/Axios.enum';
import { EntityType } from '../../enums/entity.enum';
import { Document } from '../../generated/entity/docStore/document';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import { useFqn } from '../../hooks/useFqn';
import {
  createDocument,
  getDocumentByFQN,
  updateDocument,
} from '../../rest/DocStoreAPI';
import { getPersonaByName } from '../../rest/PersonaAPI';
import { getPersonaDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import '../SettingsNavigationPage/settings-navigation-page.less';
import {
  getSidebarHiddenKeys,
  getSidebarNavigationItems,
  getSidebarTreeData,
  moveSidebarNode,
  moveSidebarNodeToRoot,
  SidebarDropPosition,
  SidebarTreeNode,
} from './CustomizeAppModeSidebarPage.utils';

/**
 * Persona-level customization editor for the AI (app-mode) sidebar: reorder
 * the top-level nav items, toggle their visibility, and move items in/out of
 * the "More" overflow group. Persists to the persona doc-store document under
 * `data.askCollateSidebar`. Classic mode uses the sibling `/navigation` page.
 */
const CustomizeAppModeSidebarPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn: personaFqn } = useFqn();
  const modules = useAllAppModules();
  const items = useMemo(() => buildMainNavItems(modules), [modules]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPersona, setHasPersona] = useState(false);
  const [docStoreDocument, setDocStoreDocument] = useState<Document | null>(
    null
  );
  const [treeData, setTreeData] = useState<SidebarTreeNode[]>([]);
  const [hiddenKeys, setHiddenKeys] = useState<string[]>([]);
  const [redirectAfterSave, setRedirectAfterSave] = useState(false);

  const storedNavigation = useMemo(
    () =>
      (docStoreDocument?.data?.[APP_MODE_SIDEBAR_CUSTOMIZATION_KEY] ?? null) as
        | NavigationItem[]
        | null,
    [docStoreDocument]
  );

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

  const disableSave = useMemo(
    () =>
      isEqual(baseline, getSidebarNavigationItems(items, treeData, hiddenKeys)),
    [items, baseline, treeData, hiddenKeys]
  );

  const initialize = useCallback(async () => {
    setIsLoading(true);
    const documentFqn = `${EntityType.PERSONA}${FQN_SEPARATOR_CHAR}${personaFqn}`;
    try {
      const personaDetails = await getPersonaByName(personaFqn);
      if (!personaDetails) {
        setHasPersona(false);

        return;
      }
      setHasPersona(true);

      let doc: Document | null = null;
      try {
        doc = await getDocumentByFQN(documentFqn);
      } catch (error) {
        if ((error as AxiosError).response?.status !== ClientErrors.NOT_FOUND) {
          throw error;
        }
        doc = {
          name: `${personaDetails.name}-${personaFqn}`,
          fullyQualifiedName: documentFqn,
          entityType: EntityType.PAGE,
          data: {},
        } as Document;
      }
      setDocStoreDocument(doc);

      const stored = (doc.data?.[APP_MODE_SIDEBAR_CUSTOMIZATION_KEY] ??
        null) as NavigationItem[] | null;
      setTreeData(
        getSidebarTreeData(items, stored, APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT)
      );
      setHiddenKeys(getSidebarHiddenKeys(items, stored));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [personaFqn, items]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Redirect to the persona page once a save has settled. Gated on
  // `disableSave` (true only after the saved doc becomes the new baseline),
  // which means the NavigationBlocker is disabled — its history guard is torn
  // down in that same commit, so we defer a tick before navigating to avoid
  // racing the unsaved-changes modal.
  useEffect(() => {
    if (!redirectAfterSave || !disableSave) {
      return;
    }

    const timer = setTimeout(
      () => navigate(getPersonaDetailsPath(personaFqn)),
      100
    );

    return () => clearTimeout(timer);
  }, [redirectAfterSave, disableSave, navigate, personaFqn]);

  const handleSave = useCallback(async () => {
    if (!docStoreDocument) {
      return;
    }
    setIsSaving(true);
    try {
      const newDoc = cloneDeep(docStoreDocument);
      newDoc.data = {
        ...newDoc.data,
        [APP_MODE_SIDEBAR_CUSTOMIZATION_KEY]: getSidebarNavigationItems(
          items,
          treeData,
          hiddenKeys
        ),
      };

      const response = docStoreDocument.id
        ? await updateDocument(
            docStoreDocument.id,
            compare(docStoreDocument, newDoc)
          )
        : await createDocument({
            ...newDoc,
            domains: newDoc.domains
              ?.map((domain) => domain.fullyQualifiedName)
              .filter(Boolean) as string[],
          });
      setDocStoreDocument(response);
      window.dispatchEvent(
        new CustomEvent(APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT)
      );

      showSuccessToast(
        t('server.page-layout-operation-success', {
          operation: docStoreDocument.id
            ? t('label.updated-lowercase')
            : t('label.created-lowercase'),
        })
      );

      setRedirectAfterSave(true);
    } catch {
      showErrorToast(
        t('server.page-layout-operation-error', {
          operation: docStoreDocument.id
            ? t('label.updating-lowercase')
            : t('label.creating-lowercase'),
        })
      );
    } finally {
      setIsSaving(false);
    }
  }, [docStoreDocument, items, treeData, hiddenKeys, t]);

  const handleReset = useCallback(() => {
    setTreeData(
      getSidebarTreeData(items, null, APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT)
    );
    setHiddenKeys(getSidebarHiddenKeys(items, null));
  }, [items]);

  const handleCancel = useCallback(() => {
    navigate(getPersonaDetailsPath(personaFqn));
  }, [navigate, personaFqn]);

  const handleVisibilityToggle = useCallback(
    (checked: boolean, key: string) => {
      setHiddenKeys((prev) =>
        checked ? prev.filter((hiddenKey) => hiddenKey !== key) : [...prev, key]
      );
    },
    []
  );

  // Reorder at the top level, or move an item into/out of the "More" node's
  // children. `moveSidebarNode` / `moveSidebarNodeToRoot` revert any drop that
  // would break the structural invariant (only "More" may hold children).
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

  const renderTreeItem = (node: SidebarTreeNode) => {
    const Icon = node.navIcon;

    return (
      <Tree.Item id={node.key} key={node.key} textValue={node.title}>
        <Tree.ItemContent hasChildItems={Boolean(node.children?.length)}>
          <Box
            align="center"
            className="tw:w-full tw:justify-between"
            direction="row">
            <Box align="center" direction="row" gap={2}>
              <DotsGrid
                aria-hidden
                className="tw:size-4 tw:shrink-0 tw:cursor-grab tw:text-fg-quaternary"
                data-testid="ask-sidebar-drag-handle"
              />
              {Icon && (
                <Icon className="tw:text-fg-tertiary" height={20} width={20} />
              )}
              <Typography size="text-sm">{node.title}</Typography>
            </Box>
            <Toggle
              aria-label={node.title}
              data-testid={`ask-sidebar-switch-${node.key}`}
              isSelected={!hiddenKeys.includes(node.key)}
              onChange={(checked) => handleVisibilityToggle(checked, node.key)}
            />
          </Box>
        </Tree.ItemContent>
        {node.children?.map((child) => renderTreeItem(child))}
      </Tree.Item>
    );
  };

  if (isLoading) {
    return <Loader />;
  }

  if (!hasPersona) {
    return <ErrorPlaceHolder />;
  }

  return (
    <NavigationBlocker enabled={!disableSave} onConfirm={handleSave}>
      <PageLayoutV1
        pageTitle={t('label.customize-entity', {
          entity: t('label.app-mode-sidebar'),
        })}>
        <Box className="tw:flex tw:flex-col tw:gap-5">
          <Card
            className="customize-page-header"
            data-testid="customize-app-mode-sidebar-header">
            <Card.Content>
              <Box
                align="center"
                className="tw:w-full tw:justify-between"
                direction="row">
                <Box direction="col">
                  <Typography
                    as="h5"
                    data-testid="customize-page-title"
                    size="text-lg"
                    weight="semibold">
                    {t('label.customize-entity', {
                      entity: t('label.app-mode-sidebar'),
                    })}
                  </Typography>
                  <Typography className="tw:text-secondary" size="text-sm">
                    {t('message.customize-app-mode-sidebar-description')}
                  </Typography>
                </Box>
                <Box align="center" direction="row" gap={2}>
                  <Button
                    color="secondary"
                    data-testid="reset-button"
                    iconLeading={<RedoOutlined />}
                    isDisabled={isSaving}
                    onPress={handleReset}>
                    {t('label.reset')}
                  </Button>
                  <Button
                    color="primary"
                    data-testid="save-button"
                    iconLeading={<SaveOutlined />}
                    isDisabled={disableSave}
                    isLoading={isSaving}
                    onPress={handleSave}>
                    {t('label.save')}
                  </Button>
                  <Button
                    aria-label={t('label.cancel')}
                    color="secondary"
                    data-testid="cancel-button"
                    iconLeading={<CloseOutlined />}
                    isDisabled={isSaving}
                    onPress={handleCancel}
                  />
                </Box>
              </Box>
            </Card.Content>
          </Card>

          <Card className="custom-navigation-tree-container">
            <Card.Header title={t('label.app-mode-sidebar')} />
            <Card.Content>
              <Tree
                aria-label={t('label.app-mode-sidebar')}
                defaultExpandedKeys={new Set([MORE_NAV_KEY])}
                selectionMode="none"
                onItemMove={handleItemMove}
                onItemRootDrop={handleItemRootDrop}>
                {treeData.map((node) => renderTreeItem(node))}
              </Tree>
            </Card.Content>
          </Card>
        </Box>
      </PageLayoutV1>
    </NavigationBlocker>
  );
};

export default CustomizeAppModeSidebarPage;
