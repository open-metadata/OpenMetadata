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

/* eslint-disable openmetadata-imports/no-lower-layer-page-imports -- shared settings widget reused here */
import {
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  PaginationCardWithControls,
  Typography,
} from '@openmetadata/ui-core-components';
import { GlossaryTerm as GlossaryTermIcon } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CreatePlaceholder from '../../../../../../components/common/EmptyPlaceholder/CreatePlaceholder';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../../../constants/constants';
import { RelationshipType } from '../../../../../../generated/entity/data/relationshipType';
import RelationshipTypeTable from '../../../../../../pages/GlossaryTermRelationSettings/RelationshipTypeTable';
import { getRelationTypeUsageCounts } from '../../../../../../rest/glossaryAPI';
import {
  deleteRelationshipType,
  listRelationshipTypes,
} from '../../../../../../rest/ontologyAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { GovernanceView } from './Governance.types';

const FETCH_PAGE_SIZE = 1000;
const PAGE_SIZE_OPTIONS = [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE];

const fetchAll = async (): Promise<RelationshipType[]> => {
  const result: RelationshipType[] = [];
  let after: string | undefined;

  do {
    // eslint-disable-next-line openmetadata-imports/no-api-calls-in-iteration -- sequential page walk
    const response = await listRelationshipTypes({
      fields: 'owners,reviewers',
      limit: FETCH_PAGE_SIZE,
      ...(after ? { after } : {}),
    });
    result.push(...response.data);
    after = response.paging.after;
  } while (after);

  return result;
};

interface GovernanceGlossaryListProps {
  onNavigate: (view: GovernanceView) => void;
}

const GovernanceGlossaryList: FC<GovernanceGlossaryListProps> = ({
  onNavigate,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [items, setItems] = useState<RelationshipType[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [deleteTarget, setDeleteTarget] = useState<RelationshipType>();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedItems, usageResponse] = await Promise.all([
        fetchAll(),
        getRelationTypeUsageCounts(),
      ]);
      setItems(fetchedItems);
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
    void fetchData();
  }, [fetchData]);

  const visibleItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;

    return items.slice(start, start + pageSize);
  }, [currentPage, pageSize, items]);

  const totalPages = Math.max(Math.ceil(items.length / pageSize), 1);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    setIsSaving(true);
    try {
      await deleteRelationshipType(deleteTarget.id);
      const updated = items.filter((item) => item.id !== deleteTarget.id);
      setItems(updated);
      setCurrentPage((p) =>
        Math.min(p, Math.max(Math.ceil(updated.length / pageSize), 1))
      );
      setDeleteTarget(undefined);
      showSuccessToast(
        t('server.entity-deleted-success', { entity: t('label.relation-type') })
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.delete-entity-error', { entity: t('label.relation-type') })
      );
    } finally {
      setIsSaving(false);
    }
  }, [deleteTarget, items, pageSize, t]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="tw:py-8 tw:text-center tw:text-sm tw:text-tertiary">
          {t('label.loading')}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="tw:relative tw:min-h-90">
          <CreatePlaceholder
            data-testid="glossary-relations-empty"
            description={t('message.no-glossary-term-relation-yet-description')}
            icon={<GlossaryTermIcon className="tw:text-fg-brand-primary" />}
            title={t('message.no-glossary-term-relation-yet')}
          />
        </div>
      );
    }

    return (
      <div className="tw:pt-0.25">
        <RelationshipTypeTable
          isAdminUser
          relationshipTypes={visibleItems}
          usageCounts={usageCounts}
          onDelete={setDeleteTarget}
          onEdit={(item) =>
            onNavigate({ type: 'glossary-edit', name: item.name })
          }
        />
        {items.length > PAGE_SIZE_BASE ? (
          <PaginationCardWithControls
            page={currentPage}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            total={totalPages}
            onPageChange={setCurrentPage}
            onPageSizeChange={(next) => {
              setPageSize(next);
              setCurrentPage(1);
            }}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="tw:flex tw:flex-col tw:gap-4 tw:p-8 tw:pt-0">
      {renderContent()}

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
  );
};

export default GovernanceGlossaryList;
