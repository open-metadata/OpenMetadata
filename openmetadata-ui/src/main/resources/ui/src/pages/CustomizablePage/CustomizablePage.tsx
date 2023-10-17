/*
 *  Copyright 2023 Collate.
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
import { compare } from 'fast-json-patch';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import CustomizeMyData from '../../components/CustomizableComponents/CustomizeMyData/CustomizeMyData';
import Loader from '../../components/Loader/Loader';
import { ClientErrors } from '../../enums/axios.enum';
import { EntityType } from '../../enums/entity.enum';
import { Document } from '../../generated/entity/docStore/document';
import { PageType } from '../../generated/system/ui/page';
import {
  createDocument,
  getDocumentByFQN,
  updateDocument,
} from '../../rest/DocStoreAPI';
import { getFinalLandingPage } from '../../utils/CustomizableLandingPageUtils';
import customizePageClassBase from '../../utils/CustomizePageClassBase';
import { getDecodedFqn } from '../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

export const CustomizablePage = () => {
  const { fqn: personaFQN, pageFqn } =
    useParams<{ fqn: string; pageFqn: PageType }>();
  const { t } = useTranslation();
  const [page, setPage] = useState<Document>({} as Document);
  const [editedPage, setEditedPage] = useState<Document>({} as Document);
  const [isLoading, setIsLoading] = useState(true);
  const [saveCurrentPageLayout, setSaveCurrentPageLayout] = useState(false);

  const decodedPersonaFQN = useMemo(
    () => getDecodedFqn(personaFQN),
    [personaFQN]
  );
  const decodedPageFQN = useMemo(() => getDecodedFqn(pageFqn), [pageFqn]);

  const handlePageDataChange = useCallback((newPageData: Document) => {
    setEditedPage(newPageData);
  }, []);

  const handleSaveCurrentPageLayout = useCallback((value: boolean) => {
    setSaveCurrentPageLayout(value);
  }, []);

  const fetchDocument = async () => {
    const pageLayoutFQN = `${EntityType.PERSONA}.${personaFQN}.${EntityType.PAGE}.${pageFqn}`;
    try {
      setIsLoading(true);
      const pageData = await getDocumentByFQN(pageLayoutFQN);
      const finalPageData = getFinalLandingPage(pageData, true);

      setPage(finalPageData);
      setEditedPage(finalPageData);
    } catch (error) {
      if ((error as AxiosError).response?.status === ClientErrors.NOT_FOUND) {
        setPage(
          getFinalLandingPage(
            {
              name: `${decodedPersonaFQN}${decodedPageFQN}`,
              fullyQualifiedName: getDecodedFqn(pageLayoutFQN),
              entityType: EntityType.PAGE,
              data: {
                page: customizePageClassBase.landingPageLayout,
              },
            },
            true
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const finalPage = getFinalLandingPage(editedPage);
      let response: Document;

      if (page.id) {
        const jsonPatch = compare(page, finalPage);

        response = await updateDocument(page.id ?? '', jsonPatch);
      } else {
        response = await createDocument(finalPage);
      }
      setPage(response);
      setEditedPage(response);
      showSuccessToast(
        t('server.page-layout-operation-success', {
          operation: page.id
            ? t('label.updated-lowercase')
            : t('label.created-lowercase'),
        })
      );
    } catch {
      // Error
      showErrorToast(
        t('server.page-layout-operation-error', {
          operation: page.id
            ? t('label.updating-lowercase')
            : t('label.creating-lowercase'),
        })
      );
    }
  };

  useEffect(() => {
    if (saveCurrentPageLayout) {
      handleSave();
      setSaveCurrentPageLayout(false);
    }
  }, [saveCurrentPageLayout]);

  useEffect(() => {
    fetchDocument();
  }, [personaFQN, pageFqn]);

  if (isLoading) {
    return <Loader />;
  }

  if (pageFqn === PageType.LandingPage) {
    return (
      <CustomizeMyData
        handlePageDataChange={handlePageDataChange}
        handleSaveCurrentPageLayout={handleSaveCurrentPageLayout}
        initialPageData={page}
        onSaveLayout={handleSave}
      />
    );
  }

  return null;
};
