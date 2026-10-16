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

import {
  Box,
  Button,
  Dropdown,
  HintText,
} from '@openmetadata/ui-core-components';
import { Key, ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormCardSection from '../../../components/common/FormCardSection/FormCardSection';
import { useAlertSelectionContext } from '../../../hooks/useAlertSelection';
import { useFqn } from '../../../hooks/useFqn';
import {
  getSourceKindLabel,
  getSourceOptions,
  groupSourcesByKind,
} from '../../../utils/Alerts/AlertSelectionUtil';
import { getSourceOptionsFromResourceList } from '../../../utils/Alerts/AlertsUtil';
import AlertSourcePicker from '../AlertSourcePicker/AlertSourcePicker';
import { AlertFormSourceItemProps } from './AlertFormSourceItem.interface';

interface SourceMenuItem {
  key: string;
  label: ReactNode;
}

function AlertFormSourceItem({
  filterResources,
  isViewMode = false,
  value = [],
  onChange,
  error,
}: Readonly<AlertFormSourceItemProps>) {
  const { t } = useTranslation();
  const { capabilities } = useAlertSelectionContext();
  const { fqn } = useFqn();
  const [isEditMode, setIsEditMode] = useState(false);

  const resourcesOptions = useMemo(
    () =>
      getSourceOptionsFromResourceList(
        (filterResources ?? []).map((r) => r.name ?? ''),
        false,
        undefined,
        true
      ),
    [filterResources]
  );

  const sourceNames = useMemo(
    () => (filterResources ?? []).map((resource) => resource.name ?? ''),
    [filterResources]
  );

  // Grouped by kind, as the picker groups them, once the server has said each source's kind.
  const sourceGroups = useMemo(() => {
    const labelOf = new Map(
      resourcesOptions.map((option) => [option.value, option.label])
    );

    return groupSourcesByKind(
      getSourceOptions(sourceNames, [], capabilities.selection)
    ).map(({ kind, sources }) => ({
      kind,
      items: sources.map(
        (source): SourceMenuItem => ({
          key: source.name,
          label: labelOf.get(source.name),
        })
      ),
    }));
  }, [resourcesOptions, sourceNames, capabilities.selection]);

  const handleMenuItemClick = useCallback(
    (key: Key) => {
      onChange?.([String(key)], value);
      setIsEditMode(true);
    },
    [onChange, value]
  );

  const renderMenuItems = (items: SourceMenuItem[]) =>
    items.map((item) => (
      <Dropdown.Item id={item.key} key={item.key} textValue={item.key}>
        {item.label}
      </Dropdown.Item>
    ));

  const sourceControl = (
    <AlertSourcePicker
      isDisabled={isViewMode}
      selection={capabilities.selection}
      sources={sourceNames}
      value={value}
      onChange={onChange}
    />
  );

  return (
    <FormCardSection
      heading={t('label.source')}
      subHeading={t('message.alerts-source-description')}>
      <Box
        align="start"
        className="source-input-container"
        direction="col"
        gap={2}>
        {isEditMode || fqn ? (
          sourceControl
        ) : (
          <Dropdown.Root>
            <Button data-testid="add-source-button" size="sm">
              {t('label.add-entity', {
                entity: t('label.source'),
              })}
            </Button>
            <Dropdown.Popover
              className="tw:w-auto tw:min-w-50"
              placement="bottom start"
              shouldFlip={false}>
              <Box className="tw:pt-2" data-testid="drop-down-menu">
                <Dropdown.Menu
                  aria-label={t('label.source')}
                  className="tw:max-h-75 tw:overflow-y-auto"
                  selectionMode="none"
                  onAction={handleMenuItemClick}>
                  {sourceGroups.map(({ kind, items }) =>
                    kind ? (
                      <Dropdown.Section key={kind}>
                        <Dropdown.SectionHeader className="tw:px-4 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-quaternary tw:uppercase">
                          {getSourceKindLabel(kind)}
                        </Dropdown.SectionHeader>
                        {renderMenuItems(items)}
                      </Dropdown.Section>
                    ) : (
                      renderMenuItems(items)
                    )
                  )}
                </Dropdown.Menu>
              </Box>
            </Dropdown.Popover>
          </Dropdown.Root>
        )}
        {error && <HintText isInvalid>{error}</HintText>}
      </Box>
    </FormCardSection>
  );
}

export default AlertFormSourceItem;
