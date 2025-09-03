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
import { Button, Skeleton } from 'antd';
import Card from 'antd/lib/card/Card';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../../components/common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../components/common/NextPrevious/NextPrevious.interface';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { AddEditPersonaForm } from '../../../components/MyData/Persona/AddEditPersona/AddEditPersona.component';
import { PersonaDetailsCard } from '../../../components/MyData/Persona/PersonaDetailsCard/PersonaDetailsCard';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { TabSpecificField } from '../../../enums/entity.enum';
import { CursorType } from '../../../enums/pagination.enum';
import { Persona } from '../../../generated/entity/teams/persona';
import { Paging } from '../../../generated/type/paging';
import { useAuth } from '../../../hooks/authHooks';
import { usePaging } from '../../../hooks/paging/usePaging';
import { getAllPersonas } from '../../../rest/PersonaAPI';
import { getSettingPageEntityBreadCrumb } from '../../../utils/GlobalSettingsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './persona-page.less';

const PERSONA_PAGE_SIZE = 12;

export const PersonaPage = ({ pageTitle }: { pageTitle: string }) => {
  const { isAdminUser } = useAuth();
  const { t } = useTranslation();
  const [persona, setPersona] = useState<Persona[]>();

  const [addEditPersona, setAddEditPersona] = useState<Persona>();

  const [isLoading, setIsLoading] = useState(false);
  const {
    currentPage,
    handlePageChange,
    handlePagingChange,
    pageSize,
    paging,
    pagingCursor,
    showPagination,
  } = usePaging(PERSONA_PAGE_SIZE);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () => getSettingPageEntityBreadCrumb(GlobalSettingsMenuCategory.PERSONA),
    []
  );

  const fetchPersonas = useCallback(
    async (params?: Partial<Paging>) => {
      try {
        setIsLoading(true);
        const { data, paging } = await getAllPersonas({
          limit: pageSize,
          fields: TabSpecificField.USERS,
          after: params?.after,
          before: params?.before,
        });

        setPersona(data);
        handlePagingChange(paging);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize, handlePagingChange]
  );

  // Initial load and when URL params change
  useEffect(() => {
    const cursorValue = pagingCursor.cursorValue;
    const cursorType = pagingCursor.cursorType as CursorType;

    if (cursorType && cursorValue) {
      fetchPersonas({ [cursorType]: cursorValue });
    } else {
      fetchPersonas();
    }
  }, [
    pagingCursor.cursorType,
    pagingCursor.cursorValue,
    pageSize,
    fetchPersonas,
  ]);

  const handleAddNewPersona = useCallback(() => {
    setAddEditPersona({} as Persona);
  }, []);

  const errorPlaceHolder = useMemo(
    () => (
      <div className="h-full text-center w-full p-x-box">
        <ErrorPlaceHolder
          buttonId="add-persona-button"
          className="border-none"
          heading={t('label.persona')}
          permission={isAdminUser}
          permissionValue={t('label.create-entity', {
            entity: t('label.persona'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.CREATE}
          onClick={handleAddNewPersona}
        />
      </div>
    ),
    [isAdminUser]
  );

  const handlePersonalAddEditCancel = useCallback(() => {
    setAddEditPersona(undefined);
  }, []);

  const handlePersonaAddEditSave = useCallback(() => {
    handlePersonalAddEditCancel();
    fetchPersonas({ [CursorType.AFTER]: paging[CursorType.AFTER] });
  }, [fetchPersonas, paging]);

  const handlePersonaPageChange = useCallback(
    ({ currentPage, cursorType }: PagingHandlerParams) => {
      const cursorValue = cursorType ? paging[cursorType] : undefined;
      handlePageChange(currentPage, {
        cursorType: cursorType as CursorType,
        cursorValue,
      });
      if (cursorType && cursorValue) {
        fetchPersonas({ [cursorType]: cursorValue });
      }
    },
    [handlePageChange, fetchPersonas, paging]
  );

  if (isEmpty(persona) && !isLoading) {
    return (
      <div className="flex-center full-height">
        {errorPlaceHolder}
        {Boolean(addEditPersona) && (
          <AddEditPersonaForm
            persona={addEditPersona}
            onCancel={handlePersonalAddEditCancel}
            onSave={handlePersonaAddEditSave}
          />
        )}
      </div>
    );
  }

  return (
    <PageLayoutV1
      mainContainerClassName="persona-main-container"
      pageTitle={pageTitle}>
      <div className="h-full d-flex flex-col">
        <div className="d-flex flex-col m-b-md">
          <div className="m-b-md">
            <TitleBreadcrumb titleLinks={breadcrumbs} />
          </div>
          <div className="d-flex justify-between align-center">
            <div className="flex-1">
              <PageHeader data={PAGE_HEADERS.PERSONAS} />
            </div>
            <div>
              <Button
                data-testid="add-persona-button"
                type="primary"
                onClick={handleAddNewPersona}>
                {t('label.add-entity', { entity: t('label.persona') })}
              </Button>
            </div>
          </div>
        </div>

        {/* Main content area with flex-grow to take remaining space */}
        <div className="d-flex flex-col justify-between flex-1">
          {/* Persona cards section */}
          <div className="persona-cards-grid">
            {isLoading
              ? [1, 2, 3].map((key) => (
                  <div className="skeleton-card-item" key={key}>
                    <Card>
                      <Skeleton active paragraph title />
                    </Card>
                  </div>
                ))
              : persona?.map((persona) => (
                  <div className="persona-card-item" key={persona.id}>
                    <div className="w-full h-full">
                      <PersonaDetailsCard persona={persona} />
                    </div>
                  </div>
                ))}
          </div>

          {/* Pagination at bottom of page */}
          {showPagination && (
            <div className="d-flex justify-center align-center m-b-sm m-t-sm">
              <NextPrevious
                currentPage={currentPage}
                isLoading={isLoading}
                pageSize={pageSize}
                paging={paging}
                pagingHandler={handlePersonaPageChange}
              />
            </div>
          )}
        </div>

        {Boolean(addEditPersona) && (
          <AddEditPersonaForm
            persona={addEditPersona}
            onCancel={handlePersonalAddEditCancel}
            onSave={handlePersonaAddEditSave}
          />
        )}
      </div>
    </PageLayoutV1>
  );
};
