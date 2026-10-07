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

import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CustomizeMyData from '../../../../../../MyData/CustomizableComponents/CustomizeMyData/CustomizeMyData';
import '../../../../../../MyData/CustomizableComponents/CustomizeMyData/customize-my-data.less';
import { Page, PageType } from '../../../../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../../../../pages/CustomizablePage/CustomizeStore';
import {
  normalizePersonaDocument,
  updatePersonaDocumentPage,
} from '../../../../../../../utils/CustomizePage/PersonaPage.utils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import { CustomizeEditorProps } from './customizeEditor.types';
import { savePersonaDocument } from './customizeEditor.utils';

const LandingPageEditor = ({
  persona,
  document,
  onDocumentSaved,
  onActionsChange,
  onBack,
}: CustomizeEditorProps) => {
  const { t } = useTranslation();
  const { currentPage, setDocument, setCurrentPageType } = useCustomizeStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const initialPage = useMemo(
    () =>
      ((document.data.pages ?? []) as Page[]).find(
        (p) => p.pageType === PageType.LandingPage
      ) ?? null,
    [document]
  );

  // Seed store once so CustomizeMyData tracks changes in useCustomizeStore.
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      setDocument(document);
      setCurrentPageType(PageType.LandingPage);
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveLayout = useCallback(
    async (newPage?: Page) => {
      const pageToSave =
        newPage ?? currentPage ?? ({ pageType: PageType.LandingPage } as Page);
      setIsSaving(true);
      try {
        const saved = await savePersonaDocument(document, (draft) => {
          draft.data = updatePersonaDocumentPage(
            draft,
            PageType.LandingPage,
            pageToSave
          ).data;
        });
        const normalized = normalizePersonaDocument(saved);
        setDocument(normalized);
        onDocumentSaved(normalized);
        setIsDirty(false);
        showSuccessToast(
          t('server.page-layout-operation-success', {
            operation: document.id
              ? t('label.updated-lowercase')
              : t('label.created-lowercase'),
          })
        );
      } catch (error) {
        showErrorToast(error as AxiosError);

        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [currentPage, document, setDocument, onDocumentSaved, t]
  );

  const handleReset = useCallback(() => {
    // Re-seed store from document to reset widget state.
    setDocument(document);
    setIsDirty(false);
  }, [document, setDocument]);

  useEffect(() => {
    onActionsChange({
      onSave: handleSaveLayout,
      onReset: handleReset,
      canSave: isDirty,
      isSaving,
    });
  }, [handleSaveLayout, handleReset, isDirty, isSaving, onActionsChange]);

  return (
    <div
      className="tw:fixed tw:inset-0 tw:z-[9999] tw:flex tw:flex-col tw:bg-page persona-settings-overlay"
      data-testid="landing-page-editor-overlay">
      <div className="tw:flex-1 tw:overflow-auto">
        <CustomizeMyData
          initialPageData={initialPage}
          personaDetails={persona}
          onClose={onBack}
          onSaveLayout={(p) => {
            setIsDirty(true);

            return handleSaveLayout(p);
          }}
        />
      </div>
    </div>
  );
};

export default LandingPageEditor;
