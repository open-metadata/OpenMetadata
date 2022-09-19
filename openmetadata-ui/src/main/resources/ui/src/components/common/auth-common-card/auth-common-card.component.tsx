import { Card } from 'antd';
import React from 'react';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import './auth-common-card.styles.less';

const AuthCommonCard = ({
  children,
  classNames,
}: {
  children: JSX.Element;
  classNames?: string;
}) => {
  return (
    <div className="flex-center h-min-100">
      <Card
        className={`w-max-500 p-16 card-box-shadow common-card ${classNames}`}>
        <>
          <div className="flex-center mt-4 mb-4">
            <SVGIcons alt="OpenMetadata Logo" icon={Icons.LOGO} width="152" />
          </div>
          <>{children}</>
        </>
      </Card>
    </div>
  );
};

export default AuthCommonCard;
