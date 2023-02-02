/*
 *  Copyright 2022 Collate.
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

import { Space, Tooltip } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { useAuth } from '../../hooks/authHooks';
import { IcDeleteColored } from '../../utils/SvgUtils';
import { useAuthContext } from '../authentication/auth-provider/AuthProvider';
import { Button } from '../buttons/Button/Button';
import DeleteWidgetModal from '../common/DeleteWidget/DeleteWidgetModal';
import Description from '../common/description/Description';
import EntitySummaryDetails from '../common/EntitySummaryDetails/EntitySummaryDetails';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TestSuiteDetailsProps } from './TestSuiteDetails.interfaces';

const TestSuiteDetails = ({
  extraInfo,
  slashedBreadCrumb,
  handleDeleteWidgetVisible,
  isDeleteWidgetVisible,
  isDescriptionEditable,
  testSuite,
  handleUpdateOwner,
  handleRemoveOwner,
  testSuiteDescription,
  descriptionHandler,
  handleDescriptionUpdate,
}: TestSuiteDetailsProps) => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const { t } = useTranslation();

  const hasAccess = isAdminUser || isAuthDisabled;

  return (
    <>
      <Space
        align="center"
        className="tw-justify-between"
        style={{ width: '100%' }}>
        <TitleBreadcrumb
          data-testid="test-suite-breadcrumb"
          titleLinks={slashedBreadCrumb}
        />
        <Tooltip
          title={hasAccess ? t('label.delete') : NO_PERMISSION_FOR_ACTION}>
          <Button
            data-testid="test-suite-delete"
            disabled={!hasAccess}
            size="small"
            theme="primary"
            variant="outlined"
            onClick={() => handleDeleteWidgetVisible(true)}>
            <IcDeleteColored
              className="tw-mr-1.5"
              height={14}
              viewBox="0 0 24 24"
              width={14}
            />
            <span>{t('label.delete')}</span>
          </Button>
        </Tooltip>
        <DeleteWidgetModal
          allowSoftDelete
          isRecursiveDelete
          entityId={testSuite?.id}
          entityName={testSuite?.fullyQualifiedName as string}
          entityType="testSuite"
          visible={isDeleteWidgetVisible}
          onCancel={() => handleDeleteWidgetVisible(false)}
        />
      </Space>

      <div className="tw-flex tw-gap-1 tw-mb-2 tw-mt-1 tw-flex-wrap">
        {extraInfo.map((info, index) => (
          <span className="tw-flex" key={index}>
            <EntitySummaryDetails
              currentOwner={testSuite?.owner}
              data={info}
              removeOwner={handleRemoveOwner}
              updateOwner={hasAccess ? handleUpdateOwner : undefined}
            />
          </span>
        ))}
      </div>

      <Space>
        <Description
          className="test-suite-description"
          description={testSuiteDescription || ''}
          entityName={testSuite?.displayName ?? testSuite?.name}
          hasEditAccess={hasAccess}
          isEdit={isDescriptionEditable}
          onCancel={() => descriptionHandler(false)}
          onDescriptionEdit={() => descriptionHandler(true)}
          onDescriptionUpdate={handleDescriptionUpdate}
        />
      </Space>
    </>
  );
};

export default TestSuiteDetails;
