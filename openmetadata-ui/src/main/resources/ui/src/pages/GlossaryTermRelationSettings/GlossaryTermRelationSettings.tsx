/*
 *  Copyright 2026 Collate.
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

import {
  Button,
  Card,
  Dialog,
  Divider,
  Modal,
  ModalOverlay,
  PaginationCardWithControls,
  SlideoutMenu,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { RelationshipType } from '../../generated/entity/data/relationshipType';
import { useAuth } from '../../hooks/authHooks';
import { getRelationTypeUsageCounts } from '../../rest/glossaryAPI';
import {
  createRelationshipType,
  deleteRelationshipType,
  listRelationshipTypes,
  updateRelationshipType,
} from '../../rest/ontologyAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import RelationshipTypeForm from './RelationshipTypeForm';
import {
  DEFAULT_RELATIONSHIP_TYPE_FORM,
  RelationshipTypeFormValues,
  toRelationshipTypeForm,
  toRelationshipTypeRequest,
} from './RelationshipTypeForm.utils';
import { validateRelationshipTypeForm } from './RelationshipTypeForm.validation';
import RelationshipTypeTable from './RelationshipTypeTable';

const RELATIONSHIP_TYPE_FETCH_PAGE_SIZE = 1000;
const RELATIONSHIP_TYPE_FIELDS = 'owners,reviewers';
const PAGE_SIZE_OPTIONS = [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE];

const GlossaryTermRelationSettingsPage = () => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [relationshipTypes, setRelationshipTypes] = useState<
    RelationshipType[]
  >([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRelationshipType, setEditingRelationshipType] =
    useState<RelationshipType>();
  const [deleteTarget, setDeleteTarget] = useState<RelationshipType>();
  const [formValues, setFormValues] = useState<RelationshipTypeFormValues>(
    DEFAULT_RELATIONSHIP_TYPE_FORM
  );
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.GOVERNANCE,
        t('label.glossary-term-relation-plural')
      ),
    [t]
  );
  const visibleRelationshipTypes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return relationshipTypes.slice(start, start + pageSize);
  }, [currentPage, pageSize, relationshipTypes]);
  const totalPages = Math.max(
    Math.ceil(relationshipTypes.length / pageSize),
    1
  );

  const fetchRelationshipTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedRelationshipTypes, usageResponse] = await Promise.all([
        fetchAllRelationshipTypes(),
        getRelationTypeUsageCounts(),
      ]);
      setRelationshipTypes(fetchedRelationshipTypes);
      setUsageCounts(usageResponse);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.glossary-term-relation-plural'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchRelationshipTypes();
  }, [fetchRelationshipTypes]);

  const openCreateForm = useCallback(() => {
    setEditingRelationshipType(undefined);
    setFormValues(DEFAULT_RELATIONSHIP_TYPE_FORM);
    setFormErrors({});
    setIsFormOpen(true);
  }, []);

  const openEditForm = useCallback((relationshipType: RelationshipType) => {
    if (relationshipType.systemDefined) {
      return;
    }
    setEditingRelationshipType(relationshipType);
    setFormValues(toRelationshipTypeForm(relationshipType));
    setFormErrors({});
    setIsFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setEditingRelationshipType(undefined);
    setFormValues(DEFAULT_RELATIONSHIP_TYPE_FORM);
    setFormErrors({});
    setIsFormOpen(false);
  }, []);

  const validateForm = useCallback(() => {
    const errors = validateRelationshipTypeForm(
      formValues,
      editingRelationshipType,
      relationshipTypes,
      t
    );
    setFormErrors(errors);

    return Object.keys(errors).length === 0;
  }, [editingRelationshipType, formValues, relationshipTypes, t]);

  const saveValidRelationshipType = useCallback(async () => {
    setIsSaving(true);
    try {
      const request = toRelationshipTypeRequest(formValues);
      const saved = editingRelationshipType
        ? await updateRelationshipType(request)
        : await createRelationshipType(request);
      const updatedRelationshipTypes = upsertRelationshipType(
        relationshipTypes,
        saved
      );
      setRelationshipTypes(updatedRelationshipTypes);
      setCurrentPage(
        getRelationshipTypePage(updatedRelationshipTypes, saved.id, pageSize)
      );
      closeForm();
      showSuccessToast(
        t(
          editingRelationshipType
            ? 'server.update-entity-success'
            : 'server.create-entity-success',
          { entity: t('label.relation-type') }
        )
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.update-entity-error', {
          entity: t('label.relation-type'),
        })
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    closeForm,
    editingRelationshipType,
    formValues,
    pageSize,
    relationshipTypes,
    t,
  ]);

  const saveRelationshipType = useCallback(async () => {
    const isValid = validateForm();
    if (isValid) {
      await saveValidRelationshipType();
    }
  }, [saveValidRelationshipType, validateForm]);

  const deleteSelectedRelationshipType = useCallback(
    async (selectedRelationshipType: RelationshipType) => {
      setIsSaving(true);
      try {
        await deleteRelationshipType(selectedRelationshipType.id);
        const updatedRelationshipTypes = relationshipTypes.filter(
          (relationshipType) =>
            relationshipType.id !== selectedRelationshipType.id
        );
        setRelationshipTypes(updatedRelationshipTypes);
        setCurrentPage((page) =>
          clampPage(page, updatedRelationshipTypes.length, pageSize)
        );
        setDeleteTarget(undefined);
        showSuccessToast(
          t('server.entity-deleted-success', {
            entity: t('label.relation-type'),
          })
        );
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.delete-entity-error', {
            entity: t('label.relation-type'),
          })
        );
      } finally {
        setIsSaving(false);
      }
    },
    [pageSize, relationshipTypes, t]
  );

  const confirmDelete = useCallback(async () => {
    if (deleteTarget) {
      await deleteSelectedRelationshipType(deleteTarget);
    }
  }, [deleteSelectedRelationshipType, deleteTarget]);

  return (
    <PageLayoutV1 pageTitle={t('label.glossary-term-relation-plural')}>
      <div className="tw:flex tw:w-full tw:min-w-0 tw:flex-col tw:gap-4">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
        <Card className="tw:flex tw:items-center tw:justify-between tw:p-6">
          <div className="tw:flex tw:flex-col tw:gap-1">
            <Typography as="h4" className="tw:font-semibold">
              {t('label.glossary-term-relation-plural')}
            </Typography>
            <Typography as="p" className="tw:text-secondary" size="text-xs">
              {t('message.glossary-term-relation-settings-description')}
            </Typography>
          </div>
          {isAdminUser ? (
            <Button
              color="primary"
              data-testid="add-relation-type-btn"
              size="sm"
              onClick={openCreateForm}>
              {t('label.add-entity', { entity: t('label.relation-type') })}
            </Button>
          ) : null}
        </Card>

        {isLoading ? (
          <div className="tw:py-8 tw:text-center tw:text-sm tw:text-tertiary">
            {t('label.loading')}
          </div>
        ) : (
          <>
            <RelationshipTypeTable
              isAdminUser={Boolean(isAdminUser)}
              relationshipTypes={visibleRelationshipTypes}
              usageCounts={usageCounts}
              onDelete={setDeleteTarget}
              onEdit={openEditForm}
            />
            {relationshipTypes.length > PAGE_SIZE_BASE ? (
              <PaginationCardWithControls
                page={currentPage}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                total={totalPages}
                onPageChange={setCurrentPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setCurrentPage(1);
                }}
              />
            ) : null}
          </>
        )}

        <SlideoutMenu
          aria-label={t(
            editingRelationshipType ? 'label.edit-entity' : 'label.add-entity',
            { entity: t('label.relation-type') }
          )}
          data-testid="relation-type-drawer"
          dialogClassName="tw:overflow-hidden!"
          isOpen={isFormOpen}
          width={500}
          onOpenChange={(open) => !open && closeForm()}>
          {() => (
            <>
              <SlideoutMenu.Header onClose={closeForm}>
                <Typography as="h4">
                  {t(
                    editingRelationshipType
                      ? 'label.edit-entity'
                      : 'label.add-entity',
                    { entity: t('label.relation-type') }
                  )}
                </Typography>
              </SlideoutMenu.Header>
              <Divider orientation="horizontal" />
              <SlideoutMenu.Content className="tw:min-h-0 tw:flex-1">
                <RelationshipTypeForm
                  errors={formErrors}
                  isEditing={Boolean(editingRelationshipType)}
                  values={formValues}
                  onChange={(values) => {
                    setFormValues(values);
                    setFormErrors({});
                  }}
                />
              </SlideoutMenu.Content>
              <SlideoutMenu.Footer>
                <div className="tw:flex tw:w-full tw:justify-end tw:gap-2">
                  <Button
                    color="secondary"
                    data-testid="cancel-btn"
                    size="sm"
                    onClick={closeForm}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary"
                    data-testid="save-btn"
                    isLoading={isSaving}
                    size="sm"
                    onClick={saveRelationshipType}>
                    {editingRelationshipType
                      ? t('label.update')
                      : t('label.add')}
                  </Button>
                </div>
              </SlideoutMenu.Footer>
            </>
          )}
        </SlideoutMenu>

        <ModalOverlay
          isDismissable
          isOpen={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(undefined)}>
          <Modal>
            <Dialog
              showCloseButton
              data-testid="delete-relation-type-confirmation"
              title={t('label.delete-entity', {
                entity: t('label.relation-type'),
              })}
              width={480}
              onClose={() => setDeleteTarget(undefined)}>
              <Dialog.Content>
                <Typography className="tw:text-tertiary" size="text-sm">
                  {t('message.delete-entity-message', {
                    entity: deleteTarget?.displayName,
                  })}
                </Typography>
              </Dialog.Content>
              <Dialog.Footer>
                <div className="tw:col-span-2 tw:flex tw:justify-end tw:gap-3">
                  <Button
                    color="tertiary"
                    size="sm"
                    onPress={() => setDeleteTarget(undefined)}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    color="primary-destructive"
                    data-testid="confirm-delete-btn"
                    isLoading={isSaving}
                    size="sm"
                    onPress={confirmDelete}>
                    {t('label.delete')}
                  </Button>
                </div>
              </Dialog.Footer>
            </Dialog>
          </Modal>
        </ModalOverlay>
      </div>
    </PageLayoutV1>
  );
};

const fetchAllRelationshipTypes = async (): Promise<RelationshipType[]> => {
  const relationshipTypes: RelationshipType[] = [];
  let after: string | undefined;

  do {
    const response = await listRelationshipTypes({
      fields: RELATIONSHIP_TYPE_FIELDS,
      limit: RELATIONSHIP_TYPE_FETCH_PAGE_SIZE,
      ...(after ? { after } : {}),
    });
    relationshipTypes.push(...response.data);
    after = response.paging.after;
  } while (after);

  return relationshipTypes;
};

const getRelationshipTypePage = (
  relationshipTypes: RelationshipType[],
  relationshipTypeId: string,
  pageSize: number
): number => {
  const index = relationshipTypes.findIndex(
    (relationshipType) => relationshipType.id === relationshipTypeId
  );

  return Math.floor(Math.max(index, 0) / pageSize) + 1;
};

const clampPage = (
  currentPage: number,
  relationshipTypeCount: number,
  pageSize: number
): number =>
  Math.min(
    currentPage,
    Math.max(Math.ceil(relationshipTypeCount / pageSize), 1)
  );

const upsertRelationshipType = (
  current: RelationshipType[],
  saved: RelationshipType
): RelationshipType[] => {
  const exists = current.some(
    (relationshipType) => relationshipType.id === saved.id
  );
  const updated = exists
    ? current.map((relationshipType) =>
        relationshipType.id === saved.id ? saved : relationshipType
      )
    : [...current, saved];

  return updated.sort((left, right) => left.name.localeCompare(right.name));
};

export default GlossaryTermRelationSettingsPage;
