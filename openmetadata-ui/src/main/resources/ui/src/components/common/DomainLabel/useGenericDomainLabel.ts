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
import { useMemo } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { DomainLabelProps } from './DomainLabel.interface';

type GenericDomainEntity = Omit<EntityReference, 'type'> & {
  domains?: EntityReference[];
  deleted?: boolean;
};

/**
 * Source DomainLabel's entity props from the generic entity context instead of
 * the call site. Widget surfaces render inside a GenericProvider, so they would
 * otherwise have to re-thread id/fqn/type/permissions by hand — which is what
 * the old DomainLabelV2 component existed to do. A hook keeps that convenience
 * without a second DomainLabel component to drift.
 */
export const useGenericDomainLabel = <
  T extends GenericDomainEntity = GenericDomainEntity
>(): Pick<
  DomainLabelProps,
  'domains' | 'entityType' | 'entityFqn' | 'entityId' | 'hasPermission'
> => {
  const { data, type, permissions } = useGenericContext<T>();

  const { canEditAll } = useMemo(
    () =>
      getDerivedPermissionFlags(
        permissions ?? DEFAULT_ENTITY_PERMISSION,
        data?.deleted
      ),
    [permissions, data?.deleted]
  );

  return {
    domains: data?.domains,
    entityType: type as EntityType,
    entityFqn: data?.fullyQualifiedName ?? '',
    entityId: data?.id ?? '',
    hasPermission: canEditAll,
  };
};
