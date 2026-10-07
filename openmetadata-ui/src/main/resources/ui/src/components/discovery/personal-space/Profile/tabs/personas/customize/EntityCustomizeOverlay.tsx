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
import { lazy, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../../../../../AppRouter/withSuspenseFallback';
import { Page, PageType } from '../../../../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../../../../pages/CustomizablePage/CustomizeStore';
import { updatePersonaDocumentPage } from '../../../../../../../utils/CustomizePage/PersonaPage.utils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import { CustomizeEditorProps } from './customizeEditor.types';
import { savePersonaDocument } from './customizeEditor.utils';

const CustomizeDetailsPage = withSuspenseFallback(
  lazy(() =>
    import(
      '../../../../../../../pages/CustomizeDetailsPage/CustomizeDetailsPage'
    ).then((m) => ({ default: m.CustomizeDetailsPage }))
  )
);

const CustomiseGlossaryTermDetailPage = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../../../../../MyData/CustomizableComponents/CustomiseGlossaryTermDetailPage/CustomiseGlossaryTermDetailPage'
      )
  )
);

const GLOSSARY_TYPES = new Set<string>([
  PageType.Glossary as string,
  PageType.GlossaryTerm as string,
]);

interface EntityCustomizeOverlayProps
  extends Pick<
    CustomizeEditorProps,
    'persona' | 'document' | 'onDocumentSaved'
  > {
  entityType: string;
  onClose: () => void;
}

const EntityCustomizeOverlay = ({
  persona,
  document,
  entityType,
  onClose,
  onDocumentSaved,
}: EntityCustomizeOverlayProps) => {
  const { t } = useTranslation();
  const { setCurrentPageType } = useCustomizeStore();

  useEffect(() => {
    setCurrentPageType(entityType as PageType);
  }, [entityType, setCurrentPageType]);

  const handleSaveLayout = async (newPage?: Page) => {
    try {
      const saved = await savePersonaDocument(document, (draft) => {
        draft.data = updatePersonaDocumentPage(draft, entityType, newPage).data;
      });
      onDocumentSaved(saved);
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
    }
  };

  const isGlossary = GLOSSARY_TYPES.has(entityType);

  return (
    <div
      className="tw:fixed tw:inset-0 tw:z-[9999] tw:flex tw:flex-col tw:bg-page"
      data-testid="entity-customize-overlay">
      <div className="tw:flex-1 tw:overflow-auto">
        {isGlossary ? (
          <CustomiseGlossaryTermDetailPage
            initialPageData={null}
            isGlossary={entityType === PageType.Glossary}
            personaDetails={persona}
            onClose={onClose}
            onSaveLayout={handleSaveLayout}
          />
        ) : (
          <CustomizeDetailsPage
            initialPageData={null}
            isGlossary={false}
            personaDetails={persona}
            onClose={onClose}
            onSaveLayout={handleSaveLayout}
          />
        )}
      </div>
    </div>
  );
};

export default EntityCustomizeOverlay;
