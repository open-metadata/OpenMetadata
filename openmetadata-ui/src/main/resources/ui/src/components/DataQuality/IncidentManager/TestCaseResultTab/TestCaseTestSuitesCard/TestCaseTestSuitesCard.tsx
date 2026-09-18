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
import { Tooltip } from '@openmetadata/ui-core-components';
import {
  Table as TableIcon,
  TestSuite as TestSuiteIcon,
} from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { Focusable } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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

  return (
    <WidgetCard
      dataTestId="test-suites-container"
      isExpandDisabled={isEmpty(testSuites)}
      title={t('label.test-suite-plural')}>
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0">
        {testSuites.map((testSuite) => {
          const { name, path } = getTestSuiteLink(testSuite);
          const Icon = testSuite.basic ? TableIcon : TestSuiteIcon;

          return (
            <li
              className="tw:min-w-0"
              key={testSuite.id ?? testSuite.fullyQualifiedName}>
              {/* Long names truncate in the narrow rail; the tooltip shows the
                  full name, and Focusable lets the link itself be its trigger. */}
              <Tooltip placement="top" title={name}>
                <Focusable>
                  <Link
                    className="tw:flex tw:min-w-0 tw:items-center tw:gap-2 tw:text-sm"
                    data-testid={`test-suite-link-${testSuite.fullyQualifiedName}`}
                    to={path}>
                    <Icon
                      className="tw:shrink-0 tw:text-quaternary"
                      size={16}
                    />
                    <span className="tw:sr-only">
                      {`${
                        testSuite.basic
                          ? t('label.table')
                          : t('label.bundle-suite')
                      } `}
                    </span>
                    <span className="tw:truncate">{name}</span>
                  </Link>
                </Focusable>
              </Tooltip>
            </li>
          );
        })}
      </ul>
    </WidgetCard>
  );
};

export default TestCaseTestSuitesCard;
