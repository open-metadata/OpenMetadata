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
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CustomizeMyData from '../../components/CustomizableComponents/CustomizeMyData/CustomizeMyData';
import Loader from '../../components/Loader/Loader';
import { LANDING_PAGE_LAYOUT } from '../../constants/CustomisePage.constants';
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

export const CustomisablePage = () => {
  const { fqn, pageFqn } = useParams<{ fqn: string; pageFqn: PageType }>();
  const [page, setPage] = useState<Document>({} as Document);
  const [editedPage, setEditedPage] = useState<Document>({} as Document);
  const [isLoading, setIsLoading] = useState(true);

  const handlePageDataChange = useCallback((newPageData: Document) => {
    setEditedPage(newPageData);
  }, []);

  const fetchDocument = async () => {
    const pageFQN = `${EntityType.PERSONA}.${fqn}.${EntityType.PAGE}.${pageFqn}`;
    try {
      setIsLoading(true);
      const pageData = await getDocumentByFQN(pageFQN);
      const finalPageData = getFinalLandingPage(pageData, true);

      setPage(finalPageData);
      setEditedPage(finalPageData);
    } catch (error) {
      if ((error as AxiosError).response?.status === ClientErrors.NOT_FOUND) {
        setPage(
          getFinalLandingPage(
            {
              name: `${fqn}${pageFqn}`,
              fullyQualifiedName: pageFQN,
              entityType: EntityType.PAGE,
              data: {
                page: {
                  layout: LANDING_PAGE_LAYOUT,
                },
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

      if (page.id) {
        const jsonPatch = compare(page, finalPage);

        await updateDocument(page?.id ?? '', jsonPatch);
      } else {
        await createDocument(finalPage);
      }
    } catch {
      // Error
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [fqn, pageFqn]);

  if (isLoading) {
    return <Loader />;
  }

  if (pageFqn === PageType.LandingPage) {
    return (
      <CustomizeMyData
        handlePageDataChange={handlePageDataChange}
        initialPageData={page}
        onSaveLayout={handleSave}
      />
    );
  }

  return null;
};
