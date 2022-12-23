import { Card, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { InheritedRolesCardProps } from './InheritedRolesCard.interface';
import './InheritedRolesCard.style.less';

const InheritedRolesCard = ({ userData }: InheritedRolesCardProps) => {
  const { t } = useTranslation();

  return (
    <Card
      className="relative page-layout-v1-left-panel"
      key="inherited-roles-card-component"
      title={
        <div className="flex">
          <h6 className="heading mb-0" data-testid="inherited-roles-heading">
            {t('label.inherited-roles')}
          </h6>
        </div>
      }>
      <Fragment>
        {isEmpty(userData.inheritedRoles) ? (
          <div className="mb-4">
            <span className="inherited-no-description">
              {t('label.no-inherited-found')}
            </span>
          </div>
        ) : (
          <div className="flex justify-between flex-col">
            {userData.inheritedRoles?.map((inheritedRole, i) => (
              <div className="mb-2 flex items-center gap-2" key={i}>
                <SVGIcons alt="icon" className="w-4" icon={Icons.USERS} />

                <Typography.Text
                  className="ant-typography-ellipsis-custom w-48"
                  ellipsis={{ tooltip: true }}>
                  {getEntityName(inheritedRole)}
                </Typography.Text>
              </div>
            ))}
          </div>
        )}
      </Fragment>
    </Card>
  );
};

export default InheritedRolesCard;
