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
import { Button, Form, FormProps, Space, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { filter, isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '../../components/common/AntdCompat';
import { AsyncSelect } from '../../components/common/AsyncSelect/AsyncSelect';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import SchemaEditor from '../../components/Database/SchemaEditor/SchemaEditor';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import {
    INITIAL_PAGING_VALUE,
    PAGE_SIZE_MEDIUM
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
import { FieldProp, FieldTypes } from '../../interface/FormUtils.interface';
import { searchData } from '../../rest/miscAPI';
import { postQuery } from '../../rest/queryAPI';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import { getCurrentMillis } from '../../utils/date-time/DateTimeUtils';
import {
    getEntityBreadcrumbs,
    getEntityLabel,
    getEntityName
} from '../../utils/EntityUtils';
import { getField } from '../../utils/formUtils';
import { getEntityDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
;

const AddQueryPage = () => {
  const { currentUser } = useApplicationStore();
  const { fqn: datasetFQN } = useFqn();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const [form] = Form.useForm();
  const [titleBreadcrumb, setTitleBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [description, setDescription] = useState<string>('');
  const [table, setTable] = useState<Table>();
  const [initialOptions, setInitialOptions] = useState<DefaultOptionType[]>();
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
        label: getEntityLabel(value._source),
        value: value._source.id,
        labelName: getEntityName(value._source),
      }));

      return table
        ? filter(options, ({ value }) => value !== table.id)
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
    navigate(-1);
  };

  const handleSubmit: FormProps['onFinish'] = async (values): Promise<void> => {
    setIsSaving(true);
    const updatedValues: CreateQuery = {
      ...values,
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
        ...(values.queryUsedIn || []).map((id: string) => ({
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

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: 'description',
      required: false,
      label: `${t('label.description')}:`,
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: '',
        style: {
          margin: 0,
        },
        placeHolder: t('message.write-your-description'),
        onTextChange: (value: string) => setDescription(value),
      },
    }),
    []
  );

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
              <Typography.Paragraph
                className="text-base"
                data-testid="form-title">
                {t('label.add-new-entity', {
                  entity: t('label.query'),
                })}
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
                {getField(descriptionField)}
                <Form.Item
                  label={`${t('label.query-used-in')}:`}
                  name="queryUsedIn">
                  <AsyncSelect
                    api={fetchTableEntity}
                    data-testid="query-used-in"
                    mode="multiple"
                    optionLabelProp="labelName"
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
                        !permissions.query?.Create && NO_PERMISSION_FOR_ACTION
                      }>
                      <Button
                        data-testid="save-btn"
                        disabled={!permissions.query?.Create}
                        htmlType="submit"
                        loading={isSaving}
                        type="primary">
                        {t('label.save')}
                      </Button>
                    </Tooltip>
                  </Space>
                </Form.Item>
              </Form>
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
            <Typography.Paragraph className="text-base font-medium">
              {t('label.add-entity', {
                entity: t('label.query'),
              })}
            </Typography.Paragraph>
            <Typography.Text>
              {t('message.add-query-helper-message')}
            </Typography.Text>
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
