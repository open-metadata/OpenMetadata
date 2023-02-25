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
