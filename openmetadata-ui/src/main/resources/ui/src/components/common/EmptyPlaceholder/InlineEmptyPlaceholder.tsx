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

import { Typography } from '@openmetadata/ui-core-components';
import { InlineEmptyPlaceholderProps } from './EmptyPlaceholder.interface';

/**
 * A short "nothing here yet" note inside a section of a panel, left-aligned
 * with the section's content. `box` is a grey box with an optional hint;
 * `text` is a single line. Page- or list-level empty states use the centred
 * placeholders instead.
 */
const InlineEmptyPlaceholder = ({
  title,
  description,
  variant = 'box',
  'data-testid': dataTestId = 'inline-empty-placeholder',
}: InlineEmptyPlaceholderProps) =>
  variant === 'text' ? (
    <Typography
      as="p"
      className="tw:m-0"
      color="secondary"
      data-testid={dataTestId}
      size="text-sm">
      {title}
    </Typography>
  ) : (
    <div
      className="tw:flex tw:flex-col tw:rounded-lg tw:bg-secondary_alt tw:px-4 tw:py-3.5"
      data-testid={dataTestId}>
      <Typography size="text-sm">{title}</Typography>
      {description ? (
        <Typography color="secondary" size="text-xs">
          {description}
        </Typography>
      ) : null}
    </div>
  );

export default InlineEmptyPlaceholder;
