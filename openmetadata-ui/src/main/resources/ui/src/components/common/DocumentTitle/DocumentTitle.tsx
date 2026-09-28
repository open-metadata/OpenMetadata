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
import { FC, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { TAB_LABEL_MAP } from '../../../constants/Customize.constants';
import { useIsRouteVisible } from '../../../context/RouteVisibilityProvider/RouteVisibilityProvider';
import { EntityTabs } from '../../../enums/entity.enum';
import { DocumentTitlePriority } from './DocumentTitle.store';
import { useDocumentTitleStore } from './DocumentTitleProvider';

interface DocumentTitleProps {
  title: string;
  // Only a shell-level fallback passes SHELL.
  priority?: DocumentTitlePriority;
  // Appended after the title; defaults to the route's `:tab` param.
  tab?: string;
}

// Claims the tab title; DocumentTitleOutlet renders the winning claim.
const DocumentTitle: FC<DocumentTitleProps> = ({
  title,
  priority = DocumentTitlePriority.PAGE,
  tab,
}) => {
  const { t } = useTranslation();
  const store = useDocumentTitleStore();
  const visible = useIsRouteVisible();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const idRef = useRef<symbol>();
  if (!idRef.current) {
    idRef.current = Symbol('document-title');
  }
  const id = idRef.current;

  const tabLabel = useMemo(() => {
    const activeTab = (tab ?? tabParam) as EntityTabs | undefined;
    const labelKey = activeTab ? TAB_LABEL_MAP[activeTab] : undefined;

    return labelKey ? t(labelKey) : undefined;
  }, [tab, tabParam, t]);

  useEffect(() => {
    store.set(id, { title, tabLabel, priority, visible });
  }, [store, id, title, tabLabel, priority, visible]);

  // Unmount-only cleanup, so a claim keeps its registration order across updates.
  useEffect(() => () => store.remove(id), [store, id]);

  return null;
};

export default DocumentTitle;
