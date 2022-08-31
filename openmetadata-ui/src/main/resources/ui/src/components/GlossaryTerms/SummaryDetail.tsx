import { Button, Space, Tooltip, Typography } from 'antd';
import { isString, isUndefined, kebabCase } from 'lodash';
import { FormattedGlossaryTermData } from 'Models';
import React from 'react';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { TermReference } from '../../generated/entity/data/glossaryTerm';
import SVGIcons from '../../utils/SvgUtils';

interface SummaryDetailsProps {
  title: string;
  children: React.ReactElement;
  hasAccess: boolean;
  setShow?: (value: React.SetStateAction<boolean>) => void;
  data?: FormattedGlossaryTermData[] | TermReference[] | string;
}

const SummaryDetail = ({
  title,
  children,
  setShow,
  data,
  hasAccess,
  ...props
}: SummaryDetailsProps) => {
  return (
    <Space direction="vertical" {...props}>
      <Space>
        <Typography.Text type="secondary">{title}</Typography.Text>
        <div className="tw-ml-2" data-testid={`section-${kebabCase(title)}`}>
          <Tooltip title={hasAccess ? 'Add' : NO_PERMISSION_FOR_ACTION}>
            <Button
              className="tw-cursor-pointer"
              data-testid="add-button"
              disabled={!hasAccess}
              size="small"
              type="text"
              onClick={() => setShow && setShow(true)}>
              <SVGIcons
                alt="icon-plus-primary"
                icon="icon-plus-primary-outlined"
              />
            </Button>
          </Tooltip>
        </div>
      </Space>
      {!isString(data) && !isUndefined(data) && data.length > 0 ? (
        <div className="tw-flex" data-testid={`${kebabCase(title)}-container`}>
          {children}
        </div>
      ) : (
        <div data-testid={`${kebabCase(title)}-container`}>{children}</div>
      )}
    </Space>
  );
};

export default SummaryDetail;
