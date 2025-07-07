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
import { Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { Fragment, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ERROR_MESSAGE, ES_MAX_PAGE_SIZE } from '../../../constants/constants';
import { DOMAIN_TYPE_DATA } from '../../../constants/Domain.constants';
import { CreateDataProduct } from '../../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../../generated/api/domains/createDomain';
import { useDomainStore } from '../../../hooks/useDomainStore';
import { addDomains, getDomainList } from '../../../rest/domainAPI';
import { getIsErrorMatch } from '../../../utils/CommonUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import AddDomainForm from '../AddDomainForm/AddDomainForm.component';
import { DomainFormType } from '../DomainPage.interface';
import './add-domain.less';

const AddDomain = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { updateDomainLoading, updateDomains } = useDomainStore();

  const refreshDomains = useCallback(async () => {
    try {
      updateDomainLoading(true);
      const { data } = await getDomainList({
        limit: ES_MAX_PAGE_SIZE,
        fields: 'parent',
      });
      updateDomains(data);
    } catch (error) {
      // silent fail
    } finally {
      updateDomainLoading(false);
    }
  }, []);

  const goToDomain = (name = '') => {
    navigate(getDomainPath(name));
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

  const onSave = useCallback(
    async (formData: CreateDomain | CreateDataProduct) => {
      setIsLoading(true);
      try {
        const res = await addDomains(formData as CreateDomain);
        refreshDomains();
        goToDomain(res.fullyQualifiedName ?? '');
      } catch (error) {
        showErrorToast(
          getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
            ? t('server.entity-already-exist', {
                entity: t('label.domain'),
                entityPlural: t('label.domain-lowercase-plural'),
                name: formData.name,
              })
            : (error as AxiosError),
          t('server.add-entity-error', {
            entity: t('label.domain-lowercase'),
          })
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const rightPanel = (
    <div data-testid="right-panel">
      <Typography.Title level={3}>
        {t('label.configure-entity', {
          entity: t('label.domain'),
        })}
      </Typography.Title>
      <Typography.Text className="mb-5">
        {t('message.create-new-domain-guide')}
      </Typography.Text>

      <Typography.Title level={4}>{t('label.domain-type')}</Typography.Title>
      <Typography.Text className="mb-5">
        {t('message.domain-type-guide')}
      </Typography.Text>
      <Space className="m-t-md" direction="vertical" size="middle">
        {DOMAIN_TYPE_DATA.map(({ type, description }) => (
          <Fragment key={type}>
            <Space direction="vertical" size={0}>
              <Typography.Title level={5}>{`${type} :`}</Typography.Title>
              <Typography.Paragraph className="m-0">
                {description}
              </Typography.Paragraph>
            </Space>
          </Fragment>
        ))}
      </Space>
    </div>
  );

  return (
    <PageLayoutV1
      pageTitle={t('label.add-entity', {
        entity: t('label.domain'),
      })}>
      <ResizablePanels
        className="content-height-with-resizable-panel p-x-box"
        firstPanel={{
          className: 'content-resizable-panel-container',
          children: (
            <div>
              <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
              <Typography.Title
                className="m-t-md"
                data-testid="form-heading"
                level={5}>
                {t('label.add-entity', {
                  entity: t('label.domain'),
                })}
              </Typography.Title>
              <AddDomainForm
                isFormInDialog={false}
                loading={isLoading}
                type={DomainFormType.DOMAIN}
                onCancel={handleCancel}
                onSubmit={onSave}
              />
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
          className: 'content-resizable-panel-container',
          minWidth: 400,
          flex: 0.3,
        }}
      />
    </PageLayoutV1>
  );
};

export default AddDomain;
