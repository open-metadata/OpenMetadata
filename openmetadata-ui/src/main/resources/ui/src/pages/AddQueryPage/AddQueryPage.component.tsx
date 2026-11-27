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

import {
  Autocomplete,
  Box,
  Button,
  FormField,
  FormItemLabel,
  HintText,
  HookForm,
  SelectItemType,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce, isEmpty, uniqBy } from 'lodash';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { CSMode } from '../../enums/codemirror.enum';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { OwnerType } from '../../enums/user.enum';
import { CreateQuery } from '../../generated/api/data/createQuery';
import { Table } from '../../generated/entity/data/table';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { postQuery } from '../../rest/queryAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { getCurrentMillis } from '../../utils/date-time/DateTimeUtils';
import { getEntityBreadcrumbs } from '../../utils/EntityBreadcrumbPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { getPartialNameFromFQN } from '../../utils/FqnUtils';
import { getEntityDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../components/Database/SchemaEditor/SchemaEditor'))
);

interface QueryFormValues {
  query: string;
  queryUsedIn: string[];
}

const AddQueryPage = () => {
  const { currentUser } = useApplicationStore();
  const { fqn: datasetFQN } = useFqn();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const form = useForm<QueryFormValues>({
    defaultValues: { query: '', queryUsedIn: [] },
  });
  const [titleBreadcrumb, setTitleBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [description, setDescription] = useState<string>('');
  const [table, setTable] = useState<Table>();
  const [tableItems, setTableItems] = useState<SelectItemType[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const fetchEntityDetails = async () => {
    try {
      const tableRes = await getTableDetailsByFQN(datasetFQN);
      setTable(tableRes);
      setTitleBreadcrumb([
        ...getEntityBreadcrumbs(tableRes, EntityType.TABLE),
        {
          name: getEntityName(tableRes),
          url: getEntityDetailsPath(
            EntityType.TABLE,
            datasetFQN,
            'table_queries'
          ),
        },
        {
          name: t('label.add-entity', {
            entity: t('label.query'),
          }),
          url: '',
          activeTitle: true,
        },
      ]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchTableEntity = useCallback(
    async (searchValue = '') => {
      try {
        const data = await searchQuery({
          query: searchValue,
          pageNumber: INITIAL_PAGING_VALUE,
          pageSize: PAGE_SIZE_MEDIUM,
          searchIndex: SearchIndex.TABLE,
        });
        const fetched = data.hits.hits
          .filter(({ _source }) => _source.id !== table?.id)
          .map(({ _source }) => ({
            id: _source.id,
            label: getEntityName(_source),
          }));
        // Keep the chosen tables so their chips keep a label after a new search.
        const selected = form.getValues('queryUsedIn');
        setTableItems((prev) =>
          uniqBy(
            [
              ...prev.filter((item) => selected.includes(String(item.id))),
              ...fetched,
            ],
            'id'
          )
        );
      } catch {
        // A failed search keeps the current options.
      }
    },
    [table, form]
  );

  const debouncedFetchTableEntity = useMemo(
    () => debounce(fetchTableEntity, 300),
    [fetchTableEntity]
  );

  useEffect(() => {
    if (datasetFQN) {
      fetchEntityDetails();
    }
  }, [datasetFQN]);

  useEffect(() => {
    if (table) {
      fetchTableEntity();
    }

    return () => debouncedFetchTableEntity.cancel();
  }, [table, fetchTableEntity, debouncedFetchTableEntity]);

  const handleCancelClick = () => {
    navigate(-1);
  };

  const handleSubmit = async (values: QueryFormValues): Promise<void> => {
    setIsSaving(true);
    const updatedValues: CreateQuery = {
      query: values.query,
      description: isEmpty(description) ? undefined : description,
      owners: [
        {
          id: currentUser?.id ?? '',
          type: OwnerType.USER,
        },
      ],
      queryUsedIn: [
        {
          id: table?.id ?? '',
          type: EntityType.TABLE,
        },
        ...values.queryUsedIn.map((id) => ({
          id,
          type: EntityType.TABLE,
        })),
      ],
      queryDate: getCurrentMillis(),
      service: getPartialNameFromFQN(datasetFQN, ['service']),
    };

    try {
      await postQuery(updatedValues);
      showSuccessToast(
        t('server.create-entity-success', {
          entity: t('label.query'),
        })
      );
      handleCancelClick();
    } catch (error) {
      if (
        (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
      ) {
        showErrorToast(
          t('server.entity-already-exist-message-without-name', {
            entity: t('label.query'),
            entityPlural: t('label.query-lowercase-plural'),
          })
        );
      } else {
        showErrorToast(
          t('server.create-entity-error', {
            entity: t('label.query-plural'),
          })
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        allowScroll: true,
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        children: (
          <div>
            <TitleBreadcrumb titleLinks={titleBreadcrumb} />
            <div className="m-t-md">
              <Typography as="p" className="text-base" data-testid="form-title">
                {t('label.add-new-entity', {
                  entity: t('label.query'),
                })}
              </Typography>
              <HookForm
                className="tw:mt-4 tw:flex tw:flex-col tw:gap-4"
                data-testid="query-form"
                form={form}
                id="query-form"
                onSubmit={form.handleSubmit(handleSubmit)}>
                <FormField
                  control={form.control}
                  name="query"
                  rules={{
                    required: t('label.field-required', {
                      field: t('label.sql-uppercase-query'),
                    }),
                  }}>
                  {({ field, fieldState }) => (
                    <Box
                      data-testid="sql-editor-container"
                      direction="col"
                      gap={1}>
                      <FormItemLabel
                        required
                        label={t('label.sql-uppercase-query')}
                      />
                      <SchemaEditor
                        className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
                        mode={{ name: CSMode.SQL }}
                        showCopyButton={false}
                        value={field.value}
                        onChange={field.onChange}
                      />
                      {fieldState.error && (
                        <HintText isInvalid>
                          {fieldState.error.message}
                        </HintText>
                      )}
                    </Box>
                  )}
                </FormField>
                <Box direction="col" gap={1}>
                  <FormItemLabel label={`${t('label.description')}:`} />
                  <RichTextEditor
                    data-testid="description"
                    initialValue=""
                    placeHolder={t('message.write-your-description')}
                    onTextChange={setDescription}
                  />
                </Box>
                <FormField control={form.control} name="queryUsedIn">
                  {({ field }) => (
                    <Box direction="col" gap={1}>
                      <FormItemLabel label={`${t('label.query-used-in')}:`} />
                      <Autocomplete
                        multiple
                        aria-label={t('label.query-used-in')}
                        data-testid="query-used-in"
                        filterOption={() => true}
                        items={tableItems}
                        placeholder={t('label.please-select-entity', {
                          entity: t('label.query-used-in'),
                        })}
                        selectedItems={field.value.map((id) => ({
                          id,
                          label:
                            tableItems.find((item) => item.id === id)?.label ??
                            id,
                        }))}
                        onItemCleared={(key) =>
                          field.onChange(
                            field.value.filter((id) => id !== String(key))
                          )
                        }
                        onItemInserted={(key) =>
                          field.onChange([...field.value, String(key)])
                        }
                        onSearchChange={debouncedFetchTableEntity}>
                        {(item) => (
                          <Autocomplete.Item id={item.id} label={item.label} />
                        )}
                      </Autocomplete>
                    </Box>
                  )}
                </FormField>
                <Box
                  inline
                  align="center"
                  className="layout-space layout-space-horizontal w-full justify-end"
                  gap={4}
                  itemClassName="layout-space-item">
                  <Button
                    color="secondary"
                    data-testid="cancel-btn"
                    onClick={handleCancelClick}>
                    {t('label.cancel')}
                  </Button>
                  <Tooltip
                    arrow
                    isDisabled={permissions.query?.Create}
                    placement="top"
                    title={t(NO_PERMISSION_FOR_ACTION)}>
                    <Button
                      color="primary"
                      data-testid="save-btn"
                      isDisabled={!permissions.query?.Create}
                      isLoading={isSaving}
                      size="sm"
                      type="submit">
                      {t('label.save')}
                    </Button>
                  </Tooltip>
                </Box>
              </HookForm>
            </div>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-entity', { entity: t('label.query') })}
      secondPanel={{
        children: (
          <>
            <Typography as="p" className="text-base font-medium">
              {t('label.add-entity', {
                entity: t('label.query'),
              })}
            </Typography>
            <Typography>{t('message.add-query-helper-message')}</Typography>
          </>
        ),
        className: 'content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default withPageLayout(AddQueryPage);
