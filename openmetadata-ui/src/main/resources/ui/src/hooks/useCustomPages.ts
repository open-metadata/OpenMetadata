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
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    let isMounted = true;

    const fetchDocument = async () => {
      if (!selectedPersona?.fullyQualifiedName) {
        setCustomizedPage(null);
        setNavigation(null);
        setIsLoading(false);

        return;
      }

      setIsLoading(true);

      const pageFQN = `${EntityType.PERSONA}${FQN_SEPARATOR_CHAR}${selectedPersona.fullyQualifiedName}`;

      try {
        const doc = await getDocumentByFQN(pageFQN);

        if (!isMounted) {
          return;
        }

        setCustomizedPage(
          doc.data?.pages?.find((p: Page | null) => p?.pageType === pageType) ??
            null
        );
        setNavigation(doc.data?.navigation ?? null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        // Need to reset Navigation to avoid showing old navigation items
        setNavigation([]);
        setCustomizedPage(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchDocument();

    return () => {
      isMounted = false;
    };
  }, [selectedPersona?.fullyQualifiedName, pageType]);

  return {
    customizedPage,
    navigation,
    isLoading,
  };
};
