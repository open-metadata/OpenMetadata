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
  Badge,
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import AddDomainForm, {
  DOMAIN_FORM_DEFAULTS,
  transformDomainFormData,
} from '../../../../components/Domain/AddDomainForm/AddDomainForm.component';
import { DomainFormValues } from '../../../../components/Domain/AddDomainForm/AddDomainForm.interface';
import { DomainFormType } from '../../../../components/Domain/DomainPage.interface';
import { CreationOutlook } from '../../../../components/governance/onboarding/CreationOutlook';
import PageLayoutV1 from '../../../../components/PageLayoutV1/PageLayoutV1';
import { ROUTES } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { EntityType } from '../../../../enums/entity.enum';
import { CreateDataProduct } from '../../../../generated/api/domains/createDataProduct';
import { OnboardingPlaybook } from '../../../../generated/entity/governance/onboardingPlaybook';
import {
  CustomProperty,
  EntityReference,
} from '../../../../generated/entity/type';
import { TargetEntityType } from '../../../../generated/governance/intakeForm';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  addDataProducts,
  patchDataProduct,
} from '../../../../rest/dataProductAPI';
import { getOnboardingPlaybookForEntityType } from '../../../../rest/governance/onboarding/OnboardingPlaybook.api';
import { getCustomPropertiesByEntityType } from '../../../../rest/metadataTypeAPI';
import { createEntityWithCoverImage } from '../../../../utils/CoverImageUploadUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { setCreateEntityFieldError } from '../../../../utils/FormDrawerUtils';
import {
  fieldValue,
  hasValue,
  missingCreationChecks,
} from '../../../../utils/governance/onboarding/Onboarding.utils';
import { getDataProductDetailsPath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';

/** The fields the API itself refuses a data product without, whatever the playbook says. */
const INTRINSIC_PATHS = ['name', 'description', 'domains'];
const INTRINSIC_TITLE_KEYS: Record<string, string> = {
  description: 'label.description',
  domains: 'label.domain',
  name: 'label.name',
};

const asOwnerOption = (user: { id: string; name?: string }) => ({
  id: user.id,
  label: getEntityName(user),
  value: {
    id: user.id,
    name: user.name,
    type: EntityType.USER,
  } as EntityReference,
});

/**
 * Creating a data product is the Creation gate made visible: the fields the playbook enforces at
 * the API layer, in the playbook's own order, next to what happens once the asset exists. It is a
 * page rather than a drawer because the gate and its consequences do not fit beside each other in
 * 670px.
 */
const CreateDataProductPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { permissions } = usePermissionProvider();
  const currentUser = useApplicationStore((state) => state.currentUser);
  const [playbook, setPlaybook] = useState<OnboardingPlaybook | null>(null);
  const [customProperties, setCustomProperties] = useState<CustomProperty[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<DomainFormValues>({
    defaultValues: {
      ...DOMAIN_FORM_DEFAULTS,
      owners: currentUser ? [asOwnerOption(currentUser)] : [],
    },
  });
  const watched = useWatch({ control: form.control });
  const values = useMemo(
    () =>
      transformDomainFormData(
        form.getValues(),
        DomainFormType.DATA_PRODUCT
      ) as CreateDataProduct,
    [form, watched]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getOnboardingPlaybookForEntityType(TargetEntityType.DataProduct),
      getCustomPropertiesByEntityType(EntityType.DATA_PRODUCT),
    ])
      .then(([loadedPlaybook, properties]) => {
        if (!cancelled) {
          setPlaybook(loadedPlaybook ?? null);
          setCustomProperties(properties ?? []);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          showErrorToast(error);
        }
      })
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * What still keeps the API from accepting this product: its own required fields first, then the
   * checks the Creation gate adds on top - in the order the form asks for them.
   */
  const blockers = useMemo(() => {
    const intrinsic = INTRINSIC_PATHS.filter(
      (path) => !hasValue(fieldValue(values, path))
    ).map((path) => ({ path, title: t(INTRINSIC_TITLE_KEYS[path]) }));
    const checks = missingCreationChecks(playbook, values).map((step) => ({
      path: step.fieldPath ?? step.id,
      title: step.title ?? step.fieldPath ?? step.id,
    }));

    return [
      ...intrinsic.filter(
        (item) => !checks.some((check) => check.path === item.path)
      ),
      ...checks,
    ];
  }, [playbook, values, t]);

  const handleSubmit = useCallback(
    async (data: DomainFormValues) => {
      setIsSaving(true);
      try {
        const created = await createEntityWithCoverImage({
          formData: transformDomainFormData(
            data,
            DomainFormType.DATA_PRODUCT
          ) as CreateDataProduct,
          entityType: EntityType.DATA_PRODUCT,
          entityLabel: t('label.data-product'),
          entityPluralLabel: 'data-products',
          createEntity: addDataProducts,
          patchEntity: patchDataProduct,
          onSuccess: () => form.reset(),
          t,
          suppressErrorToast: true,
        });
        navigate(
          getDataProductDetailsPath(created.fullyQualifiedName ?? created.name)
        );
      } catch (error) {
        setCreateEntityFieldError(
          error,
          form,
          'name',
          t('message.entity-with-name-already-exists', {
            entity: t('label.data-product'),
          }),
          t('server.add-entity-error', {
            entity: t('label.data-product').toLowerCase(),
          })
        );
      } finally {
        setIsSaving(false);
      }
    },
    [form, navigate, t]
  );

  const canCreate = Boolean(permissions.dataProduct?.Create);
  const version = playbook?.version;

  return (
    <PageLayoutV1
      pageTitle={t('label.add-entity', { entity: t('label.data-product') })}>
      <Box
        className="tw:gap-5 tw:p-6"
        data-testid="create-data-product-page"
        direction="col">
        <Box align="center" className="tw:gap-2.5">
          <Link
            className="tw:text-sm tw:font-medium tw:text-brand-secondary"
            to={ROUTES.DATA_PRODUCT}>
            {t('label.data-product-plural')}
          </Link>
          <Typography className="tw:text-quaternary">/</Typography>
          <Typography as="h1" size="display-xs" weight="semibold">
            {t('label.new-data-product')}
          </Typography>
        </Box>

        <Box
          className="tw:grid tw:grid-cols-1 tw:items-start tw:gap-5 tw:xl:grid-cols-[minmax(0,1fr)_340px]"
          direction="col">
          <Card variant="elevated">
            <Card.Header
              extra={
                version === undefined ? undefined : (
                  <Badge color="brand" size="sm" type="pill-color">
                    {t('label.version-short', { version })}
                  </Badge>
                )
              }
              subtitle={
                playbook
                  ? t('message.creation-gate-of-playbook', {
                      playbook: getEntityName(playbook),
                    })
                  : t('message.no-playbook-governs-this-type')
              }
              title={t('label.required-to-create')}
            />
            <Card.Content>
              {!isLoading && (
                <AddDomainForm
                  isFormInDialog
                  customProperties={customProperties}
                  form={form}
                  loading={isSaving}
                  playbook={playbook}
                  type={DomainFormType.DATA_PRODUCT}
                  variant={playbook ? 'playbook' : 'default'}
                  onCancel={() => navigate(ROUTES.DATA_PRODUCT)}
                  onSubmit={handleSubmit}
                />
              )}
            </Card.Content>
            <Card.Footer>
              <Box align="center" className="tw:w-full tw:gap-3" wrap="wrap">
                <Typography
                  className="tw:flex-1 tw:text-tertiary"
                  data-testid="create-hint"
                  size="text-xs">
                  {blockers.length
                    ? t('message.field-required-at-creation', {
                        title: blockers[0].title,
                      })
                    : t('message.enforced-at-the-api-layer-too')}
                </Typography>
                <Button
                  color="secondary"
                  data-testid="cancel-data-product"
                  onPress={() => navigate(ROUTES.DATA_PRODUCT)}>
                  {t('label.cancel')}
                </Button>
                <Button
                  data-testid="create-data-product"
                  isDisabled={blockers.length > 0 || !canCreate}
                  isLoading={isSaving}
                  onPress={() => form.handleSubmit(handleSubmit)()}>
                  {t('label.create-data-product')}
                </Button>
              </Box>
            </Card.Footer>
          </Card>

          {playbook && (
            <Box className="tw:xl:sticky tw:xl:top-0">
              <CreationOutlook
                customProperties={customProperties}
                playbook={playbook}
                values={values}
              />
            </Box>
          )}
        </Box>
      </Box>
    </PageLayoutV1>
  );
};

export default CreateDataProductPage;
