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
import { PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Collapse,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormDrawerWithRef } from '../../components/common/atoms/drawer';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { DIMENSION_COLOR_PALETTE } from '../../constants/DataQualityDimension.constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  DataQualityDimension,
  ProviderType,
} from '../../generated/tests/dataQualityDimension';
import {
  createDataQualityDimension,
  deleteDataQualityDimension,
  getDataQualityDimensions,
  getDataQualityDimensionTestCaseCounts,
  patchDataQualityDimension,
} from '../../rest/dataQualityDimensionAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './data-quality-settings-page.less';

interface DimensionFormValues {
  name: string;
  displayName?: string;
  description?: string;
  color: string;
}

const DEFAULT_COLOR = DIMENSION_COLOR_PALETTE[0];

const DataQualitySettingsPage = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm<DimensionFormValues>();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dimensions, setDimensions] = useState<DataQualityDimension[]>([]);
  const [testCaseCounts, setTestCaseCounts] = useState<Record<string, number>>(
    {}
  );
  const [searchTerm, setSearchTerm] = useState('');
  // `undefined` closes the drawer, `null` opens it in create mode.
  const [editing, setEditing] = useState<DataQualityDimension | null>();
  const [deleting, setDeleting] = useState<DataQualityDimension>();

  // The colour lives in the form rather than in component state so that the preview below
  // re-renders on every keystroke, not only when a swatch is clicked.
  const watchedName = Form.useWatch('name', form);
  const watchedDisplayName = Form.useWatch('displayName', form);
  const watchedColor = Form.useWatch('color', form) ?? DEFAULT_COLOR;

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
      const [{ data }, counts] = await Promise.all([
        getDataQualityDimensions({ limit: 1000 }),
        // A missing count must not hide the dimension list itself.
        getDataQualityDimensionTestCaseCounts().catch(() => ({})),
      ]);
      setDimensions(data);
      setTestCaseCounts(counts);
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

  // Remounting the form on every open (see the `key` below) is what makes these apply, so the
  // drawer never shows the previously edited dimension.
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
        t('server.entity-deleted-successfully', { entity: t('label.dimension') })
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
          <Space align="start" data-testid={`dimension-${name}`} size={8}>
            <span
              className="dimension-color-dot"
              style={{ backgroundColor: record.style?.color ?? DEFAULT_COLOR }}
            />
            <div>
              <Typography.Text strong>
                {record.displayName ?? name}
              </Typography.Text>
              <Typography.Paragraph className="dimension-technical-name">
                {name}
              </Typography.Paragraph>
            </div>
          </Space>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (description?: string) => description ?? '--',
      },
      {
        title: t('label.type'),
        dataIndex: 'provider',
        key: 'provider',
        render: (provider?: ProviderType) => (
          <Tag color={provider === ProviderType.System ? 'default' : 'blue'}>
            {provider === ProviderType.System
              ? t('label.system')
              : t('label.custom')}
          </Tag>
        ),
      },
      {
        title: t('label.test-case-plural'),
        key: 'testCases',
        render: (_, record) => testCaseCounts[record.id ?? ''] ?? '--',
      },
      {
        title: t('label.action-plural'),
        key: 'actions',
        align: 'right',
        render: (_, record) =>
          record.provider === ProviderType.System ? (
            <Typography.Text type="secondary">
              {t('label.not-editable')}
            </Typography.Text>
          ) : (
            <Space size={12}>
              <Button
                data-testid={`edit-${record.name}`}
                type="link"
                onClick={() => setEditing(record)}>
                {t('label.edit')}
              </Button>
              <Button
                danger
                data-testid={`delete-${record.name}`}
                type="link"
                onClick={() => setDeleting(record)}>
                {t('label.delete')}
              </Button>
            </Space>
          ),
      },
    ],
    [t, testCaseCounts]
  );

  // `key` remounts the form on every open so the fields (and the preview) start from the
  // dimension being edited instead of whatever was in the form last time.
  const dimensionForm = (
    <Form<DimensionFormValues>
      className="new-form-style"
      form={form}
      initialValues={initialValues}
      key={editing?.id ?? 'new-dimension'}
      layout="vertical"
      onFinish={handleSave}>
      <Row className="dimension-form" gutter={[24, 0]}>
        <Col span={15}>
          <Form.Item
            extra={
              editing
                ? t('message.dimension-name-is-fixed-after-creation')
                : t('message.dimension-name-help')
            }
            label={t('label.name')}
            name="name"
            rules={[
              {
                required: true,
                message: t('label.field-required', { field: t('label.name') }),
              },
              {
                pattern: /^[\w-]+$/,
                message: t('message.dimension-name-help'),
              },
            ]}>
            {/* The name is referenced by the API and by every test case relationship, so it is
                read-only once the dimension exists. */}
            <Input data-testid="dimension-name" disabled={Boolean(editing)} />
          </Form.Item>
          <Form.Item
            extra={t('message.dimension-display-name-help')}
            label={t('label.display-name')}
            name="displayName">
            <Input data-testid="dimension-display-name" />
          </Form.Item>
          <Form.Item label={t('label.description')} name="description">
            <Input.TextArea
              data-testid="dimension-description"
              placeholder={t('message.dimension-description-placeholder')}
              rows={4}
            />
          </Form.Item>
          {/* The colour is held by the form itself — the swatches below write to it — so that
              the preview re-renders from a watcher instead of from local state. */}
          <Form.Item hidden name="color">
            <Input />
          </Form.Item>
          <Form.Item label={t('label.color')}>
            <Space size={8} wrap>
              {DIMENSION_COLOR_PALETTE.map((color) => (
                <button
                  aria-label={color}
                  aria-pressed={watchedColor === color}
                  className={`dimension-color-swatch${
                    watchedColor === color ? ' selected' : ''
                  }`}
                  data-testid={`color-${color}`}
                  key={color}
                  style={{ backgroundColor: color }}
                  type="button"
                  onClick={() => form.setFieldValue('color', color)}
                />
              ))}
            </Space>
          </Form.Item>
        </Col>
        <Col span={9}>
          <div className="dimension-side-panel">
            <Typography.Text type="secondary">
              {t('label.preview')}
            </Typography.Text>
            <div className="dimension-preview">
              <span
                className="dimension-color-dot"
                style={{ backgroundColor: watchedColor }}
              />
              <Typography.Text strong>
                {watchedDisplayName || watchedName || t('label.dimension')}
              </Typography.Text>
            </div>
            <Typography.Paragraph className="m-b-0" type="secondary">
              {t('message.data-quality-dimensions-description')}
            </Typography.Paragraph>
          </div>
        </Col>
      </Row>
    </Form>
  );

  // Every dismissal path — cancel, the header X, Escape and the backdrop — ends up in the base
  // drawer's onClose, so clearing `editing` there keeps the state below in step with the drawer
  // and stops the effect from immediately reopening it.
  const handleDrawerClose = useCallback(() => {
    setEditing(undefined);
    // Reopening in create mode reuses the same form key, so clear it here rather than relying
    // on a remount.
    form.resetFields();
  }, [form]);

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithRef<DimensionFormValues>({
      className: 'dimension-form-drawer',
      testId: 'dimension-drawer',
      title: editing
        ? t('label.edit-entity', { entity: t('label.dimension') })
        : t('label.create-entity', { entity: t('label.dimension') }),
      // Same three-quarter panel the create test case drawer uses.
      width: '75%',
      form: dimensionForm,
      formRef: form,
      submitLabel: editing ? t('label.save') : t('label.create'),
      submitTestId: 'save-dimension',
      submitLoading: isSaving,
      onClose: handleDrawerClose,
      onSubmit: () => form.submit(),
    });

  useEffect(() => {
    if (editing !== undefined) {
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
    }
  }, [editing, isOpen, openDrawer, closeDrawer]);

  if (isLoading) {
    return <Loader />;
  }

  const deletingCount = testCaseCounts[deleting?.id ?? ''] ?? 0;

  return (
    <PageLayoutV1 pageTitle={t('label.data-quality')}>
      <div className="m-b-mlg">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
      </div>
      <Row
        className="settings-page-container data-quality-settings-page"
        gutter={[0, 24]}>
        <Col span={24}>
          <PageHeader
            data={{
              header: t('label.data-quality'),
              subHeader: t('message.page-sub-header-for-data-quality-settings'),
            }}
            title={t('label.data-quality')}
          />
        </Col>
        <Col span={24}>
          <Collapse
            className="settings-page-collapse"
            defaultActiveKey={['dimensions']}
            expandIconPosition="right">
            <Collapse.Panel
              header={
                <PageHeader
                  data={{
                    header: `${t('label.dimension-plural')} (${
                      dimensions.length
                    })`,
                    subHeader: t('message.data-quality-dimensions-description'),
                  }}
                />
              }
              key="dimensions">
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <Row align="middle" gutter={[16, 16]} justify="end">
                    <Col>
                      <Space size={12}>
                        <Input.Search
                          allowClear
                          data-testid="search-dimensions"
                          placeholder={t('label.search-entity', {
                            entity: t('label.dimension-plural'),
                          })}
                          value={searchTerm}
                          onChange={(event) =>
                            setSearchTerm(event.target.value)
                          }
                        />
                        <Button
                          data-testid="add-dimension"
                          icon={<PlusOutlined />}
                          type="primary"
                          onClick={() => setEditing(null)}>
                          {t('label.add-entity', {
                            entity: t('label.dimension'),
                          })}
                        </Button>
                      </Space>
                    </Col>
                  </Row>
                </Col>
                <Col span={24}>
                  <Table
                    bordered
                    columns={columns}
                    data-testid="dimensions-table"
                    dataSource={filteredDimensions}
                    pagination={false}
                    rowKey="id"
                    size="small"
                  />
                </Col>
                <Col span={24}>
                  <Typography.Text type="secondary">
                    {t('message.system-dimensions-are-read-only')}
                  </Typography.Text>
                </Col>
              </Row>
            </Collapse.Panel>
          </Collapse>
        </Col>
      </Row>

      {formDrawer}

      <Modal
        cancelText={t('label.cancel')}
        confirmLoading={isSaving}
        data-testid="delete-dimension-modal"
        okButtonProps={{ danger: true }}
        okText={t('label.delete-entity', { entity: t('label.dimension') })}
        open={Boolean(deleting)}
        title={t('label.delete-entity', {
          entity: deleting?.displayName ?? deleting?.name ?? '',
        })}
        onCancel={() => setDeleting(undefined)}
        onOk={handleDelete}>
        <Typography.Paragraph>
          {t('message.delete-dimension-confirmation')}
        </Typography.Paragraph>
        {deletingCount > 0 && (
          <div className="dimension-delete-warning">
            <Typography.Text strong>
              {t('message.dimension-in-use-count', { count: deletingCount })}
            </Typography.Text>
            <Typography.Paragraph className="m-b-0">
              {t('message.dimension-delete-fallback')}
            </Typography.Paragraph>
          </div>
        )}
      </Modal>
    </PageLayoutV1>
  );
};

export default DataQualitySettingsPage;
