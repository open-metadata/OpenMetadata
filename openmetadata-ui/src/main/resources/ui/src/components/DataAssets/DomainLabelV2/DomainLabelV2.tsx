/*
 *  Copyright 2024 Collate.
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
import { Card } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { get, isEmpty, isUndefined } from 'lodash';
import {
  Dispatch,
  MouseEvent,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../../generated/entity/type';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DomainLabelProps } from '../../common/DomainLabel/DomainLabel.interface';
import DomainSelect from '../../common/DomainSelect/DomainSelect';
import DomainTags from '../../common/DomainTags/DomainTags';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { AssetsUnion } from '../AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../DataAssetsHeader/DataAssetsHeader.interface';

const resolveDomainsForPatch = (
  selectedDomain: EntityReference | EntityReference[]
): EntityReference[] => {
  if (Array.isArray(selectedDomain)) {
    return selectedDomain;
  }

  return isEmpty(selectedDomain) ? [] : [selectedDomain];
};

const saveDomainViaOnUpdate = async (
  selectedDomain: EntityReference | EntityReference[],
  onUpdate: DomainLabelProps['onUpdate'],
  setActiveDomain: Dispatch<SetStateAction<EntityReference[]>>
): Promise<void> => {
  if (!onUpdate) {
    return;
  }

  try {
    await onUpdate(selectedDomain);
    const updatedDomains = Array.isArray(selectedDomain)
      ? selectedDomain
      : [selectedDomain];
    setActiveDomain(updatedDomains);
  } catch (err) {
    showErrorToast(err as AxiosError);
  }
};

const saveDomainViaApi = async (
  selectedDomain: EntityReference | EntityReference[],
  entityType: AssetsUnion,
  entityFqn: string,
  entityId: string,
  setActiveDomain: Dispatch<SetStateAction<EntityReference[]>>,
  afterDomainUpdateAction?: DomainLabelProps['afterDomainUpdateAction']
): Promise<void> => {
  try {
    const entityDetailsResponse = await getEntityAPIfromSource(entityType)(
      entityFqn,
      {
        fields: 'domains',
      }
    );
    if (!entityDetailsResponse) {
      return;
    }

    const jsonPatch = compare(entityDetailsResponse, {
      ...entityDetailsResponse,
      domains: resolveDomainsForPatch(selectedDomain),
    });

    const api = getAPIfromSource(entityType);
    const res = await api(entityId, jsonPatch);

    const entityDomains = get(res, 'domains', {});
    if (Array.isArray(entityDomains)) {
      setActiveDomain(entityDomains);
    } else {
      // update the domain details here
      setActiveDomain(isEmpty(entityDomains) ? [] : [entityDomains]);
    }
    !isUndefined(afterDomainUpdateAction) &&
      afterDomainUpdateAction(res as DataAssetWithDomains);
  } catch (err) {
    // Handle errors as needed
    showErrorToast(err as AxiosError);
  }
};

export const DomainLabelV2 = <
  T extends {
    domains?: EntityReference[];
    id: string;
    fullyQualifiedName: string;
    deleted?: boolean;
  }
>({
  ...props
}: Partial<DomainLabelProps>) => {
  const { data, type: entityType, permissions } = useGenericContext<T>();
  const { id: entityId, fullyQualifiedName: entityFqn, domains } = data;
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<EntityReference[]>([]);

  const domainLabel = props.multiple
    ? t('label.domain-plural')
    : t('label.domain');

  const handleDomainSave = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      if (props.onUpdate) {
        await saveDomainViaOnUpdate(
          selectedDomain,
          props.onUpdate,
          setActiveDomain
        );

        return;
      }

      await saveDomainViaApi(
        selectedDomain,
        entityType as AssetsUnion,
        entityFqn,
        entityId,
        setActiveDomain,
        props.afterDomainUpdateAction
      );
    },
    [entityType, entityId, entityFqn, props.onUpdate]
  );

  useEffect(() => {
    if (domains) {
      if (Array.isArray(domains)) {
        setActiveDomain(domains);
      } else {
        setActiveDomain([domains]);
      }
    }
  }, [domains]);

  // Named-flag derivation (Task 8 sweep): raw EditAll-only read, deleted-gated exactly as
  // before — identical mapping onto `canEditAll`.
  const { canEditAll } = useMemo(
    () => getDerivedPermissionFlags(permissions, data?.deleted),
    [permissions, data?.deleted]
  );
  const hasPermission = useMemo(() => {
    return props?.hasPermission ?? canEditAll;
  }, [canEditAll, props?.hasPermission]);

  const editor = useMemo(() => {
    if (!hasPermission) {
      return null;
    }

    const renderTrigger = ({ toggle }: { toggle: () => void }) => {
      const handleTriggerClick = (e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        toggle();
      };

      return isEmpty(activeDomain) ? (
        <WidgetPlusButton
          data-testid="add-domain"
          title={t('label.add-entity', { entity: domainLabel })}
          onClick={handleTriggerClick}
        />
      ) : (
        <WidgetEditButton
          data-testid="edit-domain"
          title={t('label.edit-entity', { entity: domainLabel })}
          onClick={handleTriggerClick}
        />
      );
    };

    return (
      <DomainSelect
        hasPermission
        isClearable={props.isClearable}
        multiple={props.multiple}
        renderTrigger={renderTrigger}
        selectedDomain={activeDomain}
        triggerVariant="button"
        onUpdate={
          handleDomainSave as (
            domain: EntityReference | EntityReference[] | undefined
          ) => Promise<void>
        }
      />
    );
  }, [
    hasPermission,
    activeDomain,
    handleDomainSave,
    props.isClearable,
    props.multiple,
    domainLabel,
    t,
  ]);

  const label = useMemo(() => {
    const chips = <DomainTags domains={activeDomain} />;

    if (props.showDomainHeading) {
      return (
        <WidgetCard
          headerExtra={editor}
          isExpandDisabled={isEmpty(activeDomain)}
          title={domainLabel}>
          {!isEmpty(activeDomain) && chips}
        </WidgetCard>
      );
    }

    return (
      <Card
        className="d-flex items-center gap-1 flex-wrap"
        data-testid="header-domain-container">
        {chips}
        {editor}
      </Card>
    );
  }, [activeDomain, editor, domainLabel, props.showDomainHeading]);

  return label;
};
