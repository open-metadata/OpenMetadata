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
import { useQueryClient } from '@tanstack/react-query';
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isUndefined } from 'lodash';
import { lazy, ReactElement, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
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
import { UICustomization } from '../../generated/system/ui/uiCustomization';
import {
  AppMode,
  PersonaPreferences,
} from '../../generated/type/personaPreferences';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import {
  createDocument,
  getDocumentByFQN,
  updateDocument,
} from '../../rest/DocStoreAPI';
import { getPersonaByName } from '../../rest/PersonaAPI';
import { docStoreQueryKey } from '../../rest/queries/docStoreQuery';
import {
  normalizePersonaDocument,
  updatePersonaDocumentPage,
} from '../../utils/CustomizePage/PersonaPage.utils';
import { Transi18next } from '../../utils/i18next/LocalUtil';
import { getOwnHandler } from '../../utils/RecordUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import CustomizableDataMarketplacePage from '../CustomizableDataMarketplacePage/CustomizableDataMarketplacePage';
import CustomizableDataProductPage from '../CustomizableDataProductPage/CustomizableDataProductPage';
import CustomizableDomainPage from '../CustomizableDomainPage/CustomizableDomainPage';
import { CustomizeDetailsPage } from '../CustomizeDetailsPage/CustomizeDetailsPage';
import { SettingsNavigationPage } from '../SettingsNavigationPage/SettingsNavigationPage';
import { useCustomizeStore } from './CustomizeStore';

const CustomizeGlossaryTermDetailPage = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../../components/MyData/CustomizableComponents/CustomiseGlossaryTermDetailPage/CustomiseGlossaryTermDetailPage'
      )
  )
);

const SettingsAppModePage = withSuspenseFallback(
  lazy(() =>
    import('../SettingsAppModePage/SettingsAppModePage').then((m) => ({
      default: m.SettingsAppModePage,
    }))
  )
);

const CustomizeAppModeSidebarPage = withSuspenseFallback(
  lazy(
    () => import('../CustomizeAppModeSidebarPage/CustomizeAppModeSidebarPage')
  )
);

interface CustomizePageRenderContext {
  personaDetails: Persona;
  currentPage: Page | null;
  backgroundColor?: string;
  onSaveLayout: (newPage?: Page) => Promise<void>;
  onNavigationSave: (
    uiNavigation: UICustomization['navigation']
  ) => Promise<void>;
  onAppModeSave: (appMode: AppMode) => Promise<void>;
  onBackgroundColorUpdate: (color?: string) => Promise<void>;
}

// Page types that all render the generic CustomizeDetailsPage.
const DETAILS_PAGE_TYPES: PageType[] = [
  PageType.Table,
  PageType.Topic,
  PageType.StoredProcedure,
  PageType.DashboardDataModel,
  PageType.Dashboard,
  PageType.Pipeline,
  PageType.DatabaseSchema,
  PageType.Database,
  PageType.Container,
  PageType.SearchIndex,
  PageType.Metric,
  PageType.MlModel,
  PageType.APIEndpoint,
  PageType.APICollection,
  PageType.Chart,
  PageType.Directory,
  PageType.File,
  PageType.Spreadsheet,
  PageType.Worksheet,
];

const getCustomizePageContent = (
  pageFqn: string,
  ctx: CustomizePageRenderContext
): ReactElement => {
  const {
    personaDetails,
    currentPage,
    backgroundColor,
    onSaveLayout,
    onNavigationSave,
    onAppModeSave,
    onBackgroundColorUpdate,
  } = ctx;

  const renderLandingPage = () => (
    <CustomizeMyData
      backgroundColor={backgroundColor}
      initialPageData={currentPage}
      personaDetails={personaDetails}
      onBackgroundColorUpdate={onBackgroundColorUpdate}
      onSaveLayout={onSaveLayout}
    />
  );

  const renderDetailsPage = () => (
    <CustomizeDetailsPage
      initialPageData={currentPage}
      isGlossary={false}
      personaDetails={personaDetails}
      onSaveLayout={onSaveLayout}
    />
  );

  const renderers: Record<string, () => ReactElement> = {
    navigation: () => (
      <SettingsNavigationPage
        persona={personaDetails}
        onSave={onNavigationSave}
      />
    ),
    'app-mode': () => (
      <SettingsAppModePage
        personaDetails={personaDetails}
        onSave={onAppModeSave}
      />
    ),
    askCollateSidebar: () => <CustomizeAppModeSidebarPage />,
    [PageType.LandingPage]: renderLandingPage,
    homepage: renderLandingPage,
    [PageType.DataMarketplace]: () => (
      <CustomizableDataMarketplacePage
        initialPageData={currentPage}
        personaDetails={personaDetails}
        onSaveLayout={onSaveLayout}
      />
    ),
    [PageType.Domain]: () => (
      <CustomizableDomainPage
        initialPageData={currentPage}
        personaDetails={personaDetails}
        onSaveLayout={onSaveLayout}
      />
    ),
    [PageType.DataProduct]: () => (
      <CustomizableDataProductPage
        initialPageData={currentPage}
        personaDetails={personaDetails}
        onSaveLayout={onSaveLayout}
      />
    ),
    [PageType.Glossary]: () => (
      <CustomizeGlossaryTermDetailPage
        isGlossary
        initialPageData={currentPage}
        personaDetails={personaDetails}
        onSaveLayout={onSaveLayout}
      />
    ),
    [PageType.GlossaryTerm]: () => (
      <CustomizeGlossaryTermDetailPage
        initialPageData={currentPage}
        isGlossary={false}
        personaDetails={personaDetails}
        onSaveLayout={onSaveLayout}
      />
    ),
  };

  DETAILS_PAGE_TYPES.forEach((type) => {
    renderers[type] = renderDetailsPage;
  });

  const renderer = getOwnHandler(renderers, pageFqn);

  return renderer ? renderer() : <ErrorPlaceHolder />;
};

const CustomizablePageContent = () => {
  const { pageFqn } = useRequiredParams<{ pageFqn: string }>();
  const { fqn: personaFQN } = useFqn();
  const { t } = useTranslation();
  const { theme } = useApplicationStore();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [personaDetails, setPersonaDetails] = useState<Persona>();
  const { document, setDocument, currentPage, setCurrentPageType } =
    useCustomizeStore();

  const backgroundColor = useMemo(
    () =>
      document?.data.personPreferences?.find(
        (persona: PersonaPreferences) =>
          persona.personaId === personaDetails?.id
      )?.landingPageSettings?.headerColor,
    [document, personaDetails]
  );

  const syncSavedDocument = (response: Document) => {
    const normalizedResponse = normalizePersonaDocument(response);

    setDocument(normalizedResponse);
    queryClient.setQueryData(
      docStoreQueryKey(document?.fullyQualifiedName ?? ''),
      normalizedResponse
    );
  };

  const handlePageCustomizeSave = async (newPage?: Page) => {
    if (!document) {
      return;
    }
    const newDoc = updatePersonaDocumentPage(document, pageFqn, newPage);

    if (newDoc === document) {
      return;
    }

    try {
      let response: Document;

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
      syncSavedDocument(response);

      showSuccessToast(
        t('server.page-layout-operation-success', {
          operation: document.id
            ? t('label.updated-lowercase')
            : t('label.created-lowercase'),
        })
      );
    } catch {
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
      syncSavedDocument(response);

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

      newDoc.data.personPreferences =
        document.id && document.data.personPreferences?.length
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
          domains: newDoc.domains
            ?.map((d) => d.fullyQualifiedName)
            .filter(Boolean) as string[],
        });
      }
      syncSavedDocument(response);

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

  const handleAppModeSave = async (appMode: AppMode) => {
    if (!document) {
      return;
    }
    try {
      let response: Document;
      const newDoc = cloneDeep(document);
      const existing = (newDoc.data.personaPreferences ??
        []) as PersonaPreferences[];
      const match = existing.find(
        (persona) => persona.personaId === personaDetails?.id
      );

      newDoc.data.personaPreferences = match
        ? existing.map((persona) =>
            persona.personaId === personaDetails?.id
              ? { ...persona, appMode }
              : persona
          )
        : [
            ...existing,
            {
              personaId: personaDetails?.id ?? '',
              personaName: personaDetails?.name ?? '',
              appMode,
            },
          ];

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
      syncSavedDocument(response);

      showSuccessToast(
        t('server.page-layout-operation-success', {
          operation: document.id
            ? t('label.updated-lowercase')
            : t('label.created-lowercase'),
        })
      );
    } catch {
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
                navigation: null,
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

  return getCustomizePageContent(pageFqn, {
    personaDetails,
    currentPage,
    backgroundColor,
    onSaveLayout: handlePageCustomizeSave,
    onNavigationSave: handleNavigationSave,
    onAppModeSave: handleAppModeSave,
    onBackgroundColorUpdate: handleBackgroundColorUpdate,
  });
};

/**
 * The content has many exits — a loader, a no-persona placeholder, a
 * per-page-type customizer, and an unknown-page fallback — and only the
 * customizers carry a title of their own. Setting one here, before the
 * content, gives every branch a floor while letting a customizer that
 * registers its own Helmet later still win.
 */
export const CustomizablePage = () => {
  const { t } = useTranslation();

  return (
    <>
      <DocumentTitle
        title={t('label.customize-entity', { entity: t('label.page') })}
      />
      <CustomizablePageContent />
    </>
  );
};
