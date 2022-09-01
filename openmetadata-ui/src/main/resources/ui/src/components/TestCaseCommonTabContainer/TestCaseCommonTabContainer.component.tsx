import { Button, Col, Row, Tooltip } from 'antd';
import { isUndefined } from 'lodash';
import React from 'react';
import { PAGE_SIZE } from '../../constants/constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { Paging } from '../../generated/type/paging';
import NextPrevious from '../common/next-previous/NextPrevious';

interface Props {
  buttonName: string;
  hasAccess: boolean;
  showButton?: boolean;
  children?: JSX.Element;
  paging?: Paging;
  onButtonClick?: () => void;
  currentPage?: number;
  testCasePageHandler?: (
    cursorValue: string | number,
    activePage?: number | undefined
  ) => void;
  isPaging?: boolean;
}

const TestCaseCommonTabContainer = ({
  buttonName,
  children,
  paging,
  currentPage,
  testCasePageHandler,
  onButtonClick,
  showButton = true,
  isPaging = false,
  hasAccess,
}: Props) => {
  const NextPreviousComponent = () => {
    if (
      isPaging &&
      !isUndefined(paging) &&
      paging?.total > PAGE_SIZE &&
      !isUndefined(currentPage) &&
      testCasePageHandler
    ) {
      return (
        <Col span={24}>
          <NextPrevious
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            paging={paging}
            pagingHandler={testCasePageHandler}
            totalCount={paging.total}
          />
        </Col>
      );
    }

    return null;
  };

  return (
    <Row className="tw-mt-4" gutter={[16, 16]}>
      {showButton && (
        <Col className="tw-flex tw-justify-end" span={24}>
          <Tooltip title={hasAccess ? buttonName : NO_PERMISSION_FOR_ACTION}>
            <Button
              disabled={!hasAccess}
              type="primary"
              onClick={onButtonClick}>
              {buttonName}
            </Button>
          </Tooltip>
        </Col>
      )}
      {children}
      <NextPreviousComponent />
    </Row>
  );
};

export default TestCaseCommonTabContainer;
