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

import { useTranslation } from 'react-i18next';
import { AlignRightIconButton } from '../../../components/common/IconButtons/EditIconButton';
import type { UseTestCaseDetailPageResult } from './useTestCaseDetailPage';

interface TestCaseTabBarExtraContentProps {
  isExpandViewSupported: UseTestCaseDetailPageResult['isExpandViewSupported'];
  isTabExpanded: UseTestCaseDetailPageResult['isTabExpanded'];
  toggleTabExpanded: UseTestCaseDetailPageResult['toggleTabExpanded'];
}

const TestCaseTabBarExtraContent = ({
  isExpandViewSupported,
  isTabExpanded,
  toggleTabExpanded,
}: TestCaseTabBarExtraContentProps) => {
  const { t } = useTranslation();

  if (!isExpandViewSupported) {
    return null;
  }

  return (
    <AlignRightIconButton
      className={isTabExpanded ? 'rotate-180' : ''}
      title={isTabExpanded ? t('label.collapse') : t('label.expand')}
      onClick={toggleTabExpanded}
    />
  );
};

export default TestCaseTabBarExtraContent;
