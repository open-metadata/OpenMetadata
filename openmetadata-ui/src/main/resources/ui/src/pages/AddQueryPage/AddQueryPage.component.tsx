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
  Button,
  Card,
  Form,
  FormProps,
  Input,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { AsyncSelect } from 'components/AsyncSelect/AsyncSelect';
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import SchemaEditor from 'components/schema-editor/SchemaEditor';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  getTableTabPath,
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
} from 'constants/constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { CSMode } from 'enums/codemirror.enum';
import { EntityType, FqnPart } from 'enums/entity.enum';
import { SearchIndex } from 'enums/search.enum';
import { ServiceCategory } from 'enums/service.enum';
import { OwnerType } from 'enums/user.enum';
import { CreateQuery } from 'generated/api/data/createQuery';
import { Table } from 'generated/entity/data/table';
import { isEmpty, uniqBy } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { searchData } from 'rest/miscAPI';
import { postQuery } from 'rest/queryAPI';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import {
  getCurrentUserId,
  getPartialNameFromTableFQN,
} from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { showErrorToast, showSuccessToast } from 'utils/ToastUtils';

const AddQueryPage = () => {
  const { t } = useTranslation();
  const { datasetFQN } = useParams<{ datasetFQN: string }>();
  const { permissions } = usePermissionProvider();
  const [form] = Form.useForm();
  const [titleBreadcrumb, setTitleBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [description, setDescription] = useState<string>('');
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [table, setTable] = useState<Table>();
  const [initialOptions, setInitialOptions] = useState<DefaultOptionType[]>();
  const [isSaving, setIsSaving] = useState(false);

  const fetchEntityDetails = async () => {
    try {
      const tableRes = await getTableDetailsByFQN(datasetFQN, '');
      setTable(tableRes);
      const { database, service, serviceType, databaseSchema } = tableRes;
      const serviceName = service?.name ?? '';
      setTitleBreadcrumb([
        {
          name: serviceName,
          url: serviceName
            ? getServiceDetailsPath(
                serviceName,
                ServiceCategory.DATABASE_SERVICES
              )
            : '',
          imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
        },
        {
          name: getPartialNameFromTableFQN(database?.fullyQualifiedName ?? '', [
            FqnPart.Database,
          ]),
          url: getDatabaseDetailsPath(database?.fullyQualifiedName ?? ''),
        },
        {
          name: getPartialNameFromTableFQN(
            databaseSchema?.fullyQualifiedName ?? '',
            [FqnPart.Schema]
          ),
          url: getDatabaseSchemaDetailsPath(
            databaseSchema?.fullyQualifiedName ?? ''
          ),
        },
        {
          name: getEntityName(tableRes),
          url: getTableTabPath(datasetFQN, 'table_queries'),
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

  const fetchTableEntity = async (
    searchValue = ''
  ): Promise<DefaultOptionType[]> => {
    try {
      const { data } = await searchData(
        searchValue,
        INITIAL_PAGING_VALUE,
        PAGE_SIZE_MEDIUM,
        '',
        '',
        '',
        SearchIndex.TABLE
      );
      const options = data.hits.hits.map((value) => ({
        label: getEntityName(value._source),
        value: value._source.id,
      }));

      return table
        ? uniqBy(
            [...options, { value: table.id, label: getEntityName(table) }],
            'value'
          )
        : options;
    } catch (error) {
      return [];
    }
  };

  useEffect(() => {
    if (datasetFQN) {
      fetchEntityDetails();
    }
  }, [datasetFQN]);

  const getInitialOptions = async () => {
    try {
      const option = await fetchTableEntity();
      form.setFieldValue('queryUsedIn', [table?.id]);
      setInitialOptions(option);
    } catch (error) {
      setInitialOptions([]);
    }
  };

  useEffect(() => {
    if (table) {
      getInitialOptions();
    }
  }, [table]);

  const handleCancelClick = () => {
    history.back();
  };

  const handleSubmit: FormProps['onFinish'] = async (values) => {
    const updatedValues: CreateQuery = {
      ...values,
      description: isEmpty(description) ? undefined : description,
      owner: {
        id: getCurrentUserId(),
        type: OwnerType.USER,
      },
      queryUsedIn: values.queryUsedIn
        ? values.queryUsedIn.map((id: string) => ({
            id,
            type: EntityType.TABLE,
          }))
        : undefined,
    };

    try {
      await postQuery(updatedValues);
      showSuccessToast(
        t('server.create-entity-success', { entity: t('label.query') })
      );
      setIsSaving(false);
      handleCancelClick();
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsSaving(false);
    }
  };

  return (
    <PageContainerV1>
      <PageLayoutV1
        center
        pageTitle={t('label.add-entity', { entity: t('label.query') })}>
        <Space className="w-full" direction="vertical" size="middle">
          <TitleBreadcrumb titleLinks={titleBreadcrumb} />
          <Card>
            <Typography.Paragraph
              className="text-base"
              data-testid="form-title">
              {t('label.add-new-entity', { entity: t('label.query') })}
            </Typography.Paragraph>
            <Form
              data-testid="query-form"
              form={form}
              id="query-form"
              initialValues={{
                queryUsedIn: table ? [table.id] : undefined,
              }}
              layout="vertical"
              onFinish={handleSubmit}>
              <Form.Item
                label={`${t('label.name')}:`}
                name="name"
                rules={[
                  {
                    required: false,
                    max: 128,
                    min: 1,
                    message: t('label.invalid-name'),
                  },
                ]}>
                <Input
                  data-testid="name"
                  placeholder={t('label.enter-entity', {
                    entity: t('label.name'),
                  })}
                  type="text"
                />
              </Form.Item>
              <Form.Item
                label={`${t('label.display-name')}:`}
                name="displayName">
                <Input
                  data-testid="display-name"
                  placeholder={t('label.enter-entity', {
                    entity: t('label.display-name'),
                  })}
                  type="text"
                />
              </Form.Item>
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
                ]}>
                <SchemaEditor
                  className="custom-query-editor query-editor-h-200 custom-code-mirror-theme"
                  mode={{ name: CSMode.SQL }}
                  options={{
                    readOnly: false,
                  }}
                  value={sqlQuery}
                  onChange={(value) => setSqlQuery(value)}
                />
              </Form.Item>
              <Form.Item
                label={`${t('label.description')}:`}
                name="description">
                <RichTextEditor
                  height="200px"
                  initialValue={description}
                  placeHolder={t('message.write-your-description')}
                  style={{ margin: 0 }}
                  onTextChange={(value) => setDescription(value)}
                />
              </Form.Item>
              <Form.Item
                label={`${t('label.query-used-in')}:`}
                name="queryUsedIn">
                <AsyncSelect
                  api={fetchTableEntity}
                  mode="multiple"
                  options={initialOptions}
                  placeholder={t('label.please-select-entity', {
                    entity: t('label.query-used-in'),
                  })}
                />
              </Form.Item>
              <Form.Item>
                <Space className="w-full justify-end" size={16}>
                  <Button
                    data-testid="cancel-btn"
                    type="default"
                    onClick={handleCancelClick}>
                    {t('label.cancel')}
                  </Button>
                  <Tooltip
                    placement="top"
                    title={
                      !permissions.query.Create && NO_PERMISSION_FOR_ACTION
                    }>
                    <Button
                      data-testid="save-btn"
                      disabled={!permissions.query.Create}
                      htmlType="submit"
                      loading={isSaving}
                      type="primary">
                      {t('label.save')}
                    </Button>
                  </Tooltip>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </Space>
        <div className="m-t-xlg p-l-lg w-max-400">
          <Typography.Paragraph className="text-base font-medium">
            {t('label.add-entity', {
              entity: t('label.query'),
            })}
          </Typography.Paragraph>
          <Typography.Text>{t('message.add-role-message')}</Typography.Text>
        </div>
      </PageLayoutV1>
    </PageContainerV1>
  );
};

export default AddQueryPage;
