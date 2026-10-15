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
  createContext,
  PropsWithChildren,
  useContext,
  useRef,
  useSyncExternalStore,
} from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  createDocumentTitleStore,
  DocumentTitleStore,
} from './DocumentTitle.store';

// Fallback so a <DocumentTitle> rendered without a provider still resolves.
const defaultStore = createDocumentTitleStore();

const DocumentTitleContext = createContext<DocumentTitleStore>(defaultStore);

export const useDocumentTitleStore = (): DocumentTitleStore =>
  useContext(DocumentTitleContext);

// The app's single <Helmet> title: the winning claim, as `<title> | <tab> | <brand>`.
export const DocumentTitleOutlet = () => {
  const { t } = useTranslation();
  const store = useDocumentTitleStore();
  const segments = useSyncExternalStore(store.subscribe, store.getSegments);

  return (
    <Helmet>
      <title>{[...segments, t('label.brand-name')].join(' | ')}</title>
    </Helmet>
  );
};

export const DocumentTitleProvider = ({ children }: PropsWithChildren) => {
  const storeRef = useRef<DocumentTitleStore>();
  if (!storeRef.current) {
    storeRef.current = createDocumentTitleStore();
  }

  return (
    <DocumentTitleContext.Provider value={storeRef.current}>
      <DocumentTitleOutlet />
      {children}
    </DocumentTitleContext.Provider>
  );
};
