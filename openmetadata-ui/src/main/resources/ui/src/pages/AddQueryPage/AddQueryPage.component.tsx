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
import { Card, Form, Input, Select, Space, Typography } from 'antd';
import { useForm } from 'antd/es/form/Form';
import { AxiosError } from 'axios';
import RichTextEditor from 'components/common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import SchemaEditor from 'components/schema-editor/SchemaEditor';
import {
  getServiceDetailsPath,
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getTableTabPath,
} from 'constants/constants';
import { CSMode } from 'enums/codemirror.enum';
import { FqnPart } from 'enums/entity.enum';
import { ServiceCategory } from 'enums/service.enum';
import { CreateQuery } from 'generated/api/data/createQuery';
import { Table } from 'generated/entity/data/table';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { getPartialNameFromTableFQN } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { serviceTypeLogo } from 'utils/ServiceUtils';
import { showErrorToast } from 'utils/ToastUtils';

const AddQueryPage = () => {
  const { t } = useTranslation();
  const { datasetFQN } = useParams<{ datasetFQN: string }>();
  const [form] = useForm<CreateQuery>();
  const [titleBreadcrumb, setTitleBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [description, setDescription] = useState<string>('');
  const [sqlQuery, setSqlQuery] = useState<string>('');
  const [table, setTable] = useState<Table>();

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
          name: 'Add Query',
          url: '',
          activeTitle: true,
        },
      ]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (datasetFQN) {
      fetchEntityDetails();
    }
  }, [datasetFQN]);

  const handleSubmit = () => {};

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
            <Form<CreateQuery>
              initialValues={{
                queryUsedIn: [table?.id],
              }}
              form={form}
              data-testid="query-form"
              id="query-form"
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
                  placeholder={t('label.role-name')}
                  type="text"
                />
              </Form.Item>
              <Form.Item
                label={`${t('label.display-name')}:`}
                name="displayName">
                <Input
                  data-testid="display-name"
                  placeholder={t('label.role-name')}
                  type="text"
                />
              </Form.Item>
              <Form.Item
                required
                data-testid="sql-editor-container"
                label={t('label.sql-uppercase-query')}
                name="query">
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
                <Select
                  mode="multiple"
                  options={[{ label: table?.name, key: table?.id }]}
                />
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
