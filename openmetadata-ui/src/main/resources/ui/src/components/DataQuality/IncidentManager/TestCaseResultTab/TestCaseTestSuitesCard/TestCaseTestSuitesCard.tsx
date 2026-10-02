/*
 *  Copyright 2026 Collate.
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
import { Button, Tooltip } from '@openmetadata/ui-core-components';
import {
  Table as TableIcon,
  TestSuite as TestSuiteIcon,
} from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { useState } from 'react';
import { Focusable } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LIST_SIZE } from '../../../../../constants/constants';
import { TestSuite } from '../../../../../generated/tests/testSuite';
import WidgetCard from '../../../../common/WidgetCard/WidgetCard';
import { getTestSuiteLink } from './TestCaseTestSuitesCard.utils';

interface TestCaseTestSuitesCardProps {
  testSuites?: TestSuite[];
}

const TestCaseTestSuitesCard = ({
  testSuites = [],
}: TestCaseTestSuitesCardProps) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const hiddenCount = testSuites.length - LIST_SIZE;
  const visibleSuites = showAll ? testSuites : testSuites.slice(0, LIST_SIZE);

  return (
    <WidgetCard
      dataTestId="test-suites-container"
      isExpandDisabled={isEmpty(testSuites)}
      title={t('label.test-suite-plural')}>
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0">
        {visibleSuites.map((testSuite) => {
          const { name, path } = getTestSuiteLink(testSuite);
          const Icon = testSuite.basic ? TableIcon : TestSuiteIcon;

          return (
            <li
              className="tw:flex tw:min-w-0 tw:items-center tw:gap-2"
              key={testSuite.id ?? testSuite.fullyQualifiedName}>
              <Icon className="tw:shrink-0 tw:text-quaternary" size={16} />
              {/* Long names truncate in the narrow rail; the tooltip shows the
                  full name, and Focusable lets the link itself be its trigger.
                  The link is only as wide as the name, so the rest of the row
                  neither navigates nor opens the tooltip. */}
              <Tooltip placement="top" title={name}>
                <Focusable>
                  <Link
                    className="tw:min-w-0 tw:truncate tw:text-sm"
                    data-testid={`test-suite-link-${testSuite.fullyQualifiedName}`}
                    to={path}>
                    <span className="tw:sr-only">
                      {`${
                        testSuite.basic
                          ? t('label.table')
                          : t('label.bundle-suite')
                      } `}
                    </span>
                    {name}
                  </Link>
                </Focusable>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <Button
          className="tw:mt-2"
          color="link-color"
          data-testid="test-suites-show-more"
          size="xs"
          onClick={() => setShowAll(!showAll)}>
          {showAll
            ? t('label.less')
            : t('label.plus-count-more', { count: hiddenCount })}
        </Button>
      )}
    </WidgetCard>
  );
};

export default TestCaseTestSuitesCard;
