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
  Alert,
  Badge,
  Box,
  Button,
  CheckboxBase,
  HintText,
  HookForm,
  Input,
  Label,
  Select,
  TextArea,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { AlertCircle, InfoCircle, LinkExternal01 } from '@untitledui/icons';
import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_PERSONA_CONTEXT_MAX_ASSETS,
  HEAVY_PERSONA_CONTEXT_SECTIONS,
  PERSONA_CONTEXT_ASSET_TYPES,
  PERSONA_CONTEXT_ENTITY_LABEL_KEYS,
  PERSONA_CONTEXT_KNOWLEDGE_TYPES,
  PERSONA_CONTEXT_SECTION_LABEL_KEYS,
} from '../../../../../constants/PersonaAIContext.constants';
import { EntityType } from '../../../../../enums/entity.enum';
import {
  ContextRule,
  ContextSection,
} from '../../../../../generated/type/personaContextDefinition';
import {
  PersonaContextRulePreview,
  previewPersonaAIContextRule,
} from '../../../../../rest/PersonaAPI';
import {
  getDefaultPersonaContextSections,
  getPersonaContextSections,
  getRuleExplorePath,
  isKnowledgeContextRule,
} from '../../../../../utils/PersonaAIContextUtils';
import { useFormDrawerWithHook } from '../../../../common/atoms/drawer/useFormDrawer';
import { RuleQueryBuilderField } from './RuleQueryBuilderField.component';

interface ContextRuleEditorProps {
  existingRuleNames: string[];
  open: boolean;
  personaId: string;
  rule?: ContextRule;
  onClose: () => void;
  onSubmit: (rule: ContextRule) => Promise<void>;
}

interface FieldProps {
  children: ReactNode;
  className?: string;
  error?: string;
  isRequired?: boolean;
  label?: string;
}

const Field = ({
  children,
  className,
  error,
  isRequired,
  label,
}: FieldProps) => (
  <div className={`tw:mb-5 tw:flex tw:flex-col tw:gap-1.5 ${className ?? ''}`}>
    {label && <Label isRequired={isRequired}>{label}</Label>}
    {children}
    {error && <HintText isInvalid>{error}</HintText>}
  </div>
);

const SECTION_CARD_CLASS =
  'tw:flex tw:cursor-pointer tw:select-none tw:items-center tw:justify-between tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-3 tw:py-[11px] tw:transition';

const BEHAVIOR_CARD_CLASS =
  'tw:min-h-[70px] tw:rounded-lg tw:border tw:border-secondary tw:px-4 tw:py-[13px]';

const ENTITY_TYPE_POPUP_CLASS =
  'tw:max-h-[min(320px,calc(100vh-96px))] tw:overflow-y-auto tw:overscroll-contain';

const ViewInExploreIcon: FC<{ className?: string }> = ({ className }) => (
  <LinkExternal01 className={`${className ?? ''} tw:size-4!`} />
);

const getDefaultRule = (rule?: ContextRule): ContextRule => {
  const entityType = rule?.entityType ?? PERSONA_CONTEXT_ASSET_TYPES[0];
  const knowledgeType = PERSONA_CONTEXT_KNOWLEDGE_TYPES.includes(
    entityType as EntityType
  );

  return {
    alwaysInContext: rule?.alwaysInContext ?? knowledgeType,
    description: rule?.description ?? '',
    enabled: rule?.enabled ?? true,
    entityType,
    filterJsonTree: rule?.filterJsonTree,
    fullyRendered: knowledgeType ? true : rule?.fullyRendered ?? false,
    id: rule?.id,
    maxAssets: rule?.maxAssets ?? DEFAULT_PERSONA_CONTEXT_MAX_ASSETS,
    name: rule?.name ?? '',
    queryFilter: rule?.queryFilter ?? '',
    sections: rule?.sections?.length
      ? rule.sections
      : getDefaultPersonaContextSections(entityType),
  };
};

export const ContextRuleEditor = ({
  existingRuleNames,
  open,
  personaId,
  rule,
  onClose,
  onSubmit,
}: ContextRuleEditorProps) => {
  const { t } = useTranslation();
  const form = useForm<ContextRule>({
    defaultValues: getDefaultRule(rule),
  });
  const entityType =
    useWatch({ control: form.control, name: 'entityType' }) ??
    PERSONA_CONTEXT_ASSET_TYPES[0];
  const filterJsonTree = useWatch({
    control: form.control,
    name: 'filterJsonTree',
  });
  const fullyRendered =
    useWatch({ control: form.control, name: 'fullyRendered' }) ?? false;
  const maxAssets = useWatch({ control: form.control, name: 'maxAssets' });
  const queryFilter = useWatch({ control: form.control, name: 'queryFilter' });
  const closeDrawerRef = useRef<() => void>(() => undefined);
  const lastResetRuleIdRef = useRef<string>();
  const ruleForResetRef = useRef(rule);
  ruleForResetRef.current = rule;
  const activeRuleId = rule?.id;
  const previewRequestRef = useRef(0);
  const [preview, setPreview] = useState<PersonaContextRulePreview>();
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [maxAssetsDraft, setMaxAssetsDraft] = useState<string>();
  const isKnowledgeRule = isKnowledgeContextRule({
    ...getDefaultRule(rule),
    entityType,
  });

  const entityTypeOptions = useMemo(
    () =>
      [...PERSONA_CONTEXT_ASSET_TYPES, ...PERSONA_CONTEXT_KNOWLEDGE_TYPES].map(
        (type) => ({
          id: type,
          label: t(PERSONA_CONTEXT_ENTITY_LABEL_KEYS[type]),
          supportingText: PERSONA_CONTEXT_KNOWLEDGE_TYPES.includes(
            type as EntityType
          )
            ? t('label.knowledge')
            : undefined,
        })
      ),
    [t]
  );

  const sectionsDisabled = fullyRendered || isKnowledgeRule;

  useEffect(() => {
    if (!open) {
      previewRequestRef.current++;
      setPreviewLoading(false);

      return;
    }
    const requestId = ++previewRequestRef.current;
    setPreviewError(false);
    setPreviewLoading(true);
    const timeout = window.setTimeout(async () => {
      try {
        const values = form.getValues();
        const result = await previewPersonaAIContextRule(personaId, {
          ...values,
          name: values.name.trim() || t('label.untitled'),
        });
        if (requestId === previewRequestRef.current) {
          setPreview(result);
          setPreviewError(false);
        }
      } catch {
        if (requestId === previewRequestRef.current) {
          setPreview(undefined);
          setPreviewError(true);
        }
      } finally {
        if (requestId === previewRequestRef.current) {
          setPreviewLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      if (requestId === previewRequestRef.current) {
        previewRequestRef.current++;
      }
    };
  }, [
    entityType,
    filterJsonTree,
    form,
    maxAssets,
    open,
    personaId,
    queryFilter,
    t,
  ]);

  const handleSubmit = useCallback(
    async (data: ContextRule) => {
      await onSubmit({
        ...data,
        description: data.description || undefined,
        filterJsonTree: data.filterJsonTree || undefined,
        matchedCount: undefined,
        name: data.name.trim(),
        queryFilter: data.queryFilter || '',
      });
      closeDrawerRef.current();
    },
    [onSubmit]
  );

  const handleDismiss = useCallback(() => {
    previewRequestRef.current++;
    setPreview(undefined);
    setMaxAssetsDraft(undefined);
    form.reset(getDefaultRule(rule));
    onClose();
  }, [form, onClose, rule]);

  const renderPreviewContent = () => {
    if (previewLoading) {
      return (
        <span className="tw:text-[13px] tw:text-brand-secondary">
          {t('message.persona-context-match-preview-loading')}
        </span>
      );
    }
    if (previewError) {
      return (
        <span className="tw:text-[13px] tw:text-tertiary">
          {t('server.unexpected-error')}
        </span>
      );
    }
    if (preview) {
      return (
        <span className="tw:flex tw:min-w-0 tw:items-baseline tw:gap-1">
          <span className="tw:shrink-0 tw:text-[13px] tw:font-semibold tw:text-brand-secondary">
            {t('message.persona-context-match-summary', {
              count: preview.matchedCount,
            })}
          </span>
          <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-[12px] tw:font-normal tw:text-brand-secondary">
            {t('message.persona-context-match-sample', {
              sample: preview.sampleNames.join(', ') || t('label.none'),
            })}
          </span>
        </span>
      );
    }

    return (
      <span className="tw:text-[13px] tw:text-brand-secondary">
        {t('message.persona-context-match-preview-loading')}
      </span>
    );
  };

  const formBody = (
    <HookForm
      className="tw:flex tw:flex-col"
      form={form}
      onSubmit={form.handleSubmit(handleSubmit)}>
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <Field
            isRequired
            error={fieldState.error?.message}
            label={t('label.name')}>
            <Input
              aria-label={t('label.name')}
              inputDataTestId="context-rule-name"
              isInvalid={Boolean(fieldState.error)}
              value={field.value ?? ''}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
          </Field>
        )}
        rules={{
          required: t('message.field-text-is-required', {
            fieldText: t('label.name'),
          }),
          validate: (value) =>
            !existingRuleNames.some(
              (name) => name.trim().toLowerCase() === value.trim().toLowerCase()
            ) || t('message.name-already-exists'),
        }}
      />

      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <Field label={t('label.description-optional')}>
            <TextArea
              aria-label={t('label.description-optional')}
              data-testid="context-rule-description"
              rows={3}
              value={field.value ?? ''}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
          </Field>
        )}
      />

      <Controller
        control={form.control}
        name="entityType"
        render={({ field }) => (
          <Field isRequired label={t('label.entity-type')}>
            <Select
              aria-label={t('label.entity-type')}
              data-testid="context-rule-entity-type"
              items={entityTypeOptions}
              placeholder={t('label.entity-type')}
              popoverClassName={ENTITY_TYPE_POPUP_CLASS}
              selectedKey={field.value}
              onSelectionChange={(value) => {
                field.onChange(value);
                form.setValue('filterJsonTree', undefined, {
                  shouldDirty: true,
                });
                form.setValue('queryFilter', '', { shouldDirty: true });
                const nextIsKnowledge =
                  PERSONA_CONTEXT_KNOWLEDGE_TYPES.includes(value as EntityType);
                form.setValue(
                  'sections',
                  getDefaultPersonaContextSections(value as string),
                  { shouldDirty: true }
                );
                form.setValue('alwaysInContext', nextIsKnowledge, {
                  shouldDirty: true,
                });
                form.setValue('fullyRendered', nextIsKnowledge, {
                  shouldDirty: true,
                });
              }}>
              {(item) => (
                <Select.Item id={item.id} supportingText={item.supportingText}>
                  {item.label}
                </Select.Item>
              )}
            </Select>
          </Field>
        )}
      />

      <Field label={t('label.filter')}>
        <RuleQueryBuilderField
          entityType={entityType}
          filterJsonTree={filterJsonTree}
          key={open ? `${rule?.id ?? 'new'}-${entityType}` : 'closed'}
          queryFilter={queryFilter}
          onChange={(updatedQuery, updatedTree) => {
            form.setValue('queryFilter', updatedQuery, { shouldDirty: true });
            form.setValue('filterJsonTree', updatedTree, {
              shouldDirty: true,
            });
          }}
        />
        <Alert
          className="tw:mt-3 tw:items-center! tw:gap-2.5 tw:px-3.5 tw:py-2.75 tw:**:data-[testid=alert-icon]:self-center"
          data-testid="context-rule-match-preview"
          icon={previewError ? AlertCircle : InfoCircle}
          iconSize="sm"
          rightContent={
            <Button
              className="tw:shrink-0 tw:text-[13px] tw:font-semibold tw:text-brand-secondary"
              color="link-color"
              href={getRuleExplorePath(entityType, filterJsonTree, queryFilter)}
              iconTrailing={ViewInExploreIcon}
              size="sm"
              target="_blank">
              {t('label.view-in-explore')}
            </Button>
          }
          title=""
          variant={previewError ? 'error' : 'brand'}>
          {renderPreviewContent()}
        </Alert>
      </Field>

      {isKnowledgeRule && (
        <Alert
          className="tw:mb-5 tw:border-dashed"
          title={t('message.persona-context-generic-content')}
          variant="gray"
        />
      )}

      <Box className="tw:mb-5.5 tw:gap-2.5" direction="col">
        <Controller
          control={form.control}
          name="alwaysInContext"
          render={({ field }) => (
            <Box
              align="center"
              className={BEHAVIOR_CARD_CLASS}
              justify="between">
              <Box className="tw:min-w-0" direction="col" gap={1}>
                <Typography
                  className="tw:text-[13px] tw:text-primary"
                  weight="semibold">
                  {t('label.always-in-context')}
                </Typography>
                <Typography className="tw:text-[12px] tw:text-quaternary">
                  {t('message.persona-context-always-description')}
                </Typography>
              </Box>
              <Toggle
                aria-label={t('label.always-in-context')}
                data-testid="context-rule-always-in-context"
                isSelected={Boolean(field.value)}
                onChange={field.onChange}
              />
            </Box>
          )}
        />
        <Controller
          control={form.control}
          name="fullyRendered"
          render={({ field }) => (
            <Box
              align="center"
              className={BEHAVIOR_CARD_CLASS}
              justify="between">
              <Box className="tw:min-w-0" direction="col" gap={1}>
                <Typography
                  className="tw:text-[13px] tw:text-primary"
                  weight="semibold">
                  {t('label.fully-rendered')}
                </Typography>
                <Typography className="tw:text-[12px] tw:text-quaternary">
                  {t(
                    isKnowledgeRule
                      ? 'message.persona-context-knowledge-fully-rendered'
                      : entityType === EntityType.DATA_PRODUCT
                      ? 'message.persona-context-data-product-fully-rendered-description'
                      : 'message.persona-context-fully-rendered-description'
                  )}
                </Typography>
              </Box>
              <Toggle
                aria-label={t('label.fully-rendered')}
                data-testid="context-rule-fully-rendered"
                isDisabled={isKnowledgeRule}
                isSelected={isKnowledgeRule || Boolean(field.value)}
                onChange={field.onChange}
              />
            </Box>
          )}
        />
      </Box>

      <Controller
        control={form.control}
        name="sections"
        render={({ field }) => {
          const selectedSections = field.value ?? [];
          const toggleSection = (section: ContextSection) => {
            if (sectionsDisabled) {
              return;
            }
            field.onChange(
              selectedSections.includes(section)
                ? selectedSections.filter((value) => value !== section)
                : [...selectedSections, section]
            );
          };

          return (
            <Field className="tw:mb-5.5" label={t('label.context-sections')}>
              <Typography className="tw:text-tertiary" size="text-sm">
                {sectionsDisabled
                  ? t('message.persona-context-sections-disabled')
                  : t('message.persona-context-sections-description')}
              </Typography>
              <Box className="tw:grid! tw:grid-cols-3 tw:gap-x-2 tw:gap-y-3">
                {getPersonaContextSections(entityType).map((section) => {
                  const selected = selectedSections.includes(section);

                  return (
                    <div
                      aria-checked={selected}
                      aria-disabled={sectionsDisabled}
                      className={`${SECTION_CARD_CLASS} ${
                        sectionsDisabled
                          ? 'tw:cursor-not-allowed tw:opacity-60'
                          : ''
                      }`}
                      key={section}
                      role="checkbox"
                      tabIndex={sectionsDisabled ? -1 : 0}
                      onClick={() => toggleSection(section)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleSection(section);
                        }
                      }}>
                      <span className="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
                        <CheckboxBase
                          isDisabled={sectionsDisabled}
                          isSelected={selected}
                        />
                        <span className="tw:truncate tw:text-[13px]">
                          {t(PERSONA_CONTEXT_SECTION_LABEL_KEYS[section])}
                        </span>
                      </span>
                      {HEAVY_PERSONA_CONTEXT_SECTIONS.has(section) && (
                        <Badge color="gray" size="sm">
                          {t('label.heavy')}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </Box>
            </Field>
          );
        }}
      />

      <Controller
        control={form.control}
        name="maxAssets"
        render={({ field, fieldState }) => (
          <Field
            isRequired
            error={fieldState.error?.message}
            label={t('label.max-assets')}>
            <Input
              aria-label={t('label.max-assets')}
              inputDataTestId="context-rule-max-assets"
              inputMode="numeric"
              value={
                maxAssetsDraft ??
                (field.value == null ? '' : String(field.value))
              }
              wrapperClassName="tw:w-40"
              onBlur={() => {
                setMaxAssetsDraft(undefined);
                field.onBlur();
              }}
              onChange={(value) => {
                const digits = value.replace(/[^0-9]/g, '');
                setMaxAssetsDraft(digits);
                const parsed = Number(digits);
                field.onChange(parsed ? Math.min(parsed, 1000) : undefined);
              }}
            />
            <HintText className="tw:mt-1.75 tw:text-[12px] tw:font-normal">
              {t('message.persona-context-max-assets-description')}
            </HintText>
          </Field>
        )}
        rules={{
          min: 1,
        }}
      />
    </HookForm>
  );

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithHook<ContextRule>({
      closeOnBackdrop: false,
      form: formBody,
      header: {
        className: 'tw:border-b tw:border-secondary tw:px-6! tw:py-5!',
      },
      hookForm: form,
      submitLabel: t('label.save-rule'),
      title: (
        <Box className="tw:gap-0.5" direction="col">
          <Typography
            as="h4"
            data-testid="form-heading"
            size="text-md"
            weight="medium">
            {rule ? t('label.edit-rule') : t('label.add-rule')}
          </Typography>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.persona-context-rule-subtitle')}
          </Typography>
        </Box>
      ),
      width: 720,
      onClose: handleDismiss,
      onSubmit: handleSubmit,
    });

  closeDrawerRef.current = closeDrawer;

  useEffect(() => {
    if (open) {
      const ruleId = activeRuleId ?? 'new';
      if (!isOpen || lastResetRuleIdRef.current !== ruleId) {
        form.reset(getDefaultRule(ruleForResetRef.current));
        setMaxAssetsDraft(undefined);
        lastResetRuleIdRef.current = ruleId;
      }
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
      lastResetRuleIdRef.current = undefined;
    }
  }, [activeRuleId, closeDrawer, form, isOpen, open, openDrawer]);

  return formDrawer;
};
