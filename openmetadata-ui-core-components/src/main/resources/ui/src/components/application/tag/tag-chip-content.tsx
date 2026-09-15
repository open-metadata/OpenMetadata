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
import { FC, lazy, ReactNode, Suspense } from 'react';
import { Link as AriaLink } from 'react-aria-components';

// Lazy-loaded so the common case (no `icon` string prop — just a variant's
// default icon) never pulls ICON_MAP's ~44 icon components into the eager
// bundle. ICON_MAP is a plain object literal, so a bundler cannot tree-shake
// individual unused icons out of it — only avoiding the import entirely does.
// Icon is deliberately NOT re-exported from the root barrel (see
// components/index.ts) so this dynamic import actually gets its own chunk
// instead of being subsumed into whatever already imports the barrel statically.
const Icon = lazy(() =>
  import('../../foundations/icon/icon').then((m) => ({ default: m.Icon }))
);

interface TagChipContentProps {
  label: string;
  maxWidth: string | number;
  /** ICON_MAP key or image URL. When omitted, `defaultIcon` renders instead. */
  icon?: string;
  /** Rendered when `icon` is not provided. */
  defaultIcon: ReactNode;
  href?: string;
  labelClassName?: string;
  iconSize: number;
  iconTestId?: string;
}

/**
 * Pure inner content (icon + label + optional link) shared by every entity
 * tag chip variant (Classification/Glossary/Domain/DataProduct/AutoClassification).
 * Has no knowledge of Badge/Tooltip — those are composed by each variant.
 */
export const TagChipContent: FC<TagChipContentProps> = ({
  label,
  maxWidth,
  icon,
  defaultIcon,
  href,
  labelClassName,
  iconSize,
  iconTestId,
}) => {
  const iconNode = icon ? (
    <Suspense fallback={null}>
      <Icon iconValue={icon} imageClassName="tag-color-text" size={iconSize} />
    </Suspense>
  ) : (
    defaultIcon
  );

  const labelNode = (
    <div style={{ maxWidth }}>
      <span className={`tw:block tw:truncate ${labelClassName}`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className='tw:flex tw:items-center tw:gap-1'>
      {iconNode && (
        <span
          aria-hidden
          className="tw:inline-flex tw:shrink-0 tw:items-center"
          data-testid={iconTestId}>
          {iconNode}
        </span>
      )}
      {href ? (
        <AriaLink
          className="tw:no-underline tw:min-w-0"
          data-testid="tag-redirect-link"
          href={href}>
          {labelNode}
        </AriaLink>
      ) : (
        labelNode
      )}
    </div>
  );
};
