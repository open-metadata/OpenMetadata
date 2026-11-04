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
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { EntityReference } from '../../../generated/entity/type';

interface OwnerInheritedBadgeProps {
  owner: EntityReference;
  children: ReactNode;
}

// The avatar badges clip to a circle (overflow: hidden), so the corner icon
// sits on a wrapper outside the clipped element; z-1 keeps it above the next
// avatar in an overlapping stack.
export const OwnerInheritedBadge = ({
  owner,
  children,
}: OwnerInheritedBadgeProps) => {
  const { t } = useTranslation();

  if (!owner.inherited) {
    return <>{children}</>;
  }

  return (
    <span className="tw:relative tw:inline-flex tw:shrink-0">
      {children}
      <span
        aria-label={t('label.inherited-entity', {
          entity: t('label.owner'),
        })}
        className="tw:absolute tw:z-1 tw:-right-0.5 tw:-bottom-0.5 tw:flex tw:size-3 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-secondary tw:bg-primary"
        data-testid="inherited-owner-icon"
        role="img">
        <InheritIcon height={8} width={8} />
      </span>
    </span>
  );
};
