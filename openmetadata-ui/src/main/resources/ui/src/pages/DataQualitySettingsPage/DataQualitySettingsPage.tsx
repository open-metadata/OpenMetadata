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
  Badge,
  Box,
  Button,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
import { PlusCircle } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useFormDrawerWithHook } from '../../components/common/atoms/drawer';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import {
  DeleteIconButton,
  EditIconButton,
} from '../../components/common/IconButtons/EditIconButton';
import Loader from '../../components/common/Loader/Loader';
import Table from '../../components/common/Table/Table';
import { ColumnsType } from '../../components/common/Table/Table.interface';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { DIMENSION_COLOR_PALETTE } from '../../constants/DataQualityDimension.constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import {
  DataQualityDimension,
  ProviderType,
} from '../../generated/tests/dataQualityDimension';
import {
  createDataQualityDimension,
  deleteDataQualityDimension,
  getDataQualityDimensions,
  getDataQualityDimensionTestCaseCounts,
  getDataQualityDimensionTestDefinitionCounts,
  patchDataQualityDimension,
} from '../../rest/dataQualityDimensionAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { descriptionTableObject } from '../../utils/TableColumn.util';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './data-quality-settings-page.less';
import DeleteDimensionModal from './DeleteDimensionModal';
import DimensionForm, { type DimensionFormValues } from './DimensionForm';

const DEFAULT_COLOR = DIMENSION_COLOR_PALETTE[0];

const countFor = (
  counts: Record<string, number>,
  dimension?: DataQualityDimension
): number => counts[dimension?.id ?? ''] ?? 0;

const DataQualitySettingsPage = () => {
  const { t } = useTranslation();
  // react-hook-form rather than antd's: the drawer's hook variant drives validation and submit
  // off it, and the form fields are core-components inputs bound with Controller.
  const hookForm = useForm<DimensionFormValues>({
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      displayName: '',
      description: '',
      color: DEFAULT_COLOR,
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dimensions, setDimensions] = useState<DataQualityDimension[]>([]);
  const [testCaseCounts, setTestCaseCounts] = useState<Record<string, number>>(
    {}
  );
  // Test definitions reference a dimension by name rather than by relationship, so they are
  // counted separately — without them the delete confirmation reports no impact for a dimension
  // a dozen test definitions are classified under.
  const [testDefinitionCounts, setTestDefinitionCounts] = useState<
    Record<string, number>
  >({});
  const [searchTerm, setSearchTerm] = useState('');
  // `undefined` closes the drawer, `null` opens it in create mode.
  const [editing, setEditing] = useState<DataQualityDimension | null>();
  const [deleting, setDeleting] = useState<DataQualityDimension>();

  const breadcrumbs = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.data-quality')
      ),
    [t]
  );

  const fetchDimensions = useCallback(async () => {
    setIsLoading(true);
    try {
      const [{ data }, counts, definitionCounts] = await Promise.all([
        getDataQualityDimensions({ limit: 1000 }),
        // A missing count must not hide the dimension list itself.
        getDataQualityDimensionTestCaseCounts().catch(() => ({})),
        getDataQualityDimensionTestDefinitionCounts().catch(() => ({})),
      ]);
      setDimensions(data);
      setTestCaseCounts(counts);
      setTestDefinitionCounts(definitionCounts);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDimensions();
  }, [fetchDimensions]);

  const filteredDimensions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return dimensions;
    }

    return dimensions.filter((dimension) =>
      [dimension.name, dimension.displayName, dimension.description].some(
        (value) => value?.toLowerCase().includes(term)
      )
    );
  }, [dimensions, searchTerm]);

  // Fed to form.reset when the drawer opens: react-hook-form keeps one instance for the page, so
  // the values are pushed in rather than applied by remounting the form.
  const initialValues: DimensionFormValues = useMemo(
    () => ({
      name: editing?.name ?? '',
      displayName: editing?.displayName ?? '',
      description: editing?.description ?? '',
      color: editing?.style?.color ?? DEFAULT_COLOR,
    }),
    [editing]
  );

  const handleSave = useCallback(
    async (values: DimensionFormValues) => {
      setIsSaving(true);
      try {
        if (editing) {
          const updated: DataQualityDimension = {
            ...editing,
            displayName: values.displayName || undefined,
            description: values.description || undefined,
            style: { ...editing.style, color: values.color },
          };
          await patchDataQualityDimension(
            editing.id ?? '',
            compare(editing, updated)
          );
        } else {
          await createDataQualityDimension({
            name: values.name,
            displayName: values.displayName || undefined,
            description: values.description || undefined,
            style: { color: values.color },
          });
        }
        showSuccessToast(
          t(
            editing
              ? 'server.update-entity-success'
              : 'server.create-entity-success',
            { entity: t('label.dimension') }
          )
        );
        setEditing(undefined);
        await fetchDimensions();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSaving(false);
      }
    },
    [editing, fetchDimensions, t]
  );

  const handleDelete = useCallback(async () => {
    if (!deleting?.id) {
      return;
    }
    setIsSaving(true);
    try {
      await deleteDataQualityDimension(deleting.id);
      showSuccessToast(
        t('server.entity-deleted-successfully', {
          entity: t('label.dimension'),
        })
      );
      setDeleting(undefined);
      await fetchDimensions();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  }, [deleting, fetchDimensions, t]);

  const columns: ColumnsType<DataQualityDimension> = useMemo(
    () => [
      {
        title: t('label.dimension'),
        dataIndex: 'name',
        key: 'name',
        render: (name: string, record) => (
          <Box align="start" data-testid={`dimension-${name}`} gap={2}>
            <span
              className="dimension-color-dot"
              style={{ backgroundColor: record.style?.color ?? DEFAULT_COLOR }}
            />
            <Box direction="col">
              <Typography size="text-sm" weight="semibold">
                {record.displayName ?? name}
              </Typography>
              <Typography
                className="dimension-technical-name"
                color="secondary"
                size="text-xs">
                {name}
              </Typography>
            </Box>
          </Box>
        ),
      },
      ...descriptionTableObject<DataQualityDimension>(),
      {
        title: t('label.type'),
        dataIndex: 'provider',
        key: 'provider',
        width: '120px',
        render: (provider?: ProviderType) => (
          <Badge
            color={provider === ProviderType.System ? 'gray' : 'blue'}
            size="sm">
            {provider === ProviderType.System
              ? t('label.system')
              : t('label.custom')}
          </Badge>
        ),
      },
      {
        title: t('label.test-case-plural'),
        key: 'testCases',
        width: '120px',
        render: (_, record) => testCaseCounts[record.id ?? ''] ?? '--',
      },
      {
        title: t('label.action-plural'),
        key: 'actions',
        width: '100px',
        align: 'center',
        // System dimensions are seeded from the server and cannot be changed, so they get the
        // same disabled actions every provider-owned entity shows instead of a bespoke label.
        render: (_, record) => {
          const isSystem = record.provider === ProviderType.System;
          const disabledTitle = isSystem
            ? t('message.system-dimensions-are-read-only')
            : undefined;

          return (
            <Box gap={1}>
              <EditIconButton
                data-testid={`edit-${record.name}`}
                disabled={isSystem}
                size="small"
                title={
                  disabledTitle ??
                  t('label.edit-entity', { entity: t('label.dimension') })
                }
                onClick={() => setEditing(record)}
              />
              <DeleteIconButton
                data-testid={`delete-${record.name}`}
                disabled={isSystem}
                size="small"
                title={
                  disabledTitle ??
                  t('label.delete-entity', { entity: t('label.dimension') })
                }
                onClick={() => setDeleting(record)}
              />
            </Box>
          );
        },
      },
    ],
    [t, testCaseCounts]
  );

  const dimensionForm = (
    <DimensionForm hookForm={hookForm} isEditing={Boolean(editing)} />
  );

  // Every dismissal path — cancel, the header X, Escape and the backdrop — ends up in the base
  // drawer's onClose, so clearing `editing` there keeps the state below in step with the drawer
  // and stops the effect from immediately reopening it.
  //
  // Deliberately does NOT reset the form. onClose fires twice — once from our own closeDrawer
  // and again when the overlay finishes its transition — and that second, late call lands after
  // the user may already have reopened the drawer, wiping the values the open path had just
  // seeded. Seeding on open is what keeps the form clean, so there is nothing to clear here.
  const handleDrawerClose = useCallback(() => {
    setEditing(undefined);
  }, []);

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithHook<DimensionFormValues>({
      className: 'dimension-form-drawer',
      testId: 'dimension-drawer',
      title: editing
        ? t('label.edit-entity', { entity: t('label.dimension') })
        : t('label.create-entity', { entity: t('label.dimension') }),
      // Same three-quarter panel the create test case drawer uses.
      width: '75%',
      form: dimensionForm,
      hookForm,
      submitLabel: editing ? t('label.save') : t('label.create'),
      submitTestId: 'save-dimension',
      submitLoading: isSaving,
      onClose: handleDrawerClose,
      onSubmit: handleSave,
    });

  useEffect(() => {
    if (editing !== undefined) {
      // Seeded on open rather than on mount: one form instance serves both create and edit.
      hookForm.reset(initialValues);
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
    }
  }, [editing, initialValues, hookForm, isOpen, openDrawer, closeDrawer]);

  if (isLoading) {
    return <Loader />;
  }

  const deletingCount = countFor(testCaseCounts, deleting);
  const deletingDefinitionCount = countFor(testDefinitionCounts, deleting);

  return (
    <PageLayoutV1 pageTitle={t('label.data-quality')}>
      <div className="m-b-mlg">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
      </div>
      <Grid className="data-quality-settings-page" rowGap="4">
        <Grid.Item span={12}>
          <PageHeader
            data={{
              header: t('label.data-quality'),
              subHeader: t('message.page-sub-header-for-data-quality-settings'),
            }}
            title={t('label.data-quality')}
          />
        </Grid.Item>
        <Grid.Item span={12}>
          <Box align="center" gap={4} justify="end">
            <Button
              color="primary"
              data-testid="add-dimension"
              iconLeading={PlusCircle}
              size="md"
              onClick={() => setEditing(null)}>
              {t('label.add-entity', {
                entity: t('label.dimension'),
              })}
            </Button>
          </Box>
        </Grid.Item>
        <Grid.Item span={24}>
          {/* The shared table renders the search box in its own toolbar, so the dimension list
              looks like every other settings list instead of carrying its own chrome. */}
          <Table
            columns={columns}
            data-testid="dimensions-table"
            dataSource={filteredDimensions}
            locale={{
              emptyText: (
                <ErrorPlaceHolder
                  permission
                  className="border-none"
                  heading={t('label.dimension')}
                  permissionValue={t('label.create-entity', {
                    entity: t('label.dimension'),
                  })}
                  type={
                    searchTerm
                      ? ERROR_PLACEHOLDER_TYPE.FILTER
                      : ERROR_PLACEHOLDER_TYPE.CREATE
                  }
                  onClick={() => setEditing(null)}
                />
              ),
            }}
            pagination={false}
            rowKey="id"
            searchProps={{
              placeholder: t('label.search-entity', {
                entity: t('label.dimension-plural'),
              }),
              searchValue: searchTerm,
              searchBarDataTestId: 'search-dimensions',
              typingInterval: 350,
              onSearch: setSearchTerm,
            }}
            size="small"
          />
        </Grid.Item>
      </Grid>

      {formDrawer}

      <DeleteDimensionModal
        dimension={deleting}
        isDeleting={isSaving}
        testCaseCount={deletingCount}
        testDefinitionCount={deletingDefinitionCount}
        onCancel={() => setDeleting(undefined)}
        onConfirm={handleDelete}
      />
    </PageLayoutV1>
  );
};

export default DataQualitySettingsPage;
