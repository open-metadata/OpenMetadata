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
import { Button, Col, Row, Skeleton } from 'antd';
import Card from 'antd/lib/card/Card';
import { AxiosError } from 'axios';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import { NextPreviousProps } from '../../components/common/next-previous/NextPrevious.interface';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import { AddEditCustomizePage } from '../../components/CustomizablePages/AddEditCustomizePages/AddEditCustomizePage.component';
import PageHeader from '../../components/header/PageHeader.component';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { Document } from '../../generated/entity/docStore/document';
import { Persona } from '../../generated/entity/teams/persona';
import { PageType } from '../../generated/system/ui/page';
import { usePaging } from '../../hooks/paging/usePaging';
import { getAllPersonas } from '../../rest/PersonaAPI';
import { showPagination } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { getCustomisePagePath } from '../../utils/GlobalSettingsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export const CustomPageSettings = () => {
  const { t } = useTranslation();
  const history = useHistory();

  const [pageEditing, setPageEditing] = useState<Document>();
  const [isLoading, setIsLoading] = useState(true);

  const [personas, setPersonas] = useState<Persona[]>();
  const {
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    pageSize,
    paging,
    handlePagingChange,
  } = usePaging();

  const fetchPersonas = async () => {
    try {
      setIsLoading(true);
      const { data, paging } = await getAllPersonas({});
      setPersonas(data);
      handlePagingChange(paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  const handleDocumentSave = () => {
    setPageEditing(undefined);
  };

  const handleCustomisePersona = (persona: Persona) => {
    if (persona.fullyQualifiedName) {
      history.push(
        getCustomisePagePath(persona.fullyQualifiedName, PageType.LandingPage)
      );
    }
  };

  const handlePersonaPageChange: NextPreviousProps['pagingHandler'] = ({
    currentPage,
  }) => {
    handlePageChange(currentPage);
  };

  return (
    <Row
      className="user-listing p-b-md"
      data-testid="user-list-v1-component"
      gutter={[16, 16]}>
      <Col span={18}>
        <PageHeader data={PAGE_HEADERS.CUSTOM_PAGE} />
      </Col>

      {isLoading &&
        [1, 2, 3].map((key) => (
          <Col key={key} span={8}>
            <Card>
              <Skeleton active paragraph title />
            </Card>
          </Col>
        ))}

      {personas?.map((persona) => (
        <Col key={persona.id} span={8}>
          <Card
            bodyStyle={{ height: '100%' }}
            className="h-full"
            extra={
              <Button
                className="text-link-color"
                size="small"
                type="text"
                onClick={() => handleCustomisePersona(persona)}>
                {t('label.customise')}
              </Button>
            }
            title={getEntityName(persona)}>
            <RichTextEditorPreviewer markdown={persona.description ?? ''} />
          </Card>
        </Col>
      ))}
      {showPagination(paging) && (
        <NextPrevious
          currentPage={currentPage}
          pageSize={pageSize}
          paging={paging}
          pagingHandler={handlePersonaPageChange}
          onShowSizeChange={handlePageSizeChange}
        />
      )}
      {pageEditing && (
        <AddEditCustomizePage
          page={pageEditing}
          onCancel={() => setPageEditing(undefined)}
          onSave={handleDocumentSave}
        />
      )}
    </Row>
  );
};
