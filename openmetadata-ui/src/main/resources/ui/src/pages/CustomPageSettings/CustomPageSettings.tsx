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
import { Button, Col, Row, Space, Tooltip } from 'antd';
import Card from 'antd/lib/card/Card';
import { ColumnsType } from 'antd/lib/table';
import { ReactComponent as IconDelete } from 'assets/svg/ic-delete.svg';
import { ReactComponent as IconEdit } from 'assets/svg/ic-edit.svg';
import DeleteWidgetModal from 'components/common/DeleteWidget/DeleteWidgetModal';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Table from 'components/common/Table/Table';
import { AddEditCustomizePage } from 'components/CustomizablePages/AddEditCustomizePages/AddEditCustomizePage.component';
import PageHeader from 'components/header/PageHeader.component';
import { ADMIN_ONLY_ACTION } from 'constants/HelperTextUtil';
import { PAGE_HEADERS } from 'constants/PageHeaders.constant';
import { EntityType } from 'enums/entity.enum';
import { Document } from 'generated/entity/docStore/document';
import { Persona } from 'generated/entity/teams/persona';
import { PageType } from 'generated/system/ui/page';
import { useAuth } from 'hooks/authHooks';
import { usePaging } from 'hooks/paging/usePaging';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { getAllKnowledgePanels } from 'rest/DocStoreAPI';
import { getAllPersonas } from 'rest/PersonaAPI';
import { getEntityName } from 'utils/EntityUtils';
import { getCustomisePagePath } from 'utils/GlobalSettingsUtils';

export const CustomPageSettings = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const [pageEditing, setPageEditing] = useState<Document>();
  const [isLoading, setIsLoading] = useState(true);
  const [pages, setPages] = useState<Document[]>();
  const [personas, setPersonas] = useState<Persona[]>();
  const [deletingKnowledgePanel, setDeletingKnowledgePanel] =
    useState<Document>();
  const {
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    pageSize,
    paging,
    handlePagingChange,
  } = usePaging();

  const fetchPages = useCallback(async () => {
    const { data, paging } = await getAllKnowledgePanels({
      fqnPrefix: 'KnowledgePanel',
    });
    setPages(data);
    handlePagingChange(paging);
    setIsLoading(false);
  }, []);

  const fetchPersonas = async () => {
    const { data } = await getAllPersonas({});
    setPersonas(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPages();
    fetchPersonas();
  }, []);

  const handleAddNewPage = () => {
    setPageEditing({} as Document);
  };

  const columns: ColumnsType<Document> = useMemo(() => {
    return [
      {
        title: t('label.document'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('label.display-name'),
        dataIndex: 'displayName',
        key: 'displayName',
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (description: string) => (
          <RichTextEditorPreviewer markdown={description} />
        ),
      },
      {
        title: t('label.entity'),
        dataIndex: 'entityType',
        key: 'entityType',
        render: (description: string) => (
          <RichTextEditorPreviewer markdown={description} />
        ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        width: 90,
        render: (_, record) => (
          <Space
            align="center"
            className="w-full justify-center action-icons"
            size={8}>
            <Tooltip
              placement="left"
              title={
                isAdminUser
                  ? t('label.edit')
                  : t('message.no-permission-for-action')
              }>
              <Button
                className="flex-center"
                data-testid={`edit-action-${getEntityName(record)}`}
                disabled={!isAdminUser}
                icon={<IconEdit width="16px" />}
                type="text"
                onClick={() => setPageEditing(record)}
              />
            </Tooltip>
            <Tooltip placement="left" title={!isAdminUser && ADMIN_ONLY_ACTION}>
              <Button
                disabled={!isAdminUser}
                icon={
                  <IconDelete
                    data-testid={`delete-user-btn-${getEntityName(record)}`}
                    name={t('label.delete')}
                    width="16px"
                  />
                }
                size="small"
                type="text"
                onClick={() => {
                  setDeletingKnowledgePanel(record);
                }}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];
  }, []);

  const handleDocumentSave = () => {
    setPageEditing(undefined);
    fetchPages();
  };

  const handleCustomisePersona = (persona: Persona) => {
    if (persona.fullyQualifiedName) {
      history.push(
        getCustomisePagePath(persona.fullyQualifiedName, PageType.LandingPage)
      );
    }
  };

  return (
    <Row
      className="user-listing p-b-md"
      data-testid="user-list-v1-component"
      gutter={[16, 16]}>
      <Col span={18}>
        <PageHeader data={PAGE_HEADERS.CUSTOM_PAGE} />
      </Col>
      <Col span={6}>
        <Space align="center" className="w-full justify-end" size={16}>
          <Button
            data-testid="add-user"
            type="primary"
            onClick={handleAddNewPage}>
            {t('label.add-entity', { entity: t('label.custom-page') })}
          </Button>
        </Space>
      </Col>

      <Col span={24}>
        <Table
          bordered
          className="user-list-table"
          columns={columns}
          data-testid="user-list-table"
          dataSource={pages}
          loading={isLoading}
          // locale={{
          //   emptyText: errorPlaceHolder,
          // }}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </Col>
      <Col span={24}>
        <NextPrevious
          currentPage={currentPage}
          pageSize={pageSize}
          paging={paging}
          pagingHandler={({ currentPage }) => handlePageChange(currentPage)}
          onShowSizeChange={handlePageSizeChange}
        />
      </Col>

      {personas?.map((persona) => (
        <Col key={persona.id} span={8}>
          <Card
            extra={
              <Button onClick={() => handleCustomisePersona(persona)}>
                {t('label.customise')}
              </Button>
            }
            title={getEntityName(persona)}>
            {persona.description}
          </Card>
        </Col>
      ))}
      {pageEditing && (
        <AddEditCustomizePage
          page={pageEditing}
          onCancel={() => setPageEditing(undefined)}
          onSave={handleDocumentSave}
        />
      )}
      {deletingKnowledgePanel && (
        <DeleteWidgetModal
          afterDeleteAction={fetchPages}
          allowSoftDelete={false}
          entityId={deletingKnowledgePanel?.id ?? ''}
          entityName={deletingKnowledgePanel?.name ?? ''}
          entityType={EntityType.DOC_STORE}
          prepareType={false}
          visible={Boolean(deletingKnowledgePanel)}
          onCancel={() => {
            setDeletingKnowledgePanel(undefined);
          }}
        />
      )}
    </Row>
  );
};
