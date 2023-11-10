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
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import CustomizeMyData from '../../components/CustomizableComponents/CustomizeMyData/CustomizeMyData';
import Loader from '../../components/Loader/Loader';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { ClientErrors } from '../../enums/axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { Document } from '../../generated/entity/docStore/document';
import { Persona } from '../../generated/entity/teams/persona';
import { PageType } from '../../generated/system/ui/page';
import {
  createDocument,
  getDocumentByFQN,
  updateDocument,
} from '../../rest/DocStoreAPI';
import { getPersonaByName } from '../../rest/PersonaAPI';
import { Transi18next } from '../../utils/CommonUtils';
import customizePageClassBase from '../../utils/CustomizePageClassBase';
import { getSettingPath } from '../../utils/RouterUtils';
import { getDecodedFqn } from '../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

export const CustomizablePage = () => {
  const { fqn: personaFQN, pageFqn } =
    useParams<{ fqn: string; pageFqn: PageType }>();
  const { t } = useTranslation();
  const [page, setPage] = useState<Document>({} as Document);
  const [editedPage, setEditedPage] = useState<Document>({} as Document);
  const [isLoading, setIsLoading] = useState(false);
  const [isPersonaLoading, setIsPersonaLoading] = useState(true);
  const [personaDetails, setPersonaDetails] = useState<Persona>();
  const [saveCurrentPageLayout, setSaveCurrentPageLayout] = useState(false);

  const decodedPageFQN = useMemo(() => getDecodedFqn(pageFqn), [pageFqn]);

  const handlePageDataChange = useCallback((newPageData: Document) => {
    setEditedPage(newPageData);
  }, []);

  const handleSaveCurrentPageLayout = useCallback((value: boolean) => {
    setSaveCurrentPageLayout(value);
  }, []);

  const fetchPersonaDetails = useCallback(async () => {
    try {
      setIsPersonaLoading(true);
      const response = await getPersonaByName(personaFQN);

      setPersonaDetails(response);
    } catch {
      // No error handling needed
      // No data placeholder will be shown in case of failure
    } finally {
      setIsPersonaLoading(false);
    }
  }, [personaFQN]);

  const fetchDocument = async () => {
    if (!isUndefined(personaDetails)) {
      const pageLayoutFQN = `${EntityType.PERSONA}.${personaFQN}.${EntityType.PAGE}.${pageFqn}`;
      try {
        setIsLoading(true);
        const pageData = await getDocumentByFQN(getDecodedFqn(pageLayoutFQN));

        setPage(pageData);
        setEditedPage(pageData);
      } catch (error) {
        if ((error as AxiosError).response?.status === ClientErrors.NOT_FOUND) {
          setPage({
            name: `${personaDetails.name}-${decodedPageFQN}`,
            fullyQualifiedName: getDecodedFqn(pageLayoutFQN),
            entityType: EntityType.PAGE,
            data: {
              page: { layout: customizePageClassBase.defaultLayout },
            },
          });
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSave = async () => {
    try {
      let response: Document;

      if (page.id) {
        const jsonPatch = compare(page, editedPage);

        response = await updateDocument(page.id ?? '', jsonPatch);
      } else {
        response = await createDocument(editedPage);
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
    fetchPersonaDetails();
  }, [personaFQN, pageFqn]);

  useEffect(() => {
    fetchDocument();
  }, [personaDetails]);

  if (isLoading || isPersonaLoading) {
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
                    style={{ color: '#1890ff' }}
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

  if (pageFqn === PageType.LandingPage) {
    return (
      <CustomizeMyData
        handlePageDataChange={handlePageDataChange}
        handleSaveCurrentPageLayout={handleSaveCurrentPageLayout}
        initialPageData={page}
        personaDetails={personaDetails}
        onSaveLayout={handleSave}
      />
    );
  }

  return null;
};
