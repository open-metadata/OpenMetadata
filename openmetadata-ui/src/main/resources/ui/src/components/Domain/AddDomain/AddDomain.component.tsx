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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, Space, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import ResizablePanels from 'components/common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { UserTag } from 'components/common/UserTag/UserTag.component';
import { UserTagSize } from 'components/common/UserTag/UserTag.interface';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { ERROR_MESSAGE } from 'constants/constants';
import { ENTITY_NAME_REGEX } from 'constants/regex.constants';
import { Domain, DomainType } from 'generated/entity/domains/domain';
import { Operation } from 'generated/entity/policies/policy';
import { EntityReference } from 'generated/type/entityLineage';
import { FieldProp, FieldTypes } from 'interface/FormUtils.interface';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { addDomains } from 'rest/domainAPI';
import { getIsErrorMatch } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { generateFormFields, getField } from 'utils/formUtils';
import { checkPermission } from 'utils/PermissionsUtils';
import { getDomainPath } from 'utils/RouterUtils';
import { showErrorToast } from 'utils/ToastUtils';

const AddDomain = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [form] = useForm();
  const { permissions } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const goToDomain = (name = '') => {
    history.push(getDomainPath(name));
  };

  const handleCancel = useCallback(() => {
    goToDomain();
  }, []);

  const slashedBreadcrumb = [
    {
      name: t('label.domain'),
      url: getDomainPath(),
    },
    {
      name: t('label.add-entity', {
        entity: t('label.domain'),
      }),
      url: '',
      activeTitle: true,
    },
  ];

  const createPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  const selectedOwner = Form.useWatch<EntityReference | undefined>(
    'owner',
    form
  );

  const onSave = useCallback(async (data: Domain) => {
    setIsLoading(true);
    try {
      const res = await addDomains(data);
      goToDomain(res.fullyQualifiedName ?? '');
    } catch (error) {
      showErrorToast(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.domain'),
              entityPlural: t('label.domain-lowercase-plural'),
              name: data.name,
            })
          : (error as AxiosError),
        t('server.add-entity-error', {
          entity: t('label.domain-lowercase'),
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const rightPanel = (
    <div data-testid="right-panel">
      <Typography.Title level={5}>
        {t('label.configure-entity', {
          entity: t('label.domain'),
        })}
      </Typography.Title>
    </div>
  );

  const domainTypeArray = Object.keys(DomainType).map((key) => ({
    key,
    value: DomainType[key as keyof typeof DomainType],
  }));
  const formFields: FieldProp[] = [
    {
      name: 'name',
      id: 'root/name',
      label: t('label.name'),
      required: true,
      placeholder: t('label.name'),
      type: FieldTypes.TEXT,
      props: {
        'data-testid': 'name',
      },
      rules: [
        {
          pattern: ENTITY_NAME_REGEX,
          message: t('message.entity-name-validation'),
        },
        {
          min: 1,
          max: 128,
          message: `${t('message.entity-maximum-size', {
            entity: `${t('label.name')}`,
            max: '128',
          })}`,
        },
      ],
    },
    {
      name: 'displayName',
      id: 'root/displayName',
      label: t('label.display-name'),
      required: false,
      placeholder: t('label.display-name'),
      type: FieldTypes.TEXT,
      props: {
        'data-testid': 'display-name',
      },
    },
    {
      name: 'description',
      required: true,
      label: t('label.description'),
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: '',
        height: '170px',
      },
    },
    {
      name: 'domainType',
      required: true,
      label: t('label.domain-type'),
      id: 'root/domainType',
      type: FieldTypes.SELECT,
      props: {
        'data-testid': 'domainType',
        options: domainTypeArray,
      },
    },
  ];

  const ownerField: FieldProp = {
    name: 'owner',
    id: 'root/owner',
    required: false,
    label: t('label.owner'),
    type: FieldTypes.USER_TEAM_SELECT,
    props: {
      hasPermission: true,
      children: (
        <Button
          data-testid="add-owner"
          icon={<PlusOutlined style={{ color: 'white', fontSize: '12px' }} />}
          size="small"
          type="primary"
        />
      ),
    },
    formItemLayout: 'horizontal',
    formItemProps: {
      valuePropName: 'owner',
      trigger: 'onUpdate',
    },
  };

  return (
    <ResizablePanels
      firstPanel={{
        children: (
          <div className="max-width-md w-9/10 service-form-container">
            <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
            <Typography.Title
              className="m-t-md"
              data-testid="form-heading"
              level={5}>
              {t('label.add-entity', {
                entity: t('label.domain'),
              })}
            </Typography.Title>
            <div data-testid="add-domain">
              <Form form={form} layout="vertical" onFinish={onSave}>
                {generateFormFields(formFields)}
                <div className="m-t-xss">
                  {getField(ownerField)}
                  {selectedOwner && (
                    <div className="m-y-xs" data-testid="owner-container">
                      <UserTag
                        id={selectedOwner.id}
                        name={getEntityName(selectedOwner)}
                        size={UserTagSize.small}
                      />
                    </div>
                  )}
                </div>

                <Space
                  className="w-full justify-end"
                  data-testid="cta-buttons"
                  size={16}>
                  <Button
                    data-testid="cancel-domain"
                    type="link"
                    onClick={handleCancel}>
                    {t('label.cancel')}
                  </Button>
                  <Button
                    data-testid="save-domain"
                    disabled={!createPermission}
                    htmlType="submit"
                    loading={isLoading}
                    type="primary">
                    {t('label.save')}
                  </Button>
                </Space>
              </Form>
            </div>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.domain'),
      })}
      secondPanel={{
        children: rightPanel,
        className: 'p-md service-doc-panel',
        minWidth: 60,
        overlay: {
          displayThreshold: 200,
          header: t('label.setup-guide'),
          rotation: 'counter-clockwise',
        },
      }}
    />
  );
};

export default AddDomain;
