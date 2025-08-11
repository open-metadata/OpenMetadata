/*
 *  Copyright 2022 Collate.
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
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import RGL, { ReactGridLayoutProps, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import { AdvanceSearchProvider } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import CustomiseLandingPageHeader from '../../components/MyData/CustomizableComponents/CustomiseLandingPageHeader/CustomiseLandingPageHeader';
import WelcomeScreen from '../../components/MyData/WelcomeScreen/WelcomeScreen.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { LOGGED_IN_USER_STORAGE_KEY } from '../../constants/constants';
import { LandingPageWidgetKeys } from '../../enums/CustomizablePage.enum';
import { EntityType } from '../../enums/entity.enum';
import { Thread } from '../../generated/entity/feed/thread';
import { Page, PageType } from '../../generated/system/ui/page';
import { PersonaPreferences } from '../../generated/type/personaPreferences';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useGridLayoutDirection } from '../../hooks/useGridLayoutDirection';
import { useWelcomeStore } from '../../hooks/useWelcomeStore';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import { getActiveAnnouncement } from '../../rest/feedsAPI';
import { updateUserDetail } from '../../rest/userAPI';
import { getWidgetFromKey } from '../../utils/CustomizableLandingPageUtils';
import customizePageClassBase from '../../utils/CustomizeMyDataPageClassBase';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { WidgetConfig } from '../CustomizablePage/CustomizablePage.interface';
import './my-data.less';

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: React.ReactNode }
>;

const MyDataPage = () => {
  const { t } = useTranslation();
  const { currentUser, selectedPersona, setCurrentUser } =
    useApplicationStore();
  const { isWelcomeVisible } = useWelcomeStore();

  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayout] = useState<Array<WidgetConfig>>([]);

  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [isAnnouncementLoading, setIsAnnouncementLoading] =
    useState<boolean>(true);
  const [announcements, setAnnouncements] = useState<Thread[]>([]);
  const [personaPreferences, setPersonaPreferences] = useState<
    PersonaPreferences[]
  >([]);
  const storageData = localStorage.getItem(LOGGED_IN_USER_STORAGE_KEY);

  const loggedInUserName = useMemo(() => {
    return currentUser?.name ?? '';
  }, [currentUser]);

  const usernameExistsInCookie = useMemo(() => {
    return storageData
      ? storageData.split(',').includes(loggedInUserName)
      : false;
  }, [storageData, loggedInUserName]);

  const userPersonaBackgroundColor = useMemo(() => {
    return currentUser?.personaPreferences?.find(
      (persona) => persona.personaId === selectedPersona?.id
    )?.landingPageSettings?.headerColor;
  }, [currentUser, selectedPersona]);

  const adminPersonaBackgroundColor = useMemo(() => {
    return personaPreferences?.find(
      (persona) => persona.personaId === selectedPersona?.id
    )?.landingPageSettings?.headerColor;
  }, [personaPreferences, selectedPersona]);

  const backgroundColor = useMemo(() => {
    return userPersonaBackgroundColor ?? adminPersonaBackgroundColor;
  }, [userPersonaBackgroundColor, adminPersonaBackgroundColor]);

  const fetchDocument = async () => {
    try {
      setIsLoading(true);
      if (selectedPersona) {
        const pageFQN = `${EntityType.PERSONA}.${selectedPersona.fullyQualifiedName}`;
        const docData = await getDocumentByFQN(pageFQN);

        setPersonaPreferences(docData.data?.personPreferences ?? []);

        const pageData = docData.data?.pages?.find(
          (p: Page) => p.pageType === PageType.LandingPage
        ) ?? { layout: [], pageType: PageType.LandingPage };

        const filteredLayout = pageData.layout.filter(
          (widget: WidgetConfig) =>
            !widget.i.startsWith(LandingPageWidgetKeys.CURATED_ASSETS) ||
            !isEmpty(widget.config)
        );

        setLayout(
          isEmpty(filteredLayout)
            ? customizePageClassBase.defaultLayout
            : filteredLayout
        );
      } else {
        setLayout(customizePageClassBase.defaultLayout);
      }
    } catch {
      setLayout(customizePageClassBase.defaultLayout);
    } finally {
      setIsLoading(false);
    }
  };

  const updateWelcomeScreen = (show: boolean) => {
    if (loggedInUserName) {
      const arr = storageData ? storageData.split(',') : [];
      if (!arr.includes(loggedInUserName)) {
        arr.push(loggedInUserName);
        localStorage.setItem(LOGGED_IN_USER_STORAGE_KEY, arr.join(','));
      }
    }
    setShowWelcomeScreen(show);
  };

  useEffect(() => {
    fetchDocument();
  }, [selectedPersona]);

  useEffect(() => {
    updateWelcomeScreen(!usernameExistsInCookie && isWelcomeVisible);

    return () => updateWelcomeScreen(false);
  }, []);

  const widgets = useMemo(
    () =>
      layout.map((widget) => (
        <div data-grid={widget} key={widget.i}>
          {getWidgetFromKey({
            widgetConfig: widget,
            currentLayout: layout,
          })}
        </div>
      )),
    [layout, isAnnouncementLoading, announcements]
  );

  const fetchAnnouncements = useCallback(async () => {
    try {
      setIsAnnouncementLoading(true);
      const response = await getActiveAnnouncement();

      setAnnouncements(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsAnnouncementLoading(false);
    }
  }, []);

  const handleBackgroundColorUpdate = async (color: string) => {
    try {
      if (!currentUser?.id) {
        return;
      }

      //   Find the persona preference for the selected persona
      const hasPersonaPreference = currentUser.personaPreferences?.find(
        (persona) => persona.personaId === selectedPersona?.id
      );

      //   If the persona preference is found, update the landing page settings else add a new persona preference
      const updatedPersonaPreferences = hasPersonaPreference
        ? currentUser.personaPreferences?.map((persona) =>
            persona.personaId === selectedPersona?.id
              ? {
                  ...persona,
                  landingPageSettings: {
                    ...persona.landingPageSettings,
                    headerColor: color,
                  },
                }
              : persona
          )
        : [
            ...(currentUser.personaPreferences ?? []),
            {
              personaName: selectedPersona?.name,
              personaId: selectedPersona?.id,
              landingPageSettings: {
                headerColor: color,
              },
            },
          ];

      //   Compare the current user with the updated user to get the json patch
      const jsonPatch = compare(currentUser, {
        ...currentUser,
        personaPreferences: updatedPersonaPreferences,
      });

      const response = await updateUserDetail(currentUser.id, jsonPatch);

      //   Update the current user with the updated persona preferences
      if (response) {
        setCurrentUser({
          ...currentUser,
          personaPreferences: updatedPersonaPreferences as PersonaPreferences[],
        });
        showSuccessToast(t('message.persona-preference-updated'));
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection(isLoading);

  if (isLoading) {
    return <Loader fullScreen />;
  }

  if (showWelcomeScreen) {
    return (
      <PageLayoutV1 pageTitle={t('label.my-data')}>
        <WelcomeScreen onClose={() => updateWelcomeScreen(false)} />
      </PageLayoutV1>
    );
  }

  return (
    <AdvanceSearchProvider isExplorePage={false} updateURL={false}>
      <PageLayoutV1
        className="p-b-lg"
        mainContainerClassName="p-t-0 my-data-page-main-container"
        pageTitle={t('label.my-data')}>
        <div className="grid-wrapper">
          <CustomiseLandingPageHeader
            overlappedContainer
            backgroundColor={backgroundColor}
            dataTestId="landing-page-header"
            hideCustomiseButton={!selectedPersona}
            onHomePage
            onBackgroundColorUpdate={handleBackgroundColorUpdate}
          />
          <ReactGridLayout
            className="grid-container p-x-box"
            cols={customizePageClassBase.landingPageMaxGridSize}
            containerPadding={[0, 0]}
            isDraggable={false}
            isResizable={false}
            margin={[
              customizePageClassBase.landingPageWidgetMargin,
              customizePageClassBase.landingPageWidgetMargin,
            ]}
            rowHeight={customizePageClassBase.landingPageRowHeight}>
            {widgets}
          </ReactGridLayout>
        </div>
        <LimitWrapper resource="dataAssets">
          <br />
        </LimitWrapper>
      </PageLayoutV1>
    </AdvanceSearchProvider>
  );
};

export default MyDataPage;
