/*
 *  Copyright 2022 Collate.
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
  Badge,
  Box,
  Button,
  HookForm,
  SlideoutMenu,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isUndefined } from 'lodash';
import { FocusEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as ColumnIcon } from '../../../../assets/svg/entity/column.svg';
import { GlobalSettingsMenuCategory } from '../../../../constants/GlobalSettings.constants';
import {
  CUSTOM_PROPERTY_CATEGORY,
  OPEN_METADATA,
} from '../../../../constants/service-guide.constant';
import { EntityType } from '../../../../enums/entity.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { Category, Type } from '../../../../generated/entity/type';
import { CustomProperty } from '../../../../generated/type/customProperty';
import {
  addPropertyToEntity,
  getTypeByFQN,
  getTypeListByCategory,
} from '../../../../rest/metadataTypeAPI';
import { getSettingOptionByEntityType } from '../../../../utils/GlobalSettingsUtils';
import { getSettingPath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { AddCustomPropertyFormValues } from '../../../discovery/personal-space/Profile/tabs/custom-properties/CustomPropertiesPanel.types';
import { toCustomPropertyPayload } from '../../../discovery/personal-space/Profile/tabs/custom-properties/CustomPropertiesPanel.utils';
import CustomPropertyFormFields from '../../../discovery/personal-space/Profile/tabs/custom-properties/CustomPropertyFormFields';

interface AddCustomPropertyProps {
  onCancel?: () => void;
  onSubmit?: (data: CustomProperty) => void;
  loading?: boolean;
  entityType?: EntityType;
  open?: boolean;
  onClose?: () => void;
}

const DEFAULT_VALUES: AddCustomPropertyFormValues = {
  name: '',
  displayName: '',
  propertyType: null,
  description: '',
  multiSelect: false,
};

const AddCustomProperty = ({
  onSubmit,
  loading,
  entityType: entityTypeProp,
  open,
  onClose,
  onCancel,
}: AddCustomPropertyProps) => {
  // Validate while typing so the drawer's Create button tracks validity.
  const form = useForm<AddCustomPropertyFormValues>({
    mode: 'onChange',
    defaultValues: DEFAULT_VALUES,
  });
  const { entityType: entityTypeParam } = useRequiredParams<{
    entityType: EntityType;
  }>();
  const entityType = entityTypeProp ?? entityTypeParam;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [typeDetail, setTypeDetail] = useState<Type>();
  const [propertyTypes, setPropertyTypes] = useState<Type[]>([]);
  const [activeField, setActiveField] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [showSidePanel, setShowSidePanel] = useState<boolean>(false);
  const [descriptionKey, setDescriptionKey] = useState(0);

  const slashedBreadcrumb = useMemo(
    () => [
      {
        name: t('label.setting-plural'),
        url: getSettingPath(),
      },
      {
        name: t('label.custom-attribute-plural'),
        url: getSettingPath(
          GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
          getSettingOptionByEntityType(entityType)
        ),
      },
      {
        name: t('label.add-entity', {
          entity: t('label.custom-property'),
        }),
        url: '',
      },
    ],
    [entityType, t]
  );

  const fetchPropertyType = async () => {
    try {
      const response = await getTypeListByCategory(Category.Field);
      setPropertyTypes(response.data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchTypeDetail = async (typeFQN: string) => {
    try {
      setTypeDetail(await getTypeByFQN(typeFQN));
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else {
      navigate(-1);
    }
  }, [navigate, onCancel]);

  const handleFieldFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    const isDescription = event.target.classList.contains('ProseMirror');
    setActiveField(isDescription ? 'root/description' : event.target.id);
  }, []);

  const handleFormSubmit = async (data: AddCustomPropertyFormValues) => {
    if (isUndefined(typeDetail)) {
      return;
    }
    const payload = toCustomPropertyPayload(data, propertyTypes);

    if (onSubmit) {
      onSubmit(payload);

      return;
    }

    try {
      setIsCreating(true);
      await addPropertyToEntity(typeDetail.id ?? '', payload);
      navigate(-1);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsCreating(false);
    }
  };

  const submit = form.handleSubmit(handleFormSubmit);

  useEffect(() => {
    if (entityType) {
      fetchTypeDetail(entityType);
    }
  }, [entityType]);

  useEffect(() => {
    fetchPropertyType();
  }, []);

  // The drawer stays mounted between openings, so start each one clean.
  useEffect(() => {
    if (open) {
      form.reset(DEFAULT_VALUES);
      setDescriptionKey((key) => key + 1);
    }
  }, [open, form]);

  const formContent = (
    // Tracks the focused field for the doc panel; focus events bubble.
    <div className="tw:mt-4" role="presentation" onFocus={handleFieldFocus}>
      <HookForm
        className="tw:flex tw:flex-col tw:gap-4"
        data-testid="custom-property-form"
        form={form}
        onSubmit={submit}>
        <CustomPropertyFormFields
          descriptionKey={descriptionKey}
          form={form}
          propertyTypes={propertyTypes}
          typeAddon={
            entityType === EntityType.TABLE_COLUMN && (
              <Box direction="col" gap={1}>
                <Typography size="text-sm" weight="medium">
                  {t('label.applies-to')}
                </Typography>
                <Badge
                  className="flex items-center gap-1"
                  color="gray"
                  data-testid="applies-to"
                  size="md"
                  type="pill-color">
                  <ColumnIcon height={14} width={14} />
                  {t('label.table-column')}
                </Badge>
              </Box>
            )
          }
        />
        {isUndefined(open) && (
          <Box className="layout-row" gap={3} justify="end" wrap="wrap">
            <Box className="layout-column tw:block">
              <Button
                color="secondary"
                data-testid="back-button"
                onClick={handleCancel}>
                {t('label.back')}
              </Button>
            </Box>
            <Box className="layout-column tw:block">
              <Button
                color="primary"
                data-testid="create-button"
                isLoading={isCreating || loading}
                type="submit">
                {t('label.create')}
              </Button>
            </Box>
          </Box>
        )}
      </HookForm>
    </div>
  );

  if (!isUndefined(open)) {
    const isDrawerLoading = loading || isCreating;

    return (
      <SlideoutMenu
        isDismissable
        className="tw:z-1000"
        data-testid="add-custom-property-drawer"
        isOpen={open}
        width={showSidePanel ? 1200 : 700}
        onOpenChange={(isDrawerOpen) => {
          if (!isDrawerOpen) {
            (onClose ?? handleCancel)();
          }
        }}>
        {({ close }) => (
          <>
            <SlideoutMenu.Header
              className="tw:flex tw:items-center tw:justify-between tw:gap-4 tw:border-b tw:border-secondary tw:py-4"
              onClose={close}>
              <Typography
                className="tw:text-primary"
                size="text-lg"
                weight="semibold">
                {t('label.add-entity', {
                  entity: t('label.custom-property'),
                })}
              </Typography>
              <div className="tw:mr-8 tw:flex tw:items-center tw:gap-2">
                <Toggle
                  data-testid="show-side-panel-switch"
                  isSelected={showSidePanel}
                  onChange={setShowSidePanel}
                />
                <Typography className="tw:text-secondary" size="text-sm">
                  {t('label.show-help-text')}
                </Typography>
              </div>
            </SlideoutMenu.Header>

            <SlideoutMenu.Content>
              <div className="tw:flex tw:size-full tw:gap-6">
                <div
                  className={
                    showSidePanel ? 'tw:w-3/5 tw:overflow-y-auto' : 'tw:w-full'
                  }>
                  {formContent}
                </div>
                {showSidePanel && (
                  <div className="tw:w-2/5 tw:overflow-y-auto tw:border-l tw:border-secondary tw:pl-6">
                    <div className="service-doc-panel">
                      <ServiceDocPanel
                        activeField={activeField}
                        serviceName={CUSTOM_PROPERTY_CATEGORY}
                        serviceType={OPEN_METADATA as ServiceCategory}
                      />
                    </div>
                  </div>
                )}
              </div>
            </SlideoutMenu.Content>

            <SlideoutMenu.Footer>
              <div className="tw:flex tw:justify-end tw:gap-4">
                <Button
                  color="tertiary"
                  data-testid="cancel-button"
                  isDisabled={isDrawerLoading}
                  onClick={close}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="create-button"
                  isDisabled={isDrawerLoading || !form.formState.isValid}
                  isLoading={isDrawerLoading}
                  onClick={submit}>
                  {t('label.create')}
                </Button>
              </div>
            </SlideoutMenu.Footer>
          </>
        )}
      </SlideoutMenu>
    );
  }

  const firstPanelChildren = (
    <>
      <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
      {formContent}
    </>
  );

  const secondPanelChildren = (
    <ServiceDocPanel
      activeField={activeField}
      serviceName={CUSTOM_PROPERTY_CATEGORY}
      serviceType={OPEN_METADATA as ServiceCategory}
    />
  );

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: firstPanelChildren,
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.custom-property'),
      })}
      secondPanel={{
        children: secondPanelChildren,
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default AddCustomProperty;
