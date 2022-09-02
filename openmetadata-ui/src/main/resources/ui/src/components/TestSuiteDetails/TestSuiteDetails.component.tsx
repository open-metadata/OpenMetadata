import { Space, Tooltip } from 'antd';
import React from 'react';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { IcDeleteColored } from '../../utils/SvgUtils';
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
  testSuiteDescription,
  descriptionHandler,
  handleDescriptionUpdate,
  permissions,
}: TestSuiteDetailsProps) => {
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
          title={permissions.Delete ? 'Delete' : NO_PERMISSION_FOR_ACTION}>
          <Button
            data-testid="test-suite-delete"
            disabled={!permissions.Delete}
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
            <span>Delete</span>
          </Button>
        </Tooltip>
        <DeleteWidgetModal
          allowSoftDelete
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
              data={info}
              updateOwner={
                permissions.EditOwner ? handleUpdateOwner : undefined
              }
            />
          </span>
        ))}
      </div>

      <Space>
        <Description
          className="test-suite-description"
          description={testSuiteDescription || ''}
          entityName={testSuite?.displayName ?? testSuite?.name}
          hasEditAccess={permissions.EditDescription}
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
