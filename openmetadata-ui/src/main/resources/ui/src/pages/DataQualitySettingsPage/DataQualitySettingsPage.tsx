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
  Drawer,
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
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { DIMENSION_COLOR_PALETTE } from '../../constants/DataQualityDimension.constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { DataQualityDimension } from '../../generated/tests/dataQualityDimension';
import { ProviderType } from '../../generated/tests/testDefinition';
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
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);

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

  const openDrawer = useCallback(
    (dimension: DataQualityDimension | null) => {
      const color = dimension?.style?.color ?? DEFAULT_COLOR;
      setEditing(dimension);
      setSelectedColor(color);
      form.setFieldsValue({
        name: dimension?.name ?? '',
        displayName: dimension?.displayName ?? '',
        description: dimension?.description ?? '',
        color,
      });
    },
    [form]
  );

  const closeDrawer = useCallback(() => {
    setEditing(undefined);
    form.resetFields();
  }, [form]);

  const handleSave = useCallback(
    async (values: DimensionFormValues) => {
      setIsSaving(true);
      try {
        if (editing) {
          const updated: DataQualityDimension = {
            ...editing,
            displayName: values.displayName || undefined,
            description: values.description || undefined,
            style: { ...editing.style, color: selectedColor },
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
            style: { color: selectedColor },
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
        closeDrawer();
        await fetchDimensions();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsSaving(false);
      }
    },
    [editing, selectedColor, closeDrawer, fetchDimensions, t]
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
                onClick={() => openDrawer(record)}>
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
    [t, testCaseCounts, openDrawer]
  );

  if (isLoading) {
    return <Loader />;
  }

  const deletingCount = testCaseCounts[deleting?.id ?? ''] ?? 0;

  return (
    <PageLayoutV1 pageTitle={t('label.data-quality')}>
      <div className="m-b-mlg">
        <TitleBreadcrumb titleLinks={breadcrumbs} />
      </div>
      <Row className="data-quality-settings-page" gutter={[0, 20]}>
        <Col span={24}>
          <PageHeader
            data={{
              header: t('label.data-quality'),
              subHeader: t('message.page-sub-header-for-data-quality-settings'),
            }}
          />
        </Col>
        <Col span={24}>
          <Row align="middle" gutter={[16, 16]} justify="space-between">
            <Col>
              <PageHeader
                data={{
                  header: `${t('label.dimension-plural')} (${
                    dimensions.length
                  })`,
                  subHeader: t('message.data-quality-dimensions-description'),
                }}
              />
            </Col>
            <Col>
              <Space size={12}>
                <Input.Search
                  allowClear
                  data-testid="search-dimensions"
                  placeholder={t('label.search-entity', {
                    entity: t('label.dimension-plural'),
                  })}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                <Button
                  data-testid="add-dimension"
                  icon={<PlusOutlined />}
                  type="primary"
                  onClick={() => openDrawer(null)}>
                  {t('label.add-entity', { entity: t('label.dimension') })}
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

      <Drawer
        destroyOnClose
        data-testid="dimension-drawer"
        footer={
          <Space className="dimension-drawer-footer">
            <Button onClick={closeDrawer}>{t('label.cancel')}</Button>
            <Button
              data-testid="save-dimension"
              loading={isSaving}
              type="primary"
              onClick={form.submit}>
              {t('label.save')}
            </Button>
          </Space>
        }
        open={editing !== undefined}
        title={
          editing
            ? t('label.edit-entity', { entity: t('label.dimension') })
            : t('label.create-entity', { entity: t('label.dimension') })
        }
        width={480}
        onClose={closeDrawer}>
        <Form<DimensionFormValues>
          form={form}
          layout="vertical"
          onFinish={handleSave}>
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
            <Input
              data-testid="dimension-name"
              disabled={Boolean(editing)}
              placeholder="freshness"
            />
          </Form.Item>
          <Form.Item
            extra={t('message.dimension-display-name-help')}
            label={t('label.display-name')}
            name="displayName">
            <Input data-testid="dimension-display-name" placeholder="Freshness" />
          </Form.Item>
          <Form.Item label={t('label.description')} name="description">
            <Input.TextArea
              data-testid="dimension-description"
              placeholder={t('message.dimension-description-placeholder')}
              rows={4}
            />
          </Form.Item>
          <Form.Item label={t('label.colour')}>
            <Space size={8} wrap>
              {DIMENSION_COLOR_PALETTE.map((color) => (
                <button
                  aria-label={color}
                  aria-pressed={selectedColor === color}
                  className={`dimension-color-swatch${
                    selectedColor === color ? ' selected' : ''
                  }`}
                  data-testid={`color-${color}`}
                  key={color}
                  style={{ backgroundColor: color }}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </Space>
          </Form.Item>
          <div className="dimension-preview">
            <Typography.Text type="secondary">
              {t('label.preview')}
            </Typography.Text>
            <Space size={8}>
              <span
                className="dimension-color-dot"
                style={{ backgroundColor: selectedColor }}
              />
              <Typography.Text strong>
                {form.getFieldValue('displayName') ||
                  form.getFieldValue('name') ||
                  t('label.dimension')}
              </Typography.Text>
            </Space>
          </div>
        </Form>
      </Drawer>

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
