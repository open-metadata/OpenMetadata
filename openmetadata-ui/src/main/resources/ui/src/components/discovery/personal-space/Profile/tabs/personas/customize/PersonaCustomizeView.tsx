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
    EmptyPlaceholder
} from '@openmetadata/ui-core-components';
import { useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientErrors } from '../../../../../../../enums/Axios.enum';
import { EntityType } from '../../../../../../../enums/entity.enum';
import { Document } from '../../../../../../../generated/entity/docStore/document';
import { Persona } from '../../../../../../../generated/entity/teams/persona';
import { PageType } from '../../../../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../../../../pages/CustomizablePage/CustomizeStore';
import { getDocumentByFQN } from '../../../../../../../rest/DocStoreAPI';
import { getPersonaByName } from '../../../../../../../rest/PersonaAPI';
import { docStoreQueryKey } from '../../../../../../../rest/queries/docStoreQuery';
import { getEntityName } from '../../../../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../../../../utils/ToastUtils';
import Loader from '../../../../../../common/Loader/Loader';
import { isFullscreenPersonaCategory } from '../Personas.utils';
import AiSidebarEditor from './AiSidebarEditor';
import AppLayoutEditor from './AppLayoutEditor';
import {
    CustomizeEditorActions,
    CustomizeEditorProps
} from './customizeEditor.types';
import EntityCustomizeOverlay from './EntityCustomizeOverlay';
import LandingPageEditor from './LandingPageEditor';
import MarketplaceEditor from './MarketplaceEditor';
import NavigationEditor from './NavigationEditor';

interface PersonaCustomizeViewProps {
  personaFqn: string;
  category: string;
  onBack: () => void;
  onHeaderActionsChange?: (actions: React.ReactNode) => void;
  /** Reports the editor's actions (incl. dirty state); `undefined` on unmount. */
  onEditorActionsChange?: (actions?: CustomizeEditorActions) => void;
  onRename: (name: string) => void;
}

const EDITORS: Record<string, React.ComponentType<CustomizeEditorProps>> = {
  navigation: NavigationEditor,
  'app-layout': AppLayoutEditor,
  askCollateSidebar: AiSidebarEditor,
  [PageType.DataMarketplace]: MarketplaceEditor,
  [PageType.LandingPage]: LandingPageEditor,
  homepage: LandingPageEditor,
};

const PersonaCustomizeView = ({
  personaFqn,
  category,
  onBack,
  onHeaderActionsChange,
  onEditorActionsChange,
  onRename,
}: PersonaCustomizeViewProps) => {
  const { t } = useTranslation();
  const { setDocument } = useCustomizeStore();
  const queryClient = useQueryClient();
  const [persona, setPersona] = useState<Persona>();
  const [personaDocument, setPersonaDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actions, setActions] = useState<CustomizeEditorActions>();

  // Split `governance/Domain` → baseCategory='governance', entityType='Domain'
  const [baseCategory, entityType] = useMemo(() => {
    const parts = category.split('/', 2);

    return parts.length === 2 ? [parts[0], parts[1]] : [parts[0], undefined];
  }, [category]);

  const Editor = entityType ? undefined : EDITORS[baseCategory];

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
          setPersonaDocument(doc);
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
          setPersonaDocument(emptyDoc);
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

    void init();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaFqn]);

  // Runtime consumers (MyDataPage, useCustomPages, usePersonaDocument) read the
  // doc-store query cache, so refresh it or they keep the pre-save layout.
  const handleDocumentSaved = useCallback(
    (saved: Document) => {
      setPersonaDocument(saved);
      setDocument(saved);
      queryClient.setQueryData(
        docStoreQueryKey(saved.fullyQualifiedName ?? ''),
        saved
      );
    },
    [queryClient, setDocument]
  );

  const handleActionsChange = useCallback(
    (next: CustomizeEditorActions) => setActions(next),
    []
  );

  useEffect(() => {
    onHeaderActionsChange?.(actions?.headerAction);
  }, [actions?.headerAction, onHeaderActionsChange]);

  useEffect(() => {
    onEditorActionsChange?.(actions);
  }, [actions, onEditorActionsChange]);

  useEffect(
    () => () => onEditorActionsChange?.(undefined),
    [onEditorActionsChange]
  );

  const content = useMemo(() => {
    if (!persona || !personaDocument) {
      return (
        <EmptyPlaceholder
          data-testid="persona-customize-empty"
          title={t('message.no-data-available')}
        />
      );
    }

    // Known panel editor
    if (Editor) {
      return (
        <Editor
          document={personaDocument}
          persona={persona}
          onActionsChange={handleActionsChange}
          onBack={onBack}
          onDocumentSaved={handleDocumentSaved}
        />
      );
    }

    return (
      <EmptyPlaceholder
        data-testid="persona-customize-empty"
        title={t('message.no-data-available')}
      />
    );
  }, [
    Editor,
    persona,
    personaDocument,
    handleActionsChange,
    handleDocumentSaved,
    onBack,
    t,
  ]);

  if (isLoading) {
    return <Loader />;
  }

  if (entityType && persona && personaDocument) {
    return (
      <EntityCustomizeOverlay
        document={personaDocument}
        entityType={entityType}
        persona={persona}
        onDocumentSaved={handleDocumentSaved}
      />
    );
  }

  // Full-page editors (home page) own their chrome and spacing, so they get
  // neither the in-modal padding nor the Cancel / Reset / Save footer.
  if (isFullscreenPersonaCategory(category)) {
    return content;
  }

  return (
    <Box
      className="tw:flex-1 tw:min-h-0"
      data-testid="persona-customize-view"
      direction="col">
      <div className="tw:flex-1 tw:overflow-y-auto tw:px-8 tw:pb-8">
        {content}
      </div>
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
    </Box>
  );
};

export default PersonaCustomizeView;
