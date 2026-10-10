/*
 *  Copyright 2025 Collate.
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

import { EditorView } from '@codemirror/view';
import {
  Box,
  Button,
  Dialog,
  FormField,
  FormItemLabel,
  HintText,
  HookForm,
  Input,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { HTTP_STATUS_CODE } from '../../../../../constants/Auth.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../constants/HelperTextUtil';
import { usePermissionProvider } from '../../../../../context/PermissionProvider/PermissionProvider';
import { CSMode } from '../../../../../enums/codemirror.enum';
import { EntityType, FqnPart } from '../../../../../enums/entity.enum';
import { OwnerType } from '../../../../../enums/user.enum';
import { CreateQuery } from '../../../../../generated/api/data/createQuery';
import { Table } from '../../../../../generated/entity/data/table';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { useTestCaseStore } from '../../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import { postQuery } from '../../../../../rest/queryAPI';
import { getTableDetailsByFQN } from '../../../../../rest/tableAPI';
import { getCurrentMillis } from '../../../../../utils/date-time/DateTimeUtils';
import { getPartialNameFromTableFQN } from '../../../../../utils/FqnUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import withSuspenseFallback from '../../../../AppRouter/withSuspenseFallback';
import Loader from '../../../../common/Loader/Loader';
import RichTextEditor from '../../../../common/RichTextEditor/RichTextEditor';
import { AddSqlQueryFormModalProps } from './AddSqlQueryFormModal.interface';

const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../../../Database/SchemaEditor/SchemaEditor'))
);

interface QueryFormValues {
  query: string;
  table: string;
  description: string;
}

const AddSqlQueryFormModal = ({
  open,
  onCancel,
}: AddSqlQueryFormModalProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { currentUser } = useApplicationStore();

  const { testCase } = useTestCaseStore();
  const form = useForm<QueryFormValues>({
    defaultValues: {
      query: testCase?.inspectionQuery ?? '',
      table: '',
      description: '',
    },
  });
  const { setValue } = form;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [table, setTable] = useState<Table>();
  const queryLabel = t('label.sql-uppercase-query');
  const queryError = form.formState.errors.query?.message;
  const queryExtensions = useMemo(
    () => [
      EditorView.contentAttributes.of({
        'aria-label': queryLabel,
        'aria-invalid': String(Boolean(queryError)),
        ...(queryError ? { 'aria-describedby': 'query-error' } : {}),
      }),
    ],
    [queryLabel, queryError]
  );

  const fetchTableData = useCallback(
    async (entityFQN: string) => {
      setIsLoading(true);
      const tableFQN = getPartialNameFromTableFQN(
        entityFQN,
        [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
        '.'
      );
      try {
        const response = await getTableDetailsByFQN(tableFQN);
        setValue('table', response.fullyQualifiedName ?? tableFQN);
        setTable(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [setValue]
  );

  const handleSubmit = async (values: QueryFormValues): Promise<void> => {
    setIsSaving(true);
    const updatedValues: CreateQuery = {
      description: values.description,
      query: values.query ?? testCase?.inspectionQuery,
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
      ],
      queryDate: getCurrentMillis(),
      service: getPartialNameFromTableFQN(
        table?.fullyQualifiedName ?? testCase?.fullyQualifiedName ?? '',
        [FqnPart.Service]
      ),
    };

    try {
      await postQuery(updatedValues);
      showSuccessToast(
        t('server.create-entity-success', { entity: t('label.query') })
      );
      onCancel();
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

  useEffect(() => {
    if (testCase) {
      fetchTableData(testCase?.entityFQN ?? '');
      setValue('query', testCase.inspectionQuery ?? '');
    }
  }, [testCase, fetchTableData, setValue]);

  return (
    <ModalOverlay
      isDismissable={false}
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Modal>
        <Dialog
          title={t('label.add-new-entity', { entity: t('label.query') })}
          width={750}>
          <Dialog.Content>
            {isLoading ? (
              <Loader />
            ) : (
              <HookForm
                data-testid="query-form"
                form={form}
                id="query-form"
                onSubmit={form.handleSubmit(handleSubmit)}>
                <Box direction="col" gap={6}>
                  <FormField
                    control={form.control}
                    name="query"
                    rules={{
                      required: t('label.field-required', {
                        field: queryLabel,
                      }),
                    }}>
                    {({ field }) => (
                      <Box
                        data-testid="sql-editor-container"
                        direction="col"
                        gap={2}>
                        <FormItemLabel required label={queryLabel} />
                        <SchemaEditor
                          className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
                          extensions={queryExtensions}
                          mode={{ name: CSMode.SQL }}
                          showCopyButton={false}
                          value={field.value}
                          onChange={field.onChange}
                        />
                        {queryError && (
                          <HintText isInvalid id="query-error">
                            {queryError}
                          </HintText>
                        )}
                      </Box>
                    )}
                  </FormField>
                  <FormField control={form.control} name="table">
                    {({ field }) => (
                      <Input
                        {...field}
                        isDisabled
                        inputDataTestId="table"
                        label={t('label.table')}
                      />
                    )}
                  </FormField>
                  <FormField control={form.control} name="description">
                    {({ field }) => (
                      <Box direction="col" gap={2}>
                        <FormItemLabel label={t('label.description')} />
                        <RichTextEditor
                          initialValue={field.value}
                          placeHolder={t('message.write-your-description')}
                          style={{ margin: 0 }}
                          onTextChange={field.onChange}
                        />
                      </Box>
                    )}
                  </FormField>
                </Box>
              </HookForm>
            )}
          </Dialog.Content>
          <Dialog.Footer>
            <Button color="secondary" size="md" onPress={onCancel}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              form="query-form"
              isDisabled={
                !permissions.query?.Create || !table?.id || !currentUser?.id
              }
              isLoading={isSaving}
              size="md"
              title={
                permissions.query?.Create
                  ? undefined
                  : t(NO_PERMISSION_FOR_ACTION)
              }
              type="submit">
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default AddSqlQueryFormModal;
