/*
 *  Copyright 2025 Collate.
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
import type { ReactNode } from 'react';
import { BlankEmptyPlaceholder } from './blank-empty-placeholder';
import type {
  EmptyPlaceholderFeature,
  EmptyPlaceholderIcon,
  EmptyPlaceholderShellProps,
} from './empty-placeholder-shell';
import { FeaturesEmptyPlaceholder } from './features-empty-placeholder';

export type {
  EmptyPlaceholderAction,
  EmptyPlaceholderFeature,
  EmptyPlaceholderIcon,
  EmptyPlaceholderShellProps,
} from './empty-placeholder-shell';

export type EmptyPlaceholderVariant = 'blank' | 'features';

export interface EmptyPlaceholderProps
  extends Omit<EmptyPlaceholderShellProps, 'children'> {
  /** Selects the layout. 'blank' = icon + title + description; 'features' = feature columns */
  variant?: EmptyPlaceholderVariant;
  /** Icon rendered above the title (only in the 'blank' variant) */
  icon?: EmptyPlaceholderIcon;
  title?: ReactNode;
  description?: ReactNode;
  /** Feature columns rendered in the 'features' variant */
  features?: EmptyPlaceholderFeature[];
}

export const EmptyPlaceholder = ({
  variant = 'blank',
  icon,
  title,
  description,
  features,
  ...shellProps
}: EmptyPlaceholderProps) => {
  let node: ReactNode;
  if (variant === 'features') {
    node = (
      <FeaturesEmptyPlaceholder
        description={description}
        features={features}
        title={title}
        {...shellProps}
      />
    );
  } else {
    node = (
      <BlankEmptyPlaceholder
        description={description}
        icon={icon}
        title={title}
        {...shellProps}
      />
    );
  }

  return node;
};
