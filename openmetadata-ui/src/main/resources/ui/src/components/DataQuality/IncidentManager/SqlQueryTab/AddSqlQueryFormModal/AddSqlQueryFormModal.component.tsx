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

import { Form, FormProps, Input, Modal } from 'antd';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
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
import { getPartialNameFromTableFQN } from '../../../../../utils/CommonUtils';
import { getCurrentMillis } from '../../../../../utils/date-time/DateTimeUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import Loader from '../../../../common/Loader/Loader';
import RichTextEditor from '../../../../common/RichTextEditor/RichTextEditor';
import SchemaEditor from '../../../../Database/SchemaEditor/SchemaEditor';
import { AddSqlQueryFormModalProps } from './AddSqlQueryFormModal.interface';

const AddSqlQueryFormModal = ({
  open,
  onCancel,
}: AddSqlQueryFormModalProps) => {
  const [form] = Form.useForm();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const { currentUser } = useApplicationStore();

  const { testCase } = useTestCaseStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [table, setTable] = useState<Table>();

  const fetchTableData = async (entityFQN: string) => {
    setIsLoading(true);
    const tableFQN = getPartialNameFromTableFQN(
      entityFQN,
      [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
      '.'
    );
    try {
      const response = await getTableDetailsByFQN(tableFQN);
      form.setFieldsValue({
        table: response.fullyQualifiedName ?? tableFQN,
      });
      setTable(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit: FormProps['onFinish'] = async (values): Promise<void> => {
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
      form.setFieldsValue({
        query: testCase.inspectionQuery,
      });
    }
  }, [testCase]);

  return (
    <Modal
      centered
      destroyOnClose
      closable={false}
      maskClosable={false}
      okButtonProps={{
        disabled: !permissions.query?.Create || !table?.id || !currentUser?.id,
        htmlType: 'submit',
        form: 'query-form',
        loading: isSaving,
        title: permissions.query?.Create
          ? undefined
          : t(NO_PERMISSION_FOR_ACTION),
      }}
      okText={t('label.save')}
      open={open}
      title={t('label.add-new-entity', { entity: t('label.query') })}
      width={750}
      onCancel={onCancel}>
      {isLoading ? (
        <Loader />
      ) : (
        <Form
          data-testid="query-form"
          form={form}
          id="query-form"
          layout="vertical"
          onFinish={handleSubmit}>
          <Form.Item
            data-testid="sql-editor-container"
            label={t('label.sql-uppercase-query')}
            name="query"
            rules={[
              {
                required: true,
                message: t('label.field-required', {
                  field: t('label.sql-uppercase-query'),
                }),
              },
            ]}
            trigger="onChange">
            <SchemaEditor
              className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
              mode={{ name: CSMode.SQL }}
              showCopyButton={false}
            />
          </Form.Item>
          <Form.Item label={t('label.table')} name="table">
            <Input disabled data-testid="table" />
          </Form.Item>
          <Form.Item
            label={t('label.description')}
            name="description"
            trigger="onTextChange">
            <RichTextEditor
              placeHolder={t('message.write-your-description')}
              style={{ margin: 0 }}
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
};

export default AddSqlQueryFormModal;
