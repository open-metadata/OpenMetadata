/*
 *  Copyright 2024 Collate.
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
import { get, once } from 'lodash';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  CustomizeEntityType,
  ENTITY_PAGE_TYPE_MAP,
} from '../../../constants/Customize.constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs } from '../../../enums/entity.enum';
import { CreateThread } from '../../../generated/api/feed/createThread';
import { ThreadType } from '../../../generated/entity/feed/thread';
import { EntityReference } from '../../../generated/entity/type';
import { Tab } from '../../../generated/system/ui/page';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { postThread } from '../../../rest/feedsAPI';
import { getDefaultWidgetForTab } from '../../../utils/CustomizePage/CustomizePageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useActivityFeedProvider } from '../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import ActivityThreadPanel from '../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';

interface GenericProviderProps<T extends Omit<EntityReference, 'type'>> {
  children?: React.ReactNode;
  data: T;
  type: CustomizeEntityType;
  onUpdate: (updatedData: T, key?: keyof T) => Promise<void>;
  isVersionView?: boolean;
  permissions: OperationPermission;
  currentVersionData?: T;
}

interface GenericContextType<T extends Omit<EntityReference, 'type'>> {
  data: T;
  type: CustomizeEntityType;
  onUpdate: (updatedData: T, key?: keyof T) => Promise<void>;
  isVersionView?: boolean;
  permissions: OperationPermission;
  currentVersionData?: T;
  onThreadLinkSelect: (link: string, threadType?: ThreadType) => void;
  layout: WidgetConfig[];
  filterWidgets: (widgets: string[]) => void;
}

const createGenericContext = once(<T extends Omit<EntityReference, 'type'>>() =>
  React.createContext({} as GenericContextType<T>)
);

export const GenericProvider = <T extends Omit<EntityReference, 'type'>>({
  children,
  data,
  type,
  onUpdate,
  isVersionView,
  permissions,
  currentVersionData,
}: GenericProviderProps<T>) => {
  const GenericContext = createGenericContext<T>();
  const [threadLink, setThreadLink] = useState<string>('');
  const [threadType, setThreadType] = useState<ThreadType>(
    ThreadType.Conversation
  );
  const { t } = useTranslation();
  const { postFeed, deleteFeed, updateFeed } = useActivityFeedProvider();
  const pageType = ENTITY_PAGE_TYPE_MAP[type];
  const { customizedPage } = useCustomPages(pageType);
  const { tab } = useParams<{ tab: EntityTabs }>();
  const [layout, setLayout] = useState<WidgetConfig[]>(() => {
    if (!customizedPage) {
      return getDefaultWidgetForTab(pageType, tab);
    }

    if (customizedPage?.tabs?.length) {
      return tab
        ? customizedPage.tabs?.find((t: Tab) => t.id === tab)?.layout
        : get(customizedPage, 'tabs.0.layout', []);
    } else {
      return getDefaultWidgetForTab(pageType, tab);
    }
  });

  useEffect(() => {
    if (!customizedPage) {
      setLayout(getDefaultWidgetForTab(pageType, tab));
    }

    if (customizedPage?.tabs && customizedPage.tabs.length > 0) {
      setLayout(
        tab
          ? customizedPage.tabs.find((t: Tab) => t.id === tab)?.layout
          : get(customizedPage, 'tabs.0.layout', [])
      );
    } else {
      setLayout(getDefaultWidgetForTab(pageType, tab));
    }
  }, [customizedPage, tab, pageType]);

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const onThreadLinkSelect = (link: string, threadType?: ThreadType) => {
    setThreadLink(link);
    if (threadType) {
      setThreadType(threadType);
    }
  };

  const createThread = async (data: CreateThread) => {
    try {
      await postThread(data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.conversation'),
        })
      );
    }
  };

  const filterWidgets = useCallback(
    (widgets: string[]) => {
      setLayout((prev) => prev.filter((widget) => !widgets.includes(widget.i)));
    },
    [setLayout]
  );

  const values = useMemo(
    () => ({
      data,
      type,
      onUpdate,
      isVersionView,
      permissions,
      currentVersionData,
      onThreadLinkSelect,
      layout: layout,
      filterWidgets,
    }),
    [
      data,
      type,
      onUpdate,
      isVersionView,
      permissions,
      currentVersionData,
      onThreadLinkSelect,
      layout,
      filterWidgets,
    ]
  );

  return (
    <GenericContext.Provider value={values}>
      {children}
      {threadLink ? (
        <ActivityThreadPanel
          createThread={createThread}
          deletePostHandler={deleteFeed}
          open={Boolean(threadLink)}
          postFeedHandler={postFeed}
          threadLink={threadLink}
          threadType={threadType}
          updateThreadHandler={updateFeed}
          onCancel={onThreadPanelClose}
        />
      ) : null}
    </GenericContext.Provider>
  );
};

export const useGenericContext = <T extends Omit<EntityReference, 'type'>>() =>
  useContext(createGenericContext<T>());
