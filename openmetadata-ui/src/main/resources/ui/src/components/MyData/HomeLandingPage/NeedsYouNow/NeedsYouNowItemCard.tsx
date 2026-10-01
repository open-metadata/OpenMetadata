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
  Avatar,
  Button,
  Dot,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckCircle, XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { NEEDS_YOU_NOW_KINDS, NeedsYouNowItem } from './needsYouNow.types';

export interface NeedsYouNowItemCardProps {
  item: NeedsYouNowItem;
  /** Resolving an item removes it from the inbox, whichever control did it. */
  onResolve: (id: string) => void;
}

const NeedsYouNowItemCard: React.FC<NeedsYouNowItemCardProps> = ({
  item,
  onResolve,
}) => {
  const { t } = useTranslation();
  const kind = NEEDS_YOU_NOW_KINDS[item.kind];
  const KindIcon = kind.icon;
  const resolve = () => onResolve(item.id);

  return (
    <li
      className="tw:flex tw:items-start tw:gap-3.5 tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-4 tw:shadow-xs tw:transition-colors tw:hover:border-brand"
      data-testid={`needs-you-now-item-${item.id}`}>
      <div
        aria-hidden
        className={classNames(
          'tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg',
          kind.tile
        )}>
        <KindIcon height={19} width={19} />
      </div>

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          {/* `!` on every colour below: Typography renders `.prose`, whose
            unlayered `color` rule is emitted after the Tailwind utilities and
            would otherwise silently win. */}
          <Typography
            className="tw:text-text-primary!"
            size="text-sm"
            weight="medium">
            {item.title}
          </Typography>
          <span className="tw:shrink-0 tw:rounded tw:bg-secondary tw:px-1.5 tw:py-0.5 tw:font-mono tw:text-[10px] tw:font-medium tw:text-text-secondary">
            {item.ref}
          </span>
        </div>

        <Typography
          className="tw:max-w-prose tw:text-pretty tw:text-text-secondary!"
          size="text-sm">
          {item.summary}
        </Typography>

        <div className="tw:mt-1 tw:flex tw:min-w-0 tw:items-center tw:gap-2">
          <Avatar
            alt={item.actor}
            colorVariant="neutral"
            initials={item.actor.charAt(0).toUpperCase()}
            size="xs"
          />
          <Typography
            className="tw:min-w-0 tw:text-text-tertiary!"
            ellipsis={{ rows: 1 }}
            size="text-xs">
            {item.actor}
          </Typography>
          <Dot className="tw:text-utility-gray-blue-200" size="xs" />
          <Typography
            className="tw:shrink-0 tw:text-text-tertiary!"
            size="text-xs">
            {item.age}
          </Typography>
        </div>
      </div>

      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
        {item.kind === 'approval' ? (
          <>
            <Button color="secondary" size="sm" onPress={resolve}>
              {t('label.reject')}
            </Button>
            <Button color="primary" size="sm" onPress={resolve}>
              {t('label.approve')}
            </Button>
          </>
        ) : (
          item.actionLabel && (
            <Button color="secondary" size="sm" onPress={resolve}>
              {item.actionLabel}
            </Button>
          )
        )}

        <Dropdown.Root>
          <Dropdown.DotsButton data-testid={`needs-you-now-menu-${item.id}`} />
          <Dropdown.Popover>
            <Dropdown.Menu aria-label={item.title}>
              <Dropdown.Item
                icon={CheckCircle}
                label={t('label.mark-as-done')}
                onAction={resolve}
              />
              <Dropdown.Item
                icon={XClose}
                label={t('label.dismiss')}
                onAction={resolve}
              />
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      </div>
    </li>
  );
};

export default NeedsYouNowItemCard;
