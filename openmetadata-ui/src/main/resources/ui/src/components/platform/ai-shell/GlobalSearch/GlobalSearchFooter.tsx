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
import {
  Badge,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { KEY_HINT } from './GlobalSearch.constants';
import { GlobalSearchFooterAction } from './GlobalSearch.types';

export interface GlobalSearchFooterProps {
  action?: GlobalSearchFooterAction;
  /** What Enter does on the highlighted option, if one is highlighted. */
  enterLabel?: string;
  /** Short name of the query action, shown when one is available. */
  actionHint?: string;
  showActionHint: boolean;
  showTabHint: boolean;
}

// The key-hint strip is not a control, so it is a plain pill-shaped box; the
// footer link beside it is a core pill Button.
const PILL_CLASS =
  'tw:pointer-events-auto tw:flex tw:h-10 tw:items-center tw:rounded-full tw:border tw:border-secondary tw:bg-overlay-surface tw:shadow-lg';

const Hint = ({ label, keys }: { label?: string; keys: string[] }) => (
  <Box align="center" gap={2}>
    <Typography color="secondary" size="text-xs" weight="medium">
      {label}
    </Typography>
    <Box gap={1}>
      {keys.map((key) => (
        <Badge color="gray" key={key} size="sm" type="modern">
          {key}
        </Badge>
      ))}
    </Box>
  </Box>
);

/**
 * Floats over the bottom of the result list: the contextual link on the left
 * and the key hints on the right, over a fade so rows scroll out beneath it.
 */
const GlobalSearchFooter = ({
  action,
  enterLabel,
  actionHint,
  showActionHint,
  showTabHint,
}: GlobalSearchFooterProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="end"
      className={classNames(
        'tw:pointer-events-none tw:absolute tw:inset-x-0 tw:bottom-0 tw:z-10 tw:px-3 tw:pt-7 tw:pb-3',
        'tw:bg-linear-to-b tw:from-transparent tw:via-bg-overlay-surface/90 tw:to-bg-overlay-surface'
      )}
      gap={3}
      justify="between">
      <Box>
        {action ? (
          <Button
            pill
            className="tw:pointer-events-auto"
            color="secondary"
            data-testid="global-search-footer-action"
            iconTrailing={ArrowRight}
            size="sm"
            onClick={action.onPress}>
            {action.label}
          </Button>
        ) : null}
      </Box>
      <Box className={`${PILL_CLASS} tw:pr-2 tw:pl-4`} gap={4}>
        {enterLabel ? (
          <Hint keys={[KEY_HINT.enter]} label={enterLabel} />
        ) : null}
        {showActionHint ? (
          <Hint keys={[KEY_HINT.mod, KEY_HINT.enter]} label={actionHint} />
        ) : null}
        {showTabHint ? (
          <Hint keys={[KEY_HINT.tab]} label={t('label.filter-plural')} />
        ) : null}
        <Hint keys={[KEY_HINT.esc]} label={t('label.close')} />
      </Box>
    </Box>
  );
};

export default GlobalSearchFooter;
