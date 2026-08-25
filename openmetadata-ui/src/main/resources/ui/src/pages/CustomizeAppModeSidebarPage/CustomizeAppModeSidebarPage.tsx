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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEqual } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
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
  isValidSidebarTree,
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

  // Nested drag: reorder at the top level, or move an item in/out of the
  // "More" node's children. Only the "More" node may hold children (enforced
  // by `allowDrop` + a post-move `isValidSidebarTree` guard that reverts an
  // illegal drop).
  const onDrop: TreeProps['onDrop'] = (info) => {
    const dragKey = info.dragNode.key;
    const dropKey = info.node.key;
    const dropPos = info.node.pos.split('-');
    const relativeDropPosition =
      info.dropPosition - Number(dropPos[dropPos.length - 1]);

    const loop = (
      data: SidebarTreeNode[],
      key: Key,
      callback: (
        node: SidebarTreeNode,
        index: number,
        arr: SidebarTreeNode[]
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

    setTreeData((prev) => {
      // Dropping a node onto itself is a no-op. Without this guard the node is
      // spliced out and then never re-found by the re-insertion loop.
      if (dragKey === dropKey) {
        return prev;
      }

      const next = cloneDeep(prev);

      let dragNode: SidebarTreeNode | undefined;
      loop(next, dragKey, (node, index, arr) => {
        arr.splice(index, 1);
        dragNode = node;
      });
      if (!dragNode) {
        return prev;
      }

      if (!info.dropToGap) {
        loop(next, dropKey, (node) => {
          node.children = node.children ?? [];
          node.children.unshift(dragNode!);
        });
      } else {
        loop(next, dropKey, (_node, index, arr) => {
          const insertIndex = relativeDropPosition <= 0 ? index : index + 1;
          arr.splice(insertIndex, 0, dragNode!);
        });
      }

      return isValidSidebarTree(next) ? next : prev;
    });
  };

  const titleRenderer = (node: TreeDataNode) => {
    const { navIcon: Icon } = node as SidebarTreeNode;

    return (
      <div className="space-between">
        <span className="d-flex items-center gap-2">
          {Icon && (
            <Icon className="tw:text-fg-tertiary" height={20} width={20} />
          )}
          {node.title as string}
        </span>
        <Switch
          checked={!hiddenKeys.includes(node.key as string)}
          data-testid={`ask-sidebar-switch-${node.key}`}
          onChange={(checked) =>
            handleVisibilityToggle(checked, node.key as string)
          }
        />
      </div>
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
        <Row gutter={[0, 20]}>
          <Col span={24}>
            <Card
              className="customize-page-header"
              data-testid="customize-app-mode-sidebar-header">
              <div className="d-flex items-center justify-between">
                <div>
                  <Typography.Title
                    className="m-0"
                    data-testid="customize-page-title"
                    level={5}>
                    {t('label.customize-entity', {
                      entity: t('label.app-mode-sidebar'),
                    })}
                  </Typography.Title>
                  <Typography.Paragraph className="m-0">
                    {t('message.customize-app-mode-sidebar-description')}
                  </Typography.Paragraph>
                </div>
                <Space>
                  <Button
                    data-testid="reset-button"
                    disabled={isSaving}
                    icon={<RedoOutlined />}
                    onClick={handleReset}>
                    {t('label.reset')}
                  </Button>
                  <Button
                    data-testid="save-button"
                    disabled={disableSave}
                    icon={<SaveOutlined />}
                    loading={isSaving}
                    type="primary"
                    onClick={handleSave}>
                    {t('label.save')}
                  </Button>
                  <Button
                    data-testid="cancel-button"
                    disabled={isSaving}
                    icon={<CloseOutlined />}
                    onClick={handleCancel}
                  />
                </Space>
              </div>
            </Card>
          </Col>

          <Col span={24}>
            <Card
              className="custom-navigation-tree-container"
              title={t('label.app-mode-sidebar')}>
              <Tree
                blockNode
                defaultExpandAll
                // dropPosition 0 = drop INTO a node (nest). Only the "More"
                // node accepts children; gap drops (reorder / move out) are
                // always allowed.
                allowDrop={({ dropNode, dropPosition }) =>
                  dropPosition !== 0 || dropNode.key === MORE_NAV_KEY
                }
                draggable={{ icon: <HolderOutlined /> }}
                itemHeight={48}
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

export default CustomizeAppModeSidebarPage;
