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
import { Button } from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { KEY_HINT } from './GlobalSearch.constants';
import { GlobalSearchFooterAction } from './GlobalSearch.types';
import GlobalSearchKbd from './GlobalSearchKbd';

export interface GlobalSearchFooterProps {
  action?: GlobalSearchFooterAction;
  /** What Enter does on the highlighted result row, if one is highlighted. */
  enterLabel?: string;
  isAskAiActive: boolean;
  /** Short name of the assistant action, shown when it is available. */
  askAiLabel?: string;
  showAskAi: boolean;
  showTabHint: boolean;
  hasQuery: boolean;
}

const GlobalSearchFooter = ({
  action,
  enterLabel,
  isAskAiActive,
  askAiLabel,
  showAskAi,
  showTabHint,
  hasQuery,
}: GlobalSearchFooterProps) => {
  const { t } = useTranslation();
  const enterHint = isAskAiActive ? askAiLabel : enterLabel;

  return (
    <div className="tw:flex tw:items-center tw:gap-4 tw:border-t tw:border-secondary tw:px-4 tw:py-2.5">
      <span className="tw:flex-1">
        {action ? (
          <Button
            color="link-color"
            data-testid="global-search-footer-action"
            iconTrailing={ArrowRight}
            size="sm"
            onClick={action.onPress}>
            {action.label}
          </Button>
        ) : null}
      </span>
      <div className="tw:flex tw:items-center tw:gap-4 tw:text-xs tw:text-tertiary">
        {enterHint ? (
          <span className="tw:flex tw:items-center tw:gap-1.5">
            {enterHint}
            <GlobalSearchKbd>{KEY_HINT.enter}</GlobalSearchKbd>
          </span>
        ) : null}
        {showAskAi ? (
          <span className="tw:flex tw:items-center tw:gap-1.5">
            {askAiLabel}
            <GlobalSearchKbd>{KEY_HINT.mod}</GlobalSearchKbd>
            <GlobalSearchKbd>{KEY_HINT.enter}</GlobalSearchKbd>
          </span>
        ) : null}
        {showTabHint ? (
          <span className="tw:flex tw:items-center tw:gap-1.5">
            {t('label.filter-plural')}
            <GlobalSearchKbd>{KEY_HINT.tab}</GlobalSearchKbd>
          </span>
        ) : null}
        <span className="tw:flex tw:items-center tw:gap-1.5">
          {t(hasQuery ? 'label.clear' : 'label.close')}
          <GlobalSearchKbd>{KEY_HINT.esc}</GlobalSearchKbd>
        </span>
      </div>
    </div>
  );
};

export default GlobalSearchFooter;
