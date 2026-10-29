/*
 *  Copyright 2023 Collate.
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
  Autocomplete,
  Box,
  Button,
  Popover,
  PopoverTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { debounce } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PersonaIcon } from '../../../../assets/svg/ic-persona-new.svg';
import { ReactComponent as ClosePopoverIcon } from '../../../../assets/svg/ic-popover-close.svg';
import { ReactComponent as SavePopoverIcon } from '../../../../assets/svg/ic-popover-save.svg';

import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/entity/type';
import { getAllPersonas, searchPersonas } from '../../../../rest/PersonaAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getEntityReferenceListFromEntities } from '../../../../utils/EntityReferenceUtils';
import { WidgetEditButton } from '../../../common/WidgetActionButton/WidgetActionButton';
import { PersonaSelectableListProps } from './PersonaSelectableList.interface';

export const PersonaListItemRenderer = (props: EntityReference) => {
  const { t } = useTranslation();

  return (
    <Box
      inline
      align="center"
      className="layout-space layout-space-horizontal"
      gap={2}
      itemClassName="layout-space-item">
      {props ? (
        <Typography>{getEntityName(props)}</Typography>
      ) : (
        <Typography className="text-grey-body">
          {t('message.no-data-available')}
        </Typography>
      )}
    </Box>
  );
};

export const PersonaSelectableList = ({
  hasPermission,
  selectedPersonas = [],
  onUpdate,
  personaList,
  isDefaultPersona,
  multiSelect,
}: PersonaSelectableListProps) => {
  const [popupVisible, setPopupVisible] = useState(false);
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [currentlySelectedPersonas, setCurrentlySelectedPersonas] = useState<
    EntityReference[]
  >([]);

  const [selectOptions, setSelectOptions] = useState<EntityReference[]>([]);
  // Server-side search replaces selectOptions per query, so the selected FQNs are
  // resolved against this cache of every persona ever seen — otherwise a persona
  // picked under a previous query is dropped on save.
  const personaByFqnRef = useRef<Map<string, EntityReference>>(new Map());
  const latestRequestIdRef = useRef(0);

  const cachePersonasByFqn = useCallback((personas: EntityReference[]) => {
    personas.forEach((persona) => {
      if (persona.fullyQualifiedName) {
        personaByFqnRef.current.set(persona.fullyQualifiedName, persona);
      }
    });
  }, []);

  useEffect(() => {
    cachePersonasByFqn(selectedPersonas);
    if (personaList) {
      cachePersonasByFqn(personaList);
    }
  }, [selectedPersonas, personaList, cachePersonasByFqn]);

  // A caller-provided `personaList` is a fixed set filtered locally (case-
  // insensitively, like the server); otherwise search hits the server endpoint.
  const fetchOptions = useCallback(
    async (searchText: string): Promise<EntityReference[]> => {
      let options: EntityReference[] = [];
      try {
        if (personaList) {
          const query = searchText.toLowerCase();
          options = searchText
            ? personaList.filter(
                (persona) =>
                  persona.displayName?.toLowerCase().includes(query) ||
                  persona.name?.toLowerCase().includes(query)
              )
            : personaList;
        } else if (searchText) {
          const results = await searchPersonas(searchText, PAGE_SIZE_LARGE);
          options = getEntityReferenceListFromEntities(
            results,
            EntityType.PERSONA
          );
        } else {
          const { data } = await getAllPersonas({ limit: PAGE_SIZE_LARGE });
          options = getEntityReferenceListFromEntities(
            data,
            EntityType.PERSONA
          );
        }
      } catch (error) {
        options = [];
      }
      cachePersonasByFqn(options);

      return options;
    },
    [personaList, cachePersonasByFqn]
  );

  const runSearch = useCallback(
    async (searchText: string) => {
      const requestId = ++latestRequestIdRef.current;
      const options = await fetchOptions(searchText);
      // Drop a slow earlier response that resolves after a newer query.
      if (requestId === latestRequestIdRef.current) {
        setSelectOptions(options);
      }
    },
    [fetchOptions]
  );

  const loadOptions = useCallback(() => runSearch(''), [runSearch]);

  const handleSearch = useMemo(
    () => debounce((searchText: string) => runSearch(searchText), 300),
    [runSearch]
  );

  useEffect(() => () => handleSearch.cancel(), [handleSearch]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (popupVisible) {
      setCurrentlySelectedPersonas(selectedPersonas);
      loadOptions();
    }
  }, [popupVisible, loadOptions]);

  const autocompleteItems = useMemo(
    () =>
      selectOptions.map((persona) => ({
        id: persona.fullyQualifiedName ?? '',
        label: getEntityName(persona),
      })),
    [selectOptions]
  );

  const selectedItems = useMemo(
    () =>
      currentlySelectedPersonas.map((persona) => ({
        id: persona.fullyQualifiedName ?? '',
        label: getEntityName(persona),
      })),
    [currentlySelectedPersonas]
  );

  const handlePersonaUpdate = () => {
    setIsSaving(true);

    if (multiSelect === false) {
      Promise.resolve(onUpdate(currentlySelectedPersonas[0])).finally(() => {
        setIsSaving(false);
        setPopupVisible(false);
      });
    } else {
      Promise.resolve(onUpdate(currentlySelectedPersonas)).finally(() => {
        setIsSaving(false);
        setPopupVisible(false);
      });
    }
  };

  const handleItemInserted = useCallback((key: Key) => {
    const persona = personaByFqnRef.current.get(String(key));
    if (persona) {
      setCurrentlySelectedPersonas((prev) => [...prev, persona]);
    }
  }, []);

  const handleItemCleared = useCallback((key: Key) => {
    setCurrentlySelectedPersonas((prev) =>
      prev.filter((persona) => persona.fullyQualifiedName !== key)
    );
  }, []);

  if (!hasPermission) {
    return null;
  }
  const handleCloseEditTeam = () => {
    setPopupVisible(false);
  };

  return (
    <PopoverTrigger isOpen={popupVisible} onOpenChange={setPopupVisible}>
      <WidgetEditButton
        data-testid={`${isDefaultPersona ? 'default-' : ''}edit-user-persona`}
        title={t('label.edit-entity', {
          entity: t('label.persona'),
        })}
      />
      <Popover
        className="profile-edit-popover-card"
        containerClassName="tw:w-95 tw:p-5"
        data-testid="persona-popover"
        placement="bottom start">
        <Box
          className="user-profile-edit-popover-card relative"
          direction="col">
          <div className="d-flex justify-start items-center gap-2 m-b-sm">
            <div className="d-flex flex-start items-center">
              <PersonaIcon height={16} />
            </div>

            <Typography className="user-profile-edit-popover-card-title">
              {isDefaultPersona
                ? t('label.default-persona')
                : t('label.persona')}
            </Typography>
          </div>

          <Box className="tw:mb-3" direction="col">
            <Autocomplete
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the list opens with the popover, as before
              autoFocus
              aria-label={
                isDefaultPersona
                  ? t('label.default-persona')
                  : t('label.persona')
              }
              data-testid={`${
                isDefaultPersona ? 'default-' : ''
              }persona-select-list`}
              filterOption={() => true}
              items={autocompleteItems}
              maxVisibleItems={3}
              multiple={!isDefaultPersona}
              placeholder={t('label.select-entity', {
                entity: t('label.persona'),
              })}
              selectedItems={selectedItems}
              onItemCleared={handleItemCleared}
              onItemInserted={handleItemInserted}
              onSearchChange={handleSearch}>
              {(item) => (
                <Autocomplete.Item
                  data-testid={`persona-option-${item.label}`}
                  id={item.id}
                  label={item.label}
                />
              )}
            </Autocomplete>
          </Box>

          <div className="flex justify-end gap-2">
            <Button
              aria-label={t('label.cancel')}
              color="primary"
              data-testid={`user-profile${
                isDefaultPersona ? '-default' : ''
              }persona-edit-cancel`}
              iconLeading={<ClosePopoverIcon height={24} />}
              size="xs"
              onClick={handleCloseEditTeam}
            />
            <Button
              aria-label={t('label.save')}
              color="primary"
              data-testid={`user-profile${
                isDefaultPersona ? '-default' : ''
              }-persona-edit-save`}
              iconLeading={<SavePopoverIcon height={24} />}
              isLoading={isSaving}
              size="xs"
              onClick={handlePersonaUpdate}
            />
          </div>
        </Box>
      </Popover>
    </PopoverTrigger>
  );
};
