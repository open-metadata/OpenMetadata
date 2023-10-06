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
import { Button, Col, Row, Skeleton, Space } from 'antd';
import Card from 'antd/lib/card/Card';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DeleteWidgetModal from '../../../components/common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../../../components/common/next-previous/NextPrevious';
import PageHeader from '../../../components/header/PageHeader.component';
import { AddEditPersonaForm } from '../../../components/Persona/AddEditPersona/AddEditPersona.component';
import { PersonaDetailsCard } from '../../../components/Persona/PersonaDetailsCard/PersonaDetailsCard';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { Persona } from '../../../generated/entity/teams/persona';
import { useAuth } from '../../../hooks/authHooks';
import { usePaging } from '../../../hooks/paging/usePaging';
import { getAllPersonas } from '../../../rest/PersonaAPI';
import { showPagination } from '../../../utils/CommonUtils';

export const PersonaPage = () => {
  const { isAdminUser } = useAuth();
  const { t } = useTranslation();

  const [persona, setPersona] = useState<Persona[]>();

  const [addEditPersona, setAddEditPersona] = useState<Persona>();

  const [isLoading, setIsLoading] = useState(false);

  const [personaDeleting, setPersonaDeleting] = useState<Persona>();
  const {
    currentPage,
    handlePageChange,
    pageSize,
    handlePageSizeChange,
    paging,
    handlePagingChange,
  } = usePaging();

  const fetchPersonas = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, paging } = await getAllPersonas({
        limit: pageSize,
        fields: 'users',
      });

      setPersona(data);
      handlePagingChange(paging);
    } catch (error) {
      // Error
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersonas();
  }, []);

  const handleAddNewPersona = () => {
    setAddEditPersona({} as Persona);
  };

  //   const columns: ColumnsType<Persona> = useMemo(() => {
  //     return [
  //       {
  //         title: t('label.persona'),
  //         dataIndex: 'name',
  //         key: 'name',
  //         render: (name: string, record: Persona) => (
  //           <Link
  //             to={getSettingsPathWithFqn(
  //               GlobalSettingsMenuCategory.MEMBERS,
  //               GlobalSettingOptions.PERSONA,
  //               record.fullyQualifiedName ?? ''
  //             )}>
  //             {name}
  //           </Link>
  //         ),
  //       },
  //       {
  //         title: t('label.display-name'),
  //         dataIndex: 'displayName',
  //         key: 'displayName',
  //       },
  //       {
  //         title: t('label.description'),
  //         dataIndex: 'description',
  //         key: 'description',
  //         render: (description: string) => (
  //           <RichTextEditorPreviewer
  //             className="max-two-lines"
  //             markdown={description}
  //           />
  //         ),
  //       },
  //       {
  //         title: t('label.action-plural'),
  //         dataIndex: 'actions',
  //         key: 'actions',
  //         width: 90,
  //         render: (_, record) => (
  //           <Space
  //             align="center"
  //             className="w-full justify-center action-icons"
  //             size={8}>
  //             <Tooltip
  //               placement="left"
  //               title={
  //                 isAdminUser
  //                   ? t('label.edit')
  //                   : t('message.no-permission-for-action')
  //               }>
  //               <Button
  //                 className="flex-center"
  //                 data-testid={`edit-action-${getEntityName(record)}`}
  //                 disabled={!isAdminUser}
  //                 icon={<IconEdit width="16px" />}
  //                 type="text"
  //                 onClick={() => setAddEditPersona(record)}
  //               />
  //             </Tooltip>
  //             <Tooltip placement="left" title={!isAdminUser && ADMIN_ONLY_ACTION}>
  //               <Button
  //                 disabled={!isAdminUser}
  //                 icon={
  //                   <IconDelete
  //                     data-testid={`delete-user-btn-${getEntityName(record)}`}
  //                     name={t('label.delete')}
  //                     width="16px"
  //                   />
  //                 }
  //                 size="small"
  //                 type="text"
  //                 onClick={() => {
  //                   setPersonaDeleting(record);
  //                 }}
  //               />
  //             </Tooltip>
  //           </Space>
  //         ),
  //       },
  //     ];
  //   }, []);

  const errorPlaceHolder = useMemo(
    () => (
      <Col className="mt-24 text-center" span={24}>
        <ErrorPlaceHolder
          heading={t('label.persona')}
          permission={isAdminUser}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
          onClick={handleAddNewPersona}
        />
      </Col>
    ),
    [isAdminUser]
  );

  const handlePersonalAddEditCancel = () => {
    setAddEditPersona(undefined);
  };

  const handlePersonaAddEditSave = () => {
    handlePersonalAddEditCancel();
    fetchPersonas();
  };

  const handlePersonaEdit = (editPersona: Persona) => {
    setAddEditPersona(editPersona);
  };

  return (
    <Row
      className="user-listing p-b-md"
      data-testid="user-list-v1-component"
      gutter={[16, 16]}>
      <Col span={18}>
        <PageHeader data={PAGE_HEADERS.PERSONAS} />
      </Col>
      <Col span={6}>
        <Space align="center" className="w-full justify-end" size={16}>
          <Button
            data-testid="add-user"
            type="primary"
            onClick={handleAddNewPersona}>
            {t('label.add-entity', { entity: t('label.persona') })}
          </Button>
        </Space>
      </Col>

      {isLoading &&
        [1, 2, 3].map((key) => (
          <Col key={key} span={8}>
            <Card>
              <Skeleton active paragraph title />
            </Card>
          </Col>
        ))}

      {isEmpty(persona) && !isLoading && errorPlaceHolder}

      {persona?.map((persona) => (
        <Col key={persona.id} span={8}>
          <PersonaDetailsCard persona={persona} onEdit={handlePersonaEdit} />
        </Col>
      ))}

      {/* <Col span={24}>
        <Table
          bordered
          className="user-list-table"
          columns={columns}
          data-testid="user-list-table"
          dataSource={persona}
          loading={isLoading}
          locale={{
            emptyText: errorPlaceHolder,
          }}
          pagination={false}
          rowKey="id"
          size="small"
        />
      </Col> */}
      {showPagination(paging) && (
        <Col span={24}>
          <NextPrevious
            currentPage={currentPage}
            pageSize={pageSize}
            paging={paging}
            pagingHandler={({ currentPage }) => handlePageChange(currentPage)}
            onShowSizeChange={handlePageSizeChange}
          />
        </Col>
      )}

      {Boolean(addEditPersona) && (
        <AddEditPersonaForm
          persona={addEditPersona}
          onCancel={handlePersonalAddEditCancel}
          onSave={handlePersonaAddEditSave}
        />
      )}

      <DeleteWidgetModal
        afterDeleteAction={fetchPersonas}
        allowSoftDelete={false}
        entityId={personaDeleting?.id ?? ''}
        entityName={personaDeleting?.name ?? ''}
        entityType={EntityType.PERSONA}
        visible={Boolean(personaDeleting)}
        onCancel={() => {
          setPersonaDeleting(undefined);
        }}
      />
    </Row>
  );
};
