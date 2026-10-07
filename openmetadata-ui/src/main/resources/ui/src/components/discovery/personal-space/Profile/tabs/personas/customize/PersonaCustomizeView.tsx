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
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01 as Edit } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../../../../common/Loader/Loader';
import RichTextEditor from '../../../../../../common/RichTextEditor/RichTextEditor';
import { EditorContentRef } from '../../../../../../common/RichTextEditor/RichTextEditor.interface';
import RichTextEditorPreviewerV1 from '../../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { ClientErrors } from '../../../../../../../enums/Axios.enum';
import { EntityType } from '../../../../../../../enums/entity.enum';
import { ResourceEntity } from '../../../../../../../enums/permissions.enum';
import { Document } from '../../../../../../../generated/entity/docStore/document';
import { Persona } from '../../../../../../../generated/entity/teams/persona';
import { PageType } from '../../../../../../../generated/system/ui/page';
import { useEntityPermissions } from '../../../../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getDocumentByFQN } from '../../../../../../../rest/DocStoreAPI';
import {
  getPersonaByName,
  updatePersona,
} from '../../../../../../../rest/PersonaAPI';
import { useCustomizeStore } from '../../../../../../../pages/CustomizablePage/CustomizeStore';
import { getEntityName } from '../../../../../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import AiSidebarEditor from './AiSidebarEditor';
import AppLayoutEditor from './AppLayoutEditor';
import {
  CustomizeEditorActions,
  CustomizeEditorProps,
} from './customizeEditor.types';
import EntityCustomizeOverlay from './EntityCustomizeOverlay';
import LandingPageEditor from './LandingPageEditor';
import MarketplaceEditor from './MarketplaceEditor';
import NavigationEditor from './NavigationEditor';
import SubCategoryGrid from './SubCategoryGrid';

interface PersonaCustomizeViewProps {
  personaFqn: string;
  category: string;
  onBack: () => void;
  onHeaderActionsChange: (actions: React.ReactNode) => void;
  onRename: (name: string) => void;
  onNavigateToEntity: (entityCategory: string) => void;
}

/** Categories that have sub-option grids rather than direct editors. */
const SUB_GRID_CATEGORIES = new Set(['governance', 'data-assets']);

/** Categories whose editor renders its own full-screen chrome (no panel footer). */
const FULLSCREEN_CATEGORIES = new Set([
  'homepage',
  PageType.LandingPage as string,
  PageType.DataMarketplace as string,
]);

interface SubGridContentProps {
  baseCategory: string;
  canEditDescription: boolean;
  descEditorRef: React.RefObject<EditorContentRef>;
  isEditingDesc: boolean;
  isSavingDesc: boolean;
  persona: Persona;
  onNavigateToEntity: (entityCategory: string) => void;
  onSaveDescription: () => void;
  onSetEditingDesc: (v: boolean) => void;
}

const SubGridContent: React.FC<SubGridContentProps> = ({
  baseCategory,
  canEditDescription,
  descEditorRef,
  isEditingDesc,
  isSavingDesc,
  persona,
  onNavigateToEntity,
  onSaveDescription,
  onSetEditingDesc,
}) => {
  const { t } = useTranslation();
  const descPreview = persona.description ? (
    <RichTextEditorPreviewerV1 markdown={persona.description} />
  ) : (
    <Typography className="tw:text-tertiary" size="text-sm">
      {t('label.no-description')}
    </Typography>
  );

  return (
    <Box direction="col" gap={5}>
      <Box
        className="tw:overflow-hidden tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary tw:px-5 tw:py-4"
        direction="col"
        gap={2}>
        <Box align="center" direction="row" gap={2}>
          <Typography className="tw:text-primary" weight="medium">
            {t('label.description')}
          </Typography>
          {canEditDescription && !isEditingDesc && (
            <ButtonUtility
              color="tertiary"
              data-testid="edit-sub-grid-desc-btn"
              icon={Edit}
              size="xs"
              tooltip={String(
                t('label.edit-entity', { entity: t('label.description') })
              )}
              tooltipPlacement="right"
              onPress={() => onSetEditingDesc(true)}
            />
          )}
        </Box>
        {isEditingDesc ? (
          <Box direction="col" gap={2}>
            <RichTextEditor
              className="new-form-style"
              initialValue={persona.description ?? ''}
              ref={descEditorRef}
            />
            <Box direction="row" gap={2} justify="end">
              <Button
                color="tertiary"
                isDisabled={isSavingDesc}
                size="sm"
                onPress={() => onSetEditingDesc(false)}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                isLoading={isSavingDesc}
                size="sm"
                onPress={onSaveDescription}>
                {t('label.save')}
              </Button>
            </Box>
          </Box>
        ) : (
          descPreview
        )}
      </Box>
      <SubCategoryGrid
        baseCategory={baseCategory}
        onSelectEntity={(entityKey) =>
          onNavigateToEntity(`${baseCategory}/${entityKey}`)
        }
      />
    </Box>
  );
};

const EDITORS: Record<string, React.ComponentType<CustomizeEditorProps>> = {
  navigation: NavigationEditor,
  'app-layout': AppLayoutEditor,
  askCollateSidebar: AiSidebarEditor,
  [PageType.DataMarketplace]: MarketplaceEditor,
  [PageType.LandingPage]: LandingPageEditor,
  homepage: LandingPageEditor,
};

/* eslint-disable sonarjs/cyclomatic-complexity */
const PersonaCustomizeView = ({
  personaFqn,
  category,
  onBack,
  onHeaderActionsChange,
  onRename,
  onNavigateToEntity,
}: PersonaCustomizeViewProps) => {
  const { t } = useTranslation();
  const { setDocument } = useCustomizeStore();
  const [persona, setPersona] = useState<Persona>();
  const [document, setDocState] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actions, setActions] = useState<CustomizeEditorActions>();

  // Inline description edit (shown in sub-grid views)
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const descEditorRef = useRef<EditorContentRef>(null);

  const { canEditDescription } = useEntityPermissions(
    ResourceEntity.PERSONA,
    persona?.fullyQualifiedName ?? persona?.name ?? ''
  );

  // Split `governance/Domain` → baseCategory='governance', entityType='Domain'
  const [baseCategory, entityType] = useMemo(() => {
    const parts = category.split('/', 2);

    return parts.length === 2 ? [parts[0], parts[1]] : [parts[0], undefined];
  }, [category]);

  const Editor = entityType ? undefined : EDITORS[baseCategory];
  const isSubGrid = !entityType && SUB_GRID_CATEGORIES.has(baseCategory);

  const loadDocument = useCallback(
    async (
      personaName: string,
      fqn: string,
      pageLayoutFQN: string,
      setActive: () => boolean
    ) => {
      try {
        const doc = await getDocumentByFQN(pageLayoutFQN);
        if (setActive()) {
          setDocState(doc);
          setDocument(doc);
        }
      } catch (error) {
        if (!setActive()) {
          return;
        }
        if ((error as AxiosError).response?.status === ClientErrors.NOT_FOUND) {
          const emptyDoc: Document = {
            name: `${personaName}-${fqn}`,
            fullyQualifiedName: pageLayoutFQN,
            entityType: EntityType.PAGE,
            data: { pages: [], navigation: null },
          } as Document;
          setDocState(emptyDoc);
          setDocument(emptyDoc);
        } else {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [setDocument]
  );

  useEffect(() => {
    let active = true;
    const isActive = () => active;
    const pageLayoutFQN = `${EntityType.PERSONA}.${personaFqn}`;

    const init = async () => {
      setIsLoading(true);
      try {
        const personaData = await getPersonaByName(personaFqn);
        if (!active) {
          return;
        }
        setPersona(personaData);
        onRename(getEntityName(personaData));
        await loadDocument(
          personaData.name,
          personaFqn,
          pageLayoutFQN,
          isActive
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaFqn]);

  const handleSaveDescription = useCallback(async () => {
    if (!persona) {
      return;
    }
    const description = descEditorRef.current?.getEditorContent() ?? '';
    const updated = { ...persona, description };
    setIsSavingDesc(true);
    try {
      const response = await updatePersona(
        persona.id,
        compare(persona, updated)
      );
      setPersona(response);
      setIsEditingDesc(false);
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.persona') })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingDesc(false);
    }
  }, [persona, t]);

  const handleDocumentSaved = useCallback(
    (saved: Document) => {
      setDocState(saved);
      setDocument(saved);
    },
    [setDocument]
  );

  const handleActionsChange = useCallback(
    (next: CustomizeEditorActions) => setActions(next),
    []
  );

  useEffect(() => {
    onHeaderActionsChange(actions?.headerAction);
  }, [actions?.headerAction, onHeaderActionsChange]);

  const content = useMemo(() => {
    if (!persona || !document) {
      return <ErrorPlaceHolder />;
    }

    if (isSubGrid) {
      return (
        <SubGridContent
          baseCategory={baseCategory}
          canEditDescription={canEditDescription}
          descEditorRef={descEditorRef}
          isEditingDesc={isEditingDesc}
          isSavingDesc={isSavingDesc}
          persona={persona}
          onNavigateToEntity={onNavigateToEntity}
          onSaveDescription={handleSaveDescription}
          onSetEditingDesc={setIsEditingDesc}
        />
      );
    }

    // Known panel editor
    if (Editor) {
      return (
        <Editor
          document={document}
          persona={persona}
          onActionsChange={handleActionsChange}
          onBack={onBack}
          onDocumentSaved={handleDocumentSaved}
        />
      );
    }

    return <ErrorPlaceHolder />;
  }, [
    isSubGrid,
    Editor,
    baseCategory,
    persona,
    document,
    canEditDescription,
    isEditingDesc,
    isSavingDesc,
    handleSaveDescription,
    handleActionsChange,
    handleDocumentSaved,
    descEditorRef,
    onNavigateToEntity,
    onBack,
  ]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      {/* Entity-level full-screen overlay (position:fixed, covers the modal) */}
      {entityType && persona && document && (
        <EntityCustomizeOverlay
          document={document}
          entityType={entityType}

          persona={persona}
          onClose={onBack}
          onDocumentSaved={handleDocumentSaved}
        />
      )}

      <Box
        className="tw:flex-1 tw:min-h-0"
        data-testid="persona-customize-view"
        direction="col">
        <div className="tw:flex-1 tw:overflow-y-auto tw:px-8 tw:pb-8">
          {content}
        </div>
        {/* Footer only shown for panel editors, not sub-grids, entity overlays, or fullscreen editors */}
        {!isSubGrid && !entityType && !FULLSCREEN_CATEGORIES.has(baseCategory) && (
          <Box
            className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-primary tw:px-8 tw:py-4"
            data-testid="persona-customize-footer"
            direction="row"
            gap={3}
            justify="end">
            <Button
              color="tertiary"
              data-testid="customize-cancel"
              onPress={onBack}>
              {t('label.cancel')}
            </Button>
            <Button
              color="secondary"
              data-testid="customize-reset"
              isDisabled={!actions || actions.isSaving}
              onPress={() => actions?.onReset()}>
              {t('label.reset')}
            </Button>
            <Button
              color="primary"
              data-testid="customize-save"
              isDisabled={!actions?.canSave}
              isLoading={actions?.isSaving}
              onPress={() => actions?.onSave()}>
              {t('label.save')}
            </Button>
          </Box>
        )}
      </Box>
    </>
  );
};
/* eslint-enable sonarjs/cyclomatic-complexity */

export default PersonaCustomizeView;
