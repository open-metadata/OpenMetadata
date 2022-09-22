import { Card } from 'antd';
import React from 'react';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';

const AuthCommonCard = ({
  children,
  classNames,
}: {
  children: JSX.Element;
  classNames?: string;
}) => {
  return (
    <div className="flex-center h-min-100">
      <Card className={`w-max-500 card-box-shadow ${classNames}`}>
        <div className="m-16 children-container">
          <div className="flex-center mt-4 mb-4">
            <SVGIcons alt="OpenMetadata Logo" icon={Icons.LOGO} width="152" />
          </div>
          <>{children}</>
        </div>
      </Card>
    </div>
  );
};

export default AuthCommonCard;
