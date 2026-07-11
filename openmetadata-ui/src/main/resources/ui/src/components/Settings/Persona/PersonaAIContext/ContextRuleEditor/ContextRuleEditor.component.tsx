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
  ExclamationCircleOutlined,
  ExportOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { HookForm } from '@openmetadata/ui-core-components';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Select,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  HEAVY_PERSONA_CONTEXT_SECTIONS,
  PERSONA_CONTEXT_ASSET_TYPES,
  PERSONA_CONTEXT_ENTITY_LABEL_KEYS,
  PERSONA_CONTEXT_KNOWLEDGE_TYPES,
  PERSONA_CONTEXT_SECTION_LABEL_KEYS,
} from '../../../../../constants/PersonaAIContext.constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { ContextRule } from '../../../../../generated/type/personaContextDefinition';
import {
  PersonaContextRulePreview,
  previewPersonaAIContextRule,
} from '../../../../../rest/PersonaAPI';
import {
  getDefaultPersonaContextSections,
  getPersonaContextSections,
  isKnowledgeContextRule,
} from '../../../../../utils/PersonaAIContextUtils';
import { getExplorePath } from '../../../../../utils/RouterUtils';
import { useFormDrawerWithHook } from '../../../../common/atoms/drawer/useFormDrawer';
import { DrawerPopupContainerProvider } from '../../../../common/DrawerPopupContainerProvider';
import { RuleQueryBuilderField } from './RuleQueryBuilderField.component';

interface ContextRuleEditorProps {
  open: boolean;
  personaId: string;
  rule?: ContextRule;
  onClose: () => void;
  onSubmit: (rule: ContextRule) => Promise<void>;
}

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
    fullyRendered: rule?.fullyRendered ?? knowledgeType,
    id: rule?.id,
    maxAssets: rule?.maxAssets ?? 50,
    name: rule?.name ?? '',
    queryFilter: rule?.queryFilter ?? '',
    sections: rule?.sections ?? getDefaultPersonaContextSections(entityType),
  };
};

export const ContextRuleEditor = ({
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
  const previewRequestRef = useRef(0);
  const [preview, setPreview] = useState<PersonaContextRulePreview>();
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const isKnowledgeRule = isKnowledgeContextRule({
    ...getDefaultRule(rule),
    entityType,
  });

  const sectionOptions = useMemo(
    () =>
      getPersonaContextSections(entityType).map((section) => ({
        label: (
          <span>
            {t(PERSONA_CONTEXT_SECTION_LABEL_KEYS[section])}
            {HEAVY_PERSONA_CONTEXT_SECTIONS.has(section) && (
              <Tag className="m-l-xs">{t('label.heavy')}</Tag>
            )}
          </span>
        ),
        value: section,
      })),
    [entityType, t]
  );

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
        queryFilter: data.queryFilter || '',
      });
      closeDrawerRef.current();
    },
    [onSubmit]
  );

  const handleDismiss = useCallback(() => {
    previewRequestRef.current++;
    setPreview(undefined);
    form.reset(getDefaultRule(rule));
    onClose();
  }, [form, onClose, rule]);

  const formBody = (
    <HookForm
      className="persona-ai-context-rule-form"
      form={form}
      onSubmit={form.handleSubmit(handleSubmit)}>
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <Form.Item
            required
            help={fieldState.error?.message}
            label={t('label.name')}
            validateStatus={fieldState.error ? 'error' : undefined}>
            <Input {...field} data-testid="context-rule-name" />
          </Form.Item>
        )}
        rules={{
          required: t('message.field-text-is-required', {
            fieldText: t('label.name'),
          }),
        }}
      />

      <Controller
        control={form.control}
        name="description"
        render={({ field }) => (
          <Form.Item label={t('label.description-optional')}>
            <Input.TextArea
              {...field}
              data-testid="context-rule-description"
              rows={3}
            />
          </Form.Item>
        )}
      />

      <Controller
        control={form.control}
        name="entityType"
        render={({ field }) => (
          <Form.Item required label={t('label.entity-type')}>
            <DrawerPopupContainerProvider>
              <Select
                {...field}
                data-testid="context-rule-entity-type"
                listHeight={280}
                popupClassName="persona-ai-context-entity-type-popup"
                virtual={false}
                onChange={(value) => {
                  field.onChange(value);
                  form.setValue('filterJsonTree', undefined, {
                    shouldDirty: true,
                  });
                  form.setValue('queryFilter', '', { shouldDirty: true });
                  const nextIsKnowledge =
                    PERSONA_CONTEXT_KNOWLEDGE_TYPES.includes(
                      value as EntityType
                    );
                  form.setValue(
                    'sections',
                    getDefaultPersonaContextSections(value),
                    { shouldDirty: true }
                  );
                  form.setValue('alwaysInContext', nextIsKnowledge, {
                    shouldDirty: true,
                  });
                  form.setValue('fullyRendered', nextIsKnowledge, {
                    shouldDirty: true,
                  });
                }}>
                <Select.OptGroup label={t('label.data-asset-plural')}>
                  {PERSONA_CONTEXT_ASSET_TYPES.map((type) => (
                    <Select.Option key={type} value={type}>
                      {t(PERSONA_CONTEXT_ENTITY_LABEL_KEYS[type])}
                    </Select.Option>
                  ))}
                </Select.OptGroup>
                <Select.OptGroup label={t('label.knowledge')}>
                  {PERSONA_CONTEXT_KNOWLEDGE_TYPES.map((type) => (
                    <Select.Option key={type} value={type}>
                      {t(PERSONA_CONTEXT_ENTITY_LABEL_KEYS[type])}
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              </Select>
            </DrawerPopupContainerProvider>
          </Form.Item>
        )}
      />

      <Form.Item label={t('label.filter')}>
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
          showIcon
          className="persona-ai-context-match-preview"
          data-testid="context-rule-match-preview"
          icon={
            previewLoading ? (
              <Spin size="small" />
            ) : previewError ? (
              <ExclamationCircleOutlined />
            ) : (
              <InfoCircleOutlined />
            )
          }
          message={
            <div className="persona-ai-context-match-preview-content">
              <Typography.Text>
                {previewLoading
                  ? t('message.persona-context-match-preview-loading')
                  : previewError
                  ? t('server.unexpected-error')
                  : preview
                  ? t('message.persona-context-match-preview', {
                      count: preview.matchedCount,
                      sample: preview.sampleNames.join(', ') || t('label.none'),
                    })
                  : t('message.persona-context-match-preview-loading')}
              </Typography.Text>
              <Button
                href={getExplorePath({
                  extraParameters: filterJsonTree
                    ? { queryFilter: filterJsonTree }
                    : undefined,
                  isPersistFilters: false,
                })}
                icon={<ExportOutlined />}
                target="_blank"
                type="link">
                {t('label.view-in-explore')}
              </Button>
            </div>
          }
          type={previewError ? 'error' : 'info'}
        />
      </Form.Item>

      {isKnowledgeRule && (
        <Alert
          showIcon
          className="persona-ai-context-knowledge-note"
          message={t('message.persona-context-generic-content')}
          type="info"
        />
      )}

      <div className="persona-ai-context-behavior-list">
        <Controller
          control={form.control}
          name="alwaysInContext"
          render={({ field }) => (
            <div className="persona-ai-context-behavior-card">
              <div>
                <Typography.Text strong>
                  {t('label.always-in-context')}
                </Typography.Text>
                <Typography.Paragraph type="secondary">
                  {t('message.persona-context-always-description')}
                </Typography.Paragraph>
              </div>
              <Switch
                checked={field.value}
                data-testid="context-rule-always-in-context"
                onChange={field.onChange}
              />
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="fullyRendered"
          render={({ field }) => (
            <div className="persona-ai-context-behavior-card">
              <div>
                <Typography.Text strong>
                  {t('label.fully-rendered')}
                </Typography.Text>
                <Typography.Paragraph type="secondary">
                  {t(
                    entityType === EntityType.DATA_PRODUCT
                      ? 'message.persona-context-data-product-fully-rendered-description'
                      : 'message.persona-context-fully-rendered-description'
                  )}
                </Typography.Paragraph>
              </div>
              <Switch
                checked={field.value}
                data-testid="context-rule-fully-rendered"
                onChange={field.onChange}
              />
            </div>
          )}
        />
      </div>

      <Controller
        control={form.control}
        name="sections"
        render={({ field }) => (
          <Form.Item
            className="persona-ai-context-sections-field"
            label={t('label.context-sections')}>
            <Typography.Paragraph type="secondary">
              {fullyRendered
                ? t('message.persona-context-sections-disabled')
                : t('message.persona-context-sections-description')}
            </Typography.Paragraph>
            <Checkbox.Group
              {...field}
              className="persona-ai-context-section-grid"
              disabled={fullyRendered}
              options={sectionOptions}
            />
          </Form.Item>
        )}
      />

      <Controller
        control={form.control}
        name="maxAssets"
        render={({ field }) => (
          <Form.Item required label={t('label.max-assets')}>
            <InputNumber
              {...field}
              className="persona-ai-context-max-assets"
              data-testid="context-rule-max-assets"
              max={1000}
              min={1}
            />
            <Typography.Paragraph className="m-t-xs" type="secondary">
              {t('message.persona-context-max-assets-description')}
            </Typography.Paragraph>
          </Form.Item>
        )}
        rules={{ max: 1000, min: 1 }}
      />
    </HookForm>
  );

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithHook<ContextRule>({
      className: 'persona-ai-context-rule-drawer',
      closeOnBackdrop: false,
      form: formBody,
      hookForm: form,
      submitLabel: t('label.save-rule'),
      title: rule ? t('label.edit-rule') : t('label.add-rule'),
      width: 720,
      onClose: handleDismiss,
      onSubmit: handleSubmit,
    });

  closeDrawerRef.current = closeDrawer;

  useEffect(() => {
    if (open) {
      form.reset(getDefaultRule(rule));
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
    }
  }, [closeDrawer, form, isOpen, open, openDrawer, rule]);

  return formDrawer;
};
