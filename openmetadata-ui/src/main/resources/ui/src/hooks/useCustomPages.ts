/*
 *  Copyright 2025 Collate.
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
import { useCallback, useEffect, useState } from 'react';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { EntityType } from '../enums/entity.enum';
import { Page, PageType } from '../generated/system/ui/page';
import { NavigationItem } from '../generated/system/ui/uiCustomization';
import { getDocumentByFQN } from '../rest/DocStoreAPI';
import { useApplicationStore } from './useApplicationStore';

export const useCustomPages = (pageType: PageType | 'Navigation') => {
  const { selectedPersona } = useApplicationStore();
  const [customizedPage, setCustomizedPage] = useState<Page | null>(null);
  const [navigation, setNavigation] = useState<NavigationItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDocument = useCallback(async () => {
    const pageFQN = `${EntityType.PERSONA}${FQN_SEPARATOR_CHAR}${selectedPersona?.fullyQualifiedName}`;
    try {
      const doc = await getDocumentByFQN(pageFQN);
      setCustomizedPage(
        doc.data?.pages?.find((p: Page) => p.pageType === pageType)
      );
      setNavigation(doc.data?.navigation);
    } catch (error) {
      // Need to reset Navigation to avoid showing old navigation items
      setNavigation([]);
      setCustomizedPage(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPersona?.fullyQualifiedName, pageType]);

  useEffect(() => {
    if (selectedPersona?.fullyQualifiedName) {
      fetchDocument();
    } else {
      setIsLoading(false);
    }
  }, [selectedPersona, pageType]);

  return {
    customizedPage,
    navigation,
    isLoading,
  };
};
