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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { Button } from '@openmetadata/ui-core-components';
import { Persona as PersonaIcon } from '@openmetadata/ui-core-components/icons';
import type { Key } from 'react';
import React, {
  FC,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { usePersonalSpaceStore } from '../../../../../../hooks/usePersonalSpaceStore';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import {
  getCustomizePageCategories,
  getCustomizePageOptions,
} from '../../../../../../utils/Persona/PersonaUtils';
import withSuspenseFallback from '../../../../../AppRouter/withSuspenseFallback';
import { UnsavedChangesModal } from '../../../../../Modals/UnsavedChangesModal/UnsavedChangesModal.component';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import type { CustomizeEditorActions } from './customize/customizeEditor.types';
import PersonaAddForm from './PersonaAddForm';
import { PERSONA_CATEGORY_ICONS } from './personaCategoryIcons';
import PersonaDetail from './PersonaDetail';
import type { PersonaDetailTab, PersonaView } from './Personas.types';
import {
  hashSubPathToView,
  isFullscreenPersonaCategory,
  SUB_GRID_CATEGORIES,
  viewToSubPath,
} from './Personas.utils';
import PersonasLanding from './PersonasLanding';

const PersonaCustomizeView = withSuspenseFallback(
  lazy(() => import('./customize/PersonaCustomizeView'))
);

const HASH_TAB = 'personas';

interface PersonasPanelProps {
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
}

/* eslint-disable sonarjs/cyclomatic-complexity -- one switch over the persona sub-views */
const PersonasPanel: FC<PersonasPanelProps> = ({ onHeaderChange }) => {
  const { t } = useTranslation();
  const { state: hashState, setHash, updateParams } = useSettingsHash();
  const closeSilent = usePersonalSpaceStore((state) => state.closeSilent);
  const setExitGuard = usePersonalSpaceStore((state) => state.setExitGuard);

  const view = useMemo<PersonaView>(
    () => hashSubPathToView(hashState.subPath),
    [hashState.subPath]
  );

  const activeTab =
    (hashState.params.tab as PersonaDetailTab) || 'customize-ui';

  const onNavigate = useCallback(
    (nextView: PersonaView) => {
      setHash(HASH_TAB, viewToSubPath(nextView));
    },
    [setHash]
  );

  const [editorActions, setEditorActions] = useState<CustomizeEditorActions>();
  const [pendingExit, setPendingExit] = useState<() => void>();
  const [isSavingBeforeExit, setIsSavingBeforeExit] = useState(false);
  const isEditorDirty =
    view.type === 'customize' && Boolean(editorActions?.canSave);

  // Every way out of a dirty in-modal editor (breadcrumbs, Cancel, the modal's
  // close button) goes through here so unsaved changes are never dropped silently.
  const guardExit = useCallback(
    (exit: () => void) => {
      if (!isEditorDirty) {
        return false;
      }
      setPendingExit(() => exit);

      return true;
    },
    [isEditorDirty]
  );

  const navigateGuarded = useCallback(
    (nextView: PersonaView) => {
      const exit = () => onNavigate(nextView);
      if (!guardExit(exit)) {
        exit();
      }
    },
    [guardExit, onNavigate]
  );

  useEffect(() => {
    setExitGuard(isEditorDirty ? guardExit : null);

    return () => setExitGuard(null);
  }, [isEditorDirty, guardExit, setExitGuard]);

  const handleDiscardExit = useCallback(() => {
    const exit = pendingExit;
    setPendingExit(undefined);
    exit?.();
  }, [pendingExit]);

  const handleSaveExit = useCallback(async () => {
    setIsSavingBeforeExit(true);
    try {
      await editorActions?.onSave();
      handleDiscardExit();
    } finally {
      setIsSavingBeforeExit(false);
    }
  }, [editorActions, handleDiscardExit]);

  const onTabChange = useCallback(
    (tab: PersonaDetailTab) => updateParams({ tab }),
    [updateParams]
  );

  // Name + action nodes injected by the detail / customize sub-views.
  const [resolvedName, setResolvedName] = useState('');
  const [detailActions, setDetailActions] = useState<React.ReactNode>();
  const [detailTitleInput, setDetailTitleInput] = useState<React.ReactNode>();
  const [detailTitleSuffix, setDetailTitleSuffix] = useState<React.ReactNode>();
  // Header actions injected by the customize editor (e.g. Marketplace Add-Widget).
  const [customizeActions, setCustomizeActions] = useState<React.ReactNode>();

  const viewFqn =
    view.type === 'detail' || view.type === 'customize' ? view.fqn : undefined;

  const isFullscreenCustomize =
    view.type === 'customize' && isFullscreenPersonaCategory(view.category);

  // Governance / Data Assets keep the persona detail page (description, tabs,
  // header actions) and only swap the Customize UI tiles, as in legacy.
  const subCategory =
    view.type === 'customize' && SUB_GRID_CATEGORIES.has(view.category)
      ? view.category
      : undefined;
  const isDetailLike = view.type === 'detail' || Boolean(subCategory);
  const resetKey = isDetailLike ? 'detail' : view.type;

  // Close the modal silently when entering a fullscreen customize view so the
  // PersonaFullscreenPortal (mounted outside the modal tree) can take over.
  // This is a useEffect — NOT a render-time call — to avoid triggering a
  // Zustand update during render which can cause the modal to close again
  // right after it re-opens when the user navigates back.
  useEffect(() => {
    if (isFullscreenCustomize) {
      closeSilent();
    }
  }, [isFullscreenCustomize, closeSilent]);

  // Reset injected sub-view state when the view changes.
  useEffect(() => {
    setDetailActions(undefined);
    setDetailTitleInput(undefined);
    setDetailTitleSuffix(undefined);
    setCustomizeActions(undefined);
    setResolvedName('');
  }, [resetKey, viewFqn]);

  /** For `governance/Domain` style categories: [baseCategory, entityType]. */
  const [categoryBase, categoryEntity] = useMemo(() => {
    if (view.type !== 'customize') {
      return [undefined, undefined];
    }
    const parts = view.category.split('/', 2);

    return parts.length === 2 ? [parts[0], parts[1]] : [parts[0], undefined];
  }, [view]);

  const categoryMeta = useMemo(() => {
    if (view.type !== 'customize') {
      return undefined;
    }
    // Entity-level: look up in the sub-options of the base category.
    if (categoryEntity && categoryBase) {
      return getCustomizePageOptions(categoryBase).find(
        (c) => c.key === categoryEntity
      );
    }

    return getCustomizePageCategories().find((c) => c.key === view.category);
  }, [view, categoryBase, categoryEntity]);

  const parentCategoryMeta = useMemo(() => {
    if (!categoryEntity || !categoryBase) {
      return undefined;
    }

    return getCustomizePageCategories().find((c) => c.key === categoryBase);
  }, [categoryBase, categoryEntity]);

  const customizeIcon = useMemo(
    () =>
      (view.type === 'customize'
        ? PERSONA_CATEGORY_ICONS[view.category] ??
          categoryMeta?.icon ??
          PersonaIcon
        : PersonaIcon) as FC<{ className?: string }>,
    [view, categoryMeta]
  );

  // Push header override to ProfilePage per view.
  useEffect(() => {
    if (!onHeaderChange) {
      return;
    }

    const settingsItem: BreadcrumbItemType = {
      id: 'settings',
      label: t('label.setting-plural'),
    };
    const personasItem: BreadcrumbItemType = {
      id: HASH_TAB,
      label: t('label.persona-plural'),
    };
    const personasDesc = t('message.page-sub-header-for-persona');
    const addPersonaLabel = t('label.add-entity', {
      entity: t('label.persona'),
    });

    const onBreadcrumbAction = (id: Key) => {
      if (id === HASH_TAB) {
        navigateGuarded({ type: 'landing' });
      } else if (id === 'detail' && viewFqn) {
        navigateGuarded({ type: 'detail', fqn: viewFqn, name: resolvedName });
      }
    };

    if (view.type === 'landing') {
      onHeaderChange({
        breadcrumbs: [
          settingsItem,
          { id: 'current', label: t('label.persona-plural') },
        ],
        title: t('label.persona-plural'),
        description: personasDesc,
        icon: PersonaIcon as FC<{ className?: string }>,
        actions: (
          <Button
            color="primary"
            data-testid="add-persona-button"
            size="sm"
            onPress={() => onNavigate({ type: 'add' })}>
            {addPersonaLabel}
          </Button>
        ),
        onBreadcrumbAction,
      });

      return;
    }

    if (view.type === 'add') {
      onHeaderChange({
        breadcrumbs: [
          settingsItem,
          personasItem,
          { id: 'current', label: addPersonaLabel },
        ],
        title: addPersonaLabel,
        description: personasDesc,
        icon: PersonaIcon as FC<{ className?: string }>,
        onBreadcrumbAction,
      });

      return;
    }

    if (isDetailLike) {
      const name = resolvedName || view.name;
      onHeaderChange({
        breadcrumbs: [
          settingsItem,
          personasItem,
          ...(subCategory
            ? [
                { id: 'detail', label: name },
                { id: 'current', label: categoryMeta?.label ?? subCategory },
              ]
            : [{ id: 'current', label: name }]),
        ],
        title: name,
        description: personasDesc,
        icon: PersonaIcon as FC<{ className?: string }>,
        actions: detailActions,
        titleInput: detailTitleInput,
        titleSuffix: detailTitleSuffix,
        onBreadcrumbAction,
      });

      return;
    }

    // customize (may be a base category or an entity-level e.g. governance/Domain)
    const name = resolvedName || view.name;
    const categoryLabel = categoryMeta?.label ?? view.category;
    const parentLabel = parentCategoryMeta?.label;

    const breadcrumbs: BreadcrumbItemType[] = [
      settingsItem,
      personasItem,
      { id: 'detail', label: name },
      ...(parentLabel
        ? [
            { id: 'parent-category', label: parentLabel },
            { id: 'current', label: categoryLabel },
          ]
        : [{ id: 'current', label: categoryLabel }]),
    ];

    onHeaderChange({
      breadcrumbs,
      title: categoryLabel,
      description: categoryMeta?.description ?? '',
      icon: customizeIcon,
      actions: customizeActions,
      onBreadcrumbAction,
    });
  }, [
    onHeaderChange,
    t,
    view,
    viewFqn,
    resolvedName,
    detailActions,
    detailTitleInput,
    detailTitleSuffix,
    customizeActions,
    categoryMeta,
    parentCategoryMeta,
    customizeIcon,
    onNavigate,
    navigateGuarded,
    subCategory,
    isDetailLike,
  ]);

  if (view.type === 'add') {
    return (
      <PersonaAddForm
        onCancel={() => onNavigate({ type: 'landing' })}
        onCreated={() => onNavigate({ type: 'landing' })}
      />
    );
  }

  if (isDetailLike && view.type !== 'landing') {
    return (
      <div className="tw:flex-1 tw:overflow-y-auto tw:pt-1">
        <PersonaDetail
          activeTab={activeTab}
          fqn={view.fqn}
          subCategory={subCategory}
          onDeleted={() => onNavigate({ type: 'landing' })}
          onRename={setResolvedName}
          onSelectCategory={(category) =>
            onNavigate({
              type: 'customize',
              fqn: view.fqn,
              name: resolvedName || view.name,
              category,
            })
          }
          onSetHeaderActions={setDetailActions}
          onSetHeaderTitleInput={setDetailTitleInput}
          onSetHeaderTitleSuffix={setDetailTitleSuffix}
          onTabChange={onTabChange}
        />
      </div>
    );
  }

  if (view.type === 'customize') {
    const fqn = view.fqn;
    const name = resolvedName || view.name;
    const cat = view.category;

    if (isFullscreenCustomize) {
      // PersonaFullscreenPortal (outside the modal tree) handles rendering.
      return null;
    }

    return (
      <>
        <PersonaCustomizeView
          category={cat}
          personaFqn={fqn}
          onBack={() => navigateGuarded({ type: 'detail', fqn, name })}
          onEditorActionsChange={setEditorActions}
          onHeaderActionsChange={setCustomizeActions}
          onRename={setResolvedName}
        />
        <UnsavedChangesModal
          loading={isSavingBeforeExit}
          open={Boolean(pendingExit)}
          onCancel={() => setPendingExit(undefined)}
          onDiscard={handleDiscardExit}
          onSave={() => void handleSaveExit()}
        />
      </>
    );
  }

  return (
    <div className="tw:flex-1 tw:overflow-y-auto tw:pt-1">
      <PersonasLanding onNavigate={onNavigate} />
    </div>
  );
};
/* eslint-enable sonarjs/cyclomatic-complexity */

export default PersonasPanel;
