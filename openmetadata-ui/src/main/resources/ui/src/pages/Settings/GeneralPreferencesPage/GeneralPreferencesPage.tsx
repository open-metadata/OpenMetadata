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
  Box,
  Button,
  Card,
  Select,
  SelectItem,
  Typography,
} from '@openmetadata/ui-core-components';
import { Delete, PlusCircle } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { Key, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import { DefaultViewMode } from '../../../generated/api/configuration/appConfiguration';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../rest/settingConfigAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { ViewModeRow } from './GeneralPreferencesPage.types';
import {
  buildRowsFromViewModes,
  buildViewModesMap,
  DOMAIN_PAGE_ID,
  generateRowId,
  getViewOptionsForPage,
  PAGE_OPTIONS,
  serializeViewModes,
} from './GeneralPreferencesPage.utils';

const GeneralPreferencesPage: React.FC = () => {
  const { t } = useTranslation();
  const { setDefaultViewModes } = useApplicationStore();
  const pageTitle = t('label.general-preferences');
  const [initialRows, setInitialRows] = useState<ViewModeRow[]>([]);
  const [rows, setRows] = useState<ViewModeRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingViewModes, setIsSavingViewModes] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getAppConfiguration()
      .then((config) => {
        if (!isMounted) {
          return;
        }
        const viewModeRows = buildRowsFromViewModes(config?.defaultViewModes);
        setInitialRows(viewModeRows);
        setRows(viewModeRows);
      })
      .catch((error: AxiosError) => showErrorToast(error))
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isViewModesDirty =
    serializeViewModes(buildViewModesMap(rows)) !==
    serializeViewModes(buildViewModesMap(initialRows));
  // A row with only a page or only a view set is dropped silently by
  // `buildViewModesMap` — saving while one exists would submit a map that's
  // missing that row's (and possibly a previously-saved) entry without any
  // indication to the admin.
  const hasIncompleteRow = rows.some(
    (row) => Boolean(row.page) !== Boolean(row.view)
  );

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      { id: generateRowId(), page: null, view: null },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleRowPageChange = (id: string, page: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) {
          return row;
        }
        // Tree is only a valid view for the domains page — switching a row
        // away from domains would otherwise leave a stale Tree value silently
        // attached to a page whose toggle doesn't offer it.
        const view =
          page !== DOMAIN_PAGE_ID && row.view === DefaultViewMode.Tree
            ? null
            : row.view;

        return { ...row, page, view };
      })
    );
  };

  const handleRowViewChange = (id: string, view: DefaultViewMode) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, view } : row))
    );
  };

  const handleSaveViewModes = async () => {
    setIsSavingViewModes(true);
    try {
      const defaultViewModes = buildViewModesMap(rows);
      await patchAppConfiguration({ defaultViewModes });
      setInitialRows(rows);
      // Keeps the live store in sync so pages reading `defaultViewModes`
      // pick up the new tenant default without a reload.
      setDefaultViewModes(defaultViewModes);
      showSuccessToast(
        t('server.entity-updated-success', { entity: pageTitle })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingViewModes(false);
    }
  };

  return (
    <Box
      className="tw:p-6"
      data-testid="general-preferences-page"
      direction="col">
      <DocumentTitle title={pageTitle} />
      <Typography
        as="h1"
        className="not-prose tw:text-lg tw:font-semibold tw:mb-2">
        {pageTitle}
      </Typography>
      <Typography as="p" className="not-prose tw:text-secondary tw:mb-10">
        {t('message.general-preferences-description')}
      </Typography>
      <Card>
        <Card.Content>
          <Box
            className="tw:flex tw:flex-col tw:gap-3"
            data-testid="default-view-modes-section"
            direction="col">
            {rows.map((row) => {
              const otherSelectedPages = new Set(
                rows
                  .filter((otherRow) => otherRow.id !== row.id && otherRow.page)
                  .map((otherRow) => otherRow.page as string)
              );
              const pageItems = PAGE_OPTIONS.filter(
                (option) =>
                  option.id === row.page || !otherSelectedPages.has(option.id)
              ).map((option) => ({ id: option.id, label: t(option.labelKey) }));
              const viewItems = getViewOptionsForPage(row.page).map(
                (option) => ({
                  id: option.id,
                  label: t(option.labelKey),
                })
              );

              return (
                <Box
                  className="tw:flex tw:items-center tw:gap-2"
                  data-testid={`view-mode-row-${row.id}`}
                  key={row.id}>
                  <Select
                    aria-label={t('label.page')}
                    className="tw:flex-1 tw:min-w-0"
                    data-testid={`view-mode-row-page-${row.id}`}
                    items={pageItems}
                    placeholder={t('label.select-field', {
                      field: t('label.page'),
                    })}
                    selectedKey={row.page}
                    onSelectionChange={(key: Key | null) =>
                      key && handleRowPageChange(row.id, String(key))
                    }>
                    {(item) => <SelectItem id={item.id} label={item.label} />}
                  </Select>
                  <Select
                    aria-label={t('label.view')}
                    className="tw:flex-1 tw:min-w-0"
                    data-testid={`view-mode-row-view-${row.id}`}
                    items={viewItems}
                    placeholder={t('label.select-field', {
                      field: t('label.view'),
                    })}
                    selectedKey={row.view}
                    onSelectionChange={(key: Key | null) =>
                      key && handleRowViewChange(row.id, key as DefaultViewMode)
                    }>
                    {(item) => <SelectItem id={item.id} label={item.label} />}
                  </Select>
                  <Button
                    aria-label={t('label.remove')}
                    color="secondary"
                    data-testid={`remove-view-mode-row-${row.id}`}
                    iconLeading={Delete}
                    size="xs"
                    onPress={() => handleRemoveRow(row.id)}
                  />
                </Box>
              );
            })}
            <Box>
              <Button
                color="secondary"
                data-testid="add-view-mode-row"
                iconLeading={PlusCircle}
                isDisabled={rows.length >= PAGE_OPTIONS.length}
                size="xs"
                onPress={handleAddRow}>
                {t('label.add-field')}
              </Button>
            </Box>
          </Box>
        </Card.Content>
        <Card.Footer>
          <Button
            color="primary"
            data-testid="save-view-modes-settings"
            isDisabled={
              !isViewModesDirty ||
              hasIncompleteRow ||
              isLoading ||
              isSavingViewModes
            }
            isLoading={isSavingViewModes}
            onPress={handleSaveViewModes}>
            {t('label.save')}
          </Button>
        </Card.Footer>
      </Card>
    </Box>
  );
};

export default GeneralPreferencesPage;
