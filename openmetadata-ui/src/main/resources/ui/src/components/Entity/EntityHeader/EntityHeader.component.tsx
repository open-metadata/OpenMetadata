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
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Row } from 'antd';
import Col from 'antd/es/grid/col';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import { getTableDetailsPath } from 'constants/constants';
import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from 'utils/EntityUtils';
import EntityHeaderTitle from '../EntityHeaderTitle/EntityHeaderTitle.component';

interface Props {
  extra?: ReactNode;
  breadcrumb: TitleBreadcrumbProps['titleLinks'];
  entityData: {
    displayName?: string;
    name: string;
    fullyQualifiedName?: string;
    deleted?: boolean;
  };
  icon: ReactNode;
  titleIsLink?: boolean;
  openEntityInNewPage?: boolean;
}

export const EntityHeader = ({
  breadcrumb,
  entityData,
  extra,
  icon,
  titleIsLink = false,
  openEntityInNewPage,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Row className="w-full" gutter={12} justify="space-between">
      <Col>
        <div
          className="tw-text-link tw-text-base glossary-breadcrumb m-b-xss"
          data-testid="category-name">
          <TitleBreadcrumb titleLinks={breadcrumb} />
        </div>

        <EntityHeaderTitle
          displayName={getEntityName(entityData)}
          icon={icon}
          link={
            titleIsLink && entityData.fullyQualifiedName
              ? getTableDetailsPath(entityData.fullyQualifiedName)
              : undefined
          }
          name={entityData.name}
          openEntityInNewPage={openEntityInNewPage}
        />
        {entityData.deleted && (
          <div className="deleted-badge-button" data-testid="deleted-badge">
            <ExclamationCircleOutlined className="m-r-sm" />
            {t('label.deleted')}
          </div>
        )}
      </Col>
      <Col>{extra}</Col>
    </Row>
  );
};
