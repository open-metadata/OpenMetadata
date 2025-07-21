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
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isUndefined } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import CustomizeGlossaryTermDetailPage from '../../components/MyData/CustomizableComponents/CustomiseGlossaryTermDetailPage/CustomiseGlossaryTermDetailPage';
import CustomizeMyData from '../../components/MyData/CustomizableComponents/CustomizeMyData/CustomizeMyData';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { Document } from '../../generated/entity/docStore/document';
import { Persona } from '../../generated/entity/teams/persona';
import { Page, PageType } from '../../generated/system/ui/page';
import {
  PersonaPreferences,
  UICustomization,
} from '../../generated/system/ui/uiCustomization';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  createDocument,
  getDocumentByFQN,
  updateDocument,
} from '../../rest/DocStoreAPI';
import { getPersonaByName } from '../../rest/PersonaAPI';
import { Transi18next } from '../../utils/CommonUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import CustomizableDomainPage from '../CustomizableDomainPage/CustomizableDomainPage';
import { CustomizeDetailsPage } from '../CustomizeDetailsPage/CustomizeDetailsPage';
import { SettingsNavigationPage } from '../SettingsNavigationPage/SettingsNavigationPage';
import { useCustomizeStore } from './CustomizeStore';

export const CustomizablePage = () => {
  const { pageFqn } = useRequiredParams<{ pageFqn: string }>();
  const { fqn: personaFQN } = useFqn();
  const { t } = useTranslation();
  const { theme } = useApplicationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [personaDetails, setPersonaDetails] = useState<Persona>();
  const {
    document,
    setDocument,
    getNavigation,
    currentPage,
    getPage,
    setCurrentPageType,
  } = useCustomizeStore();

  const backgroundColor = useMemo(
    () =>
      document?.data.personPreferences?.find(
        (persona: PersonaPreferences) =>
          persona.personaId === personaDetails?.id
      )?.landingPageSettings?.headerColor,
    [document, personaDetails]
  );

  const handlePageCustomizeSave = async (newPage?: Page) => {
    if (!document) {
      return;
    }
    try {
      let response: Document;
      const newDoc = cloneDeep(document);
      const pageData = getPage(pageFqn);

      if (pageData) {
        newDoc.data.pages = newPage
          ? newDoc.data?.pages?.map((p: Page) =>
              p.pageType === pageFqn ? newPage : p
            )
          : newDoc.data?.pages.filter((p: Page) => p.pageType !== pageFqn);
      } else {
        newDoc.data = {
          ...newDoc.data,
          pages: [...(newDoc.data.pages ?? []), newPage],
        };
      }

      if (document.id) {
        const jsonPatch = compare(document, newDoc);

        response = await updateDocument(document.id ?? '', jsonPatch);
      } else {
        response = await createDocument({
          ...newDoc,
          domains: newDoc.domains
            ?.map((d) => d.fullyQualifiedName)
            .filter(Boolean) as string[],
        });
      }
      setDocument(response);

      showSuccessToast(
        t('server.page-layout-operation-success', {
          operation: document.id
            ? t('label.updated-lowercase')
            : t('label.created-lowercase'),
        })
      );
    } catch (error) {
      // Error
      showErrorToast(
        t('server.page-layout-operation-error', {
          operation: document.id
            ? t('label.updating-lowercase')
            : t('label.creating-lowercase'),
        })
      );
    }
  };

  const handleNavigationSave = async (
    uiNavigation: UICustomization['navigation']
  ) => {
    if (!document) {
      return;
    }
    try {
      let response: Document;
      const newDoc = cloneDeep(document);

      newDoc.data.navigation = uiNavigation;

      if (document.id) {
        const jsonPatch = compare(document, newDoc);

        response = await updateDocument(document.id ?? '', jsonPatch);
      } else {
        response = await createDocument({
          ...newDoc,
          domains: newDoc.domains
            ?.map((d) => d.fullyQualifiedName)
            .filter(Boolean) as string[],
        });
      }
      setDocument(response);

      showSuccessToast(
        t('server.page-layout-operation-success', {
          operation: document.id
            ? t('label.updated-lowercase')
            : t('label.created-lowercase'),
        })
      );
    } catch {
      // Error
      showErrorToast(
        t('server.page-layout-operation-error', {
          operation: document.id
            ? t('label.updating-lowercase')
            : t('label.creating-lowercase'),
        })
      );
    }
  };

  const handleBackgroundColorUpdate = async (color?: string) => {
    if (!document) {
      return;
    }
    try {
      let response: Document;
      const newDoc = cloneDeep(document);

      newDoc.data.personPreferences = document.id
        ? newDoc.data.personPreferences.map((persona: PersonaPreferences) => {
            if (persona.personaId === personaDetails?.id) {
              return {
                ...persona,
                landingPageSettings: {
                  ...persona.landingPageSettings,
                  headerColor: color,
                },
              };
            }

            return persona;
          })
        : [
            ...(newDoc.data.personPreferences ?? []),
            {
              personaName: personaDetails?.name,
              personaId: personaDetails?.id,
              landingPageSettings: {
                ...newDoc.data.personPreferences?.landingPageSettings,
                headerColor: color,
              },
            },
          ];

      if (document.id) {
        const jsonPatch = compare(document, newDoc);

        response = await updateDocument(document.id ?? '', jsonPatch);
      } else {
        response = await createDocument({
          ...newDoc,
          domain: newDoc.domain?.fullyQualifiedName,
        });
      }
      setDocument(response);

      showSuccessToast(
        t('server.page-layout-operation-success', {
          operation: document.id
            ? t('label.updated-lowercase')
            : t('label.created-lowercase'),
        })
      );
    } catch {
      // Error
      showErrorToast(
        t('server.page-layout-operation-error', {
          operation: document.id
            ? t('label.updating-lowercase')
            : t('label.creating-lowercase'),
        })
      );
    }
  };

  const initializeCustomizeStore = async () => {
    setIsLoading(true);
    const pageLayoutFQN = `${EntityType.PERSONA}.${personaFQN}`;
    try {
      const personaDetails = await getPersonaByName(personaFQN);
      setPersonaDetails(personaDetails);

      if (personaDetails) {
        try {
          const pageData = await getDocumentByFQN(pageLayoutFQN);

          setDocument(pageData);
          setCurrentPageType(pageFqn as PageType);
        } catch (error) {
          if (
            (error as AxiosError).response?.status === ClientErrors.NOT_FOUND
          ) {
            setDocument({
              name: `${personaDetails.name}-${personaFQN}`,
              fullyQualifiedName: pageLayoutFQN,
              entityType: EntityType.PAGE,
              data: {
                pages: [],
                navigation: [],
              },
            });
            setCurrentPageType(pageFqn as PageType);
          } else {
            showErrorToast(error as AxiosError);
          }
        }
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeCustomizeStore();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  if (isUndefined(personaDetails)) {
    return (
      <Row className="bg-white h-full">
        <Col span={24}>
          <ErrorPlaceHolder
            className="m-t-lg"
            type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
            <Typography.Paragraph className="w-max-500">
              <Transi18next
                i18nKey="message.no-persona-message"
                renderElement={
                  <Link
                    style={{ color: theme.primaryColor }}
                    to={getSettingPath(
                      GlobalSettingsMenuCategory.MEMBERS,
                      GlobalSettingOptions.PERSONA
                    )}
                  />
                }
                values={{
                  link: t('label.here-lowercase'),
                }}
              />
            </Typography.Paragraph>
          </ErrorPlaceHolder>
        </Col>
      </Row>
    );
  }

  switch (pageFqn) {
    case 'navigation':
      return (
        <SettingsNavigationPage
          currentNavigation={getNavigation()}
          onSave={handleNavigationSave}
        />
      );

    case PageType.LandingPage:
    case 'homepage':
      return (
        <CustomizeMyData
          backgroundColor={backgroundColor}
          initialPageData={currentPage}
          personaDetails={personaDetails}
          onBackgroundColorUpdate={handleBackgroundColorUpdate}
          onSaveLayout={handlePageCustomizeSave}
        />
      );
    case PageType.Domain:
      return (
        <CustomizableDomainPage
          initialPageData={currentPage}
          personaDetails={personaDetails}
          onSaveLayout={handlePageCustomizeSave}
        />
      );

    case PageType.Glossary:
    case PageType.GlossaryTerm:
      return (
        <CustomizeGlossaryTermDetailPage
          initialPageData={currentPage}
          isGlossary={pageFqn === PageType.Glossary}
          personaDetails={personaDetails}
          onSaveLayout={handlePageCustomizeSave}
        />
      );
    case PageType.Table:
    case PageType.Topic:
    case PageType.StoredProcedure:
    case PageType.DashboardDataModel:
    case PageType.Dashboard:
    case PageType.Pipeline:
    case PageType.DatabaseSchema:
    case PageType.Database:
    case PageType.Container:
    case PageType.SearchIndex:
    case PageType.Metric:
    case PageType.MlModel:
    case PageType.APIEndpoint:
    case PageType.APICollection:
      return (
        <CustomizeDetailsPage
          initialPageData={currentPage}
          isGlossary={false}
          personaDetails={personaDetails}
          onSaveLayout={handlePageCustomizeSave}
        />
      );

    default:
      return <ErrorPlaceHolder />;
  }
};
