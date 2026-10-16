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
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Divider,
  Select,
  Slider,
  Toggle,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { MouseEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Delete } from '../../../assets/svg/delete-colored.svg';
import { ReactComponent as FilterIcon } from '../../../assets/svg/setting-colored.svg';
import { SearchFieldMatchType as MatchType } from '../../../generated/configuration/searchSettings';
import './field-configuration.less';
import { FieldConfigurationProps } from './fieldConfiguration.interface';

const FieldConfiguration: React.FC<FieldConfigurationProps> = ({
  field,
  index,
  searchSettings,
  entityFields,
  initialOpen,
  onHighlightFieldsChange,
  onFieldWeightChange,
  onMatchTypeChange,
  onDeleteSearchField,
}) => {
  const { t } = useTranslation();
  const [activeFieldKeys, setActiveFieldKeys] = useState<
    Record<number, string[]>
  >({});
  const [fieldWeight, setFieldWeight] = useState(field.weight);
  const [fieldMatchType, setFieldMatchType] = useState(
    field.matchType || MatchType.Standard
  );

  const entityFieldConfig = entityFields.find(
    (entityField) => entityField.name === field.fieldName
  );
  const fieldDescription = entityFieldConfig?.description;
  // Only analyzed text fields can be highlighted. The server derives this from the index mapping
  // and rejects a save that targets a flattened or non-indexed path, so offering the toggle here
  // would only produce a 400 the admin cannot act on.
  const isHighlightAllowed = Boolean(entityFieldConfig?.highlight);

  useEffect(() => {
    // If initialOpen is true, open this panel automatically
    if (initialOpen) {
      setActiveFieldKeys((prevKeys) => ({
        ...prevKeys,
        [index]: [String(index)],
      }));
    }
  }, [initialOpen, index]);

  const handleCollapseChange = (key: string | string[], index: number) => {
    setActiveFieldKeys((prevKeys) => ({
      ...prevKeys,
      [index]: Array.isArray(key) ? key : [key],
    }));
  };

  const handleWeightChange = (value: number) => {
    setFieldWeight(value);
    onFieldWeightChange(field.fieldName, value);
  };

  const handleMatchTypeChange = (value: MatchType) => {
    setFieldMatchType(value);
    onMatchTypeChange(field.fieldName, value);
  };

  const matchTypeOptions = [
    { id: MatchType.Exact, label: t('label.exact-match') },
    { id: MatchType.Phrase, label: t('label.phrase-match') },
    { id: MatchType.Fuzzy, label: t('label.fuzzy-match') },
    { id: MatchType.Standard, label: t('label.standard-match') },
  ];

  return (
    <Accordion
      allowsMultipleExpanded
      data-field-name={field.fieldName}
      expandedKeys={new Set(activeFieldKeys[index] ?? [])}
      key={index}
      onExpandedChange={(keys) =>
        ((key) => handleCollapseChange(key, index))([...keys].map(String))
      }>
      <AccordionItem
        className="custom-panel m-b-md"
        data-testid={`field-configuration-panel-${field.fieldName}`}
        id={String(String(index))}
        key={String(index)}>
        <Box align="start" className="tw:relative" gap={2}>
          <div className="tw:min-w-0 tw:flex-1">
            <AccordionHeader
              className="tw:group-data-expanded/item:bg-brand-primary_alt"
              showChevron={false}>
              <Box className="tw:w-full">
                <div
                  className="field-container-header"
                  data-testid="field-container-header">
                  <div className="d-flex items-center justify-between">
                    <div className="d-flex items-center gap-2">
                      <Typography data-testid="field-name">
                        {field.fieldName}
                      </Typography>
                      {field.fieldName.startsWith('extension.') && (
                        <Badge
                          className="custom-property-badge"
                          color="brand"
                          data-testid="custom-property-badge"
                          size="sm">
                          {t('label.custom')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="d-flex items-center justify-between gap-2 m-y-xss">
                    <span className="text-grey-muted text-xs font-normal">
                      {fieldDescription ?? t('label.no-description')}
                    </span>
                    <span
                      className="p-x-xs font-semibold text-primary d-flex items-center field-weightage"
                      data-testid="field-weight">
                      <FilterIcon className="tw:size-3.5 tw:shrink-0" />
                      {fieldWeight < 10 ? `0${fieldWeight}` : fieldWeight}
                    </span>
                  </div>
                </div>
              </Box>
            </AccordionHeader>
          </div>
          <Box className="tw:absolute tw:end-3 tw:top-3">
            <Button
              aria-label={t('label.delete')}
              color="secondary"
              data-testid="delete-search-field"
              iconLeading={<Delete className="tw:size-3.5 tw:shrink-0" />}
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                onDeleteSearchField(field.fieldName);
              }}
            />
          </Box>
        </Box>
        {/* An entity lists a dozen or more fields, each with a slider and three
            selects; mount them only while the panel is open, as antd did. */}
        <AccordionPanel unmountOnCollapse>
          <Divider className="m-0" />
          <div className="m-y-sm" style={{ padding: '10px' }}>
            {/* Highlight Fields Section */}
            <div className="m-y-md m-b-lg d-flex items-center justify-between">
              <Typography>{t('label.highlight-field-plural')}</Typography>
              {isHighlightAllowed ? (
                <Toggle
                  className="m-l-xlg"
                  data-testid="highlight-field-switch"
                  isSelected={
                    searchSettings?.highlightFields?.includes(
                      field.fieldName
                    ) ?? false
                  }
                  size="sm"
                  onChange={() => onHighlightFieldsChange(field.fieldName)}
                />
              ) : (
                <Tooltip
                  placement="top"
                  title={t('message.field-cannot-be-highlighted')}>
                  <TooltipTrigger>
                    <Toggle
                      isDisabled
                      className="m-l-xlg"
                      data-testid="highlight-field-switch"
                      isSelected={false}
                      size="sm"
                    />
                  </TooltipTrigger>
                </Tooltip>
              )}
            </div>
            <Divider className="tw:my-6" />

            {/* Weight Section */}
            <div className="m-y-md m-b-lg d-flex items-center justify-between">
              <Typography>{t('label.weight')}</Typography>
              <Typography
                className="font-semibold field-weightage-text"
                data-testid="field-weight-value">
                {fieldWeight}
              </Typography>
            </div>
            <div data-testid="field-weight-slider">
              <Slider
                aria-label={t('label.value')}
                maxValue={100}
                minValue={0}
                step={0.1}
                value={fieldWeight}
                onChange={(value) =>
                  handleWeightChange(Array.isArray(value) ? value[0] : value)
                }
              />
            </div>
            <Divider className="tw:my-6" />

            {/* Match Type Section */}
            <div className="m-y-md m-b-lg d-flex items-center justify-between">
              <Typography>{t('label.match-type')}</Typography>
              <Select
                aria-label={t('label.match-type')}
                className="tw:ml-8 tw:w-40"
                data-testid="match-type-select"
                items={matchTypeOptions}
                value={fieldMatchType}
                onChange={(key) => handleMatchTypeChange(key as MatchType)}>
                {(item) => <Select.Item id={item.id} label={item.label} />}
              </Select>
            </div>
          </div>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
};

export default FieldConfiguration;
