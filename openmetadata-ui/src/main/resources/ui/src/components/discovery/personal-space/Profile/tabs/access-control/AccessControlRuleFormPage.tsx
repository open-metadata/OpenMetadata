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
import { Box, Button } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { FC, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import { ResourceEntity } from '../../../../../../enums/permissions.enum';
import { Rule } from '../../../../../../generated/api/policies/createPolicy';
import { Policy } from '../../../../../../generated/entity/policies/policy';
import { useEntityPermissions } from '../../../../../../hooks/useEntityPermissions/useEntityPermissions';
import {
  getPolicyByName,
  patchPolicy,
} from '../../../../../../rest/rolesAPIV1';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import Loader from '../../../../../common/Loader/Loader';
import { INITIAL_RULE } from './AccessControl.constants';
import type { AccessControlView } from './AccessControl.types';
import AccessControlRuleForm from './AccessControlRuleForm';

interface AccessControlRuleFormPageProps {
  fqn: string;
  /** The rule to edit; omitted when adding a rule. */
  ruleName?: string;
  onNavigate: (view: AccessControlView) => void;
  onRename?: (policyDisplayName: string) => void;
}

/** Add or edit one rule of a policy as its own page, like Add Policy. */
const AccessControlRuleFormPage: FC<AccessControlRuleFormPageProps> = ({
  fqn,
  ruleName,
  onNavigate,
  onRename,
}) => {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState<Policy>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const ruleForm = useForm<Rule>({ defaultValues: INITIAL_RULE });
  // A rule link can be opened directly, past the detail page's edit gate.
  const { canEditAll, isLoading: isPermissionLoading } = useEntityPermissions(
    ResourceEntity.POLICY,
    fqn
  );

  useEffect(() => {
    // A late response must not rename or navigate after the user has moved on.
    let isCurrent = true;
    const fetchPolicy = async () => {
      setIsLoading(true);
      try {
        const data = await getPolicyByName(fqn, 'owners');
        if (!isCurrent) {
          return;
        }
        const rule = data.rules?.find((r) => r.name === ruleName);
        // The rule was renamed or deleted since the link was made: saving would
        // send an empty patch and drop the user's input, so go back instead.
        if (ruleName && !rule) {
          showErrorToast(
            t('label.no-entity-found', { entity: t('label.rule') })
          );
          onNavigate({
            type: 'policies-detail',
            fqn,
            name: getEntityName(data),
          });

          return;
        }
        setPolicy(data);
        onRename?.(getEntityName(data));
        if (rule) {
          ruleForm.reset(rule);
        }
      } catch (err) {
        if (isCurrent) {
          showErrorToast(err as AxiosError);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    };
    void fetchPolicy();

    return () => {
      isCurrent = false;
    };
  }, [fqn, ruleName, onNavigate, onRename, ruleForm, t]);

  const goBack = useCallback(
    () =>
      onNavigate({
        type: 'policies-detail',
        fqn,
        name: policy ? getEntityName(policy) : fqn,
      }),
    [fqn, onNavigate, policy]
  );

  const handleSave = async (formData: Rule) => {
    if (!policy) {
      return;
    }

    const { condition, ...rest } = {
      ...formData,
      name: formData.name?.trim() ?? '',
    };
    const newRule = condition ? { ...rest, condition } : rest;
    const rules = ruleName
      ? (policy.rules ?? []).map((r) => (r.name === ruleName ? newRule : r))
      : [...(policy.rules ?? []), newRule];

    setIsSaving(true);
    try {
      await patchPolicy(compare(policy, { ...policy, rules }), policy.id);
      showSuccessToast(
        t('server.entity-updated-success', { entity: t('label.policy') })
      );
      goBack();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isPermissionLoading && !canEditAll) {
      showErrorToast(t(NO_PERMISSION_FOR_ACTION));
      goBack();
    }
  }, [canEditAll, goBack, isPermissionLoading, t]);

  if (isLoading || isPermissionLoading) {
    return <Loader />;
  }

  return (
    <Box className="tw:h-full tw:min-h-0" direction="col">
      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto">
        <Box
          className="tw:w-full tw:max-w-[50%] tw:px-6 tw:pb-6 tw:mx-auto"
          data-testid="rule-form-container"
          direction="col">
          <AccessControlRuleForm
            form={ruleForm}
            takenNames={(policy?.rules ?? [])
              .filter((r) => r.name !== ruleName)
              .map((r) => r.name ?? '')}
          />
        </Box>
      </div>

      <Box
        className="tw:shrink-0 tw:border-t tw:border-secondary tw:bg-surface tw:px-6 tw:py-4"
        data-testid="rule-form-footer"
        direction="row"
        gap={3}
        justify="end">
        <Button color="tertiary" data-testid="cancel-btn" onPress={goBack}>
          {t('label.cancel')}
        </Button>
        <Button
          color="primary"
          data-testid="submit-btn"
          isDisabled={!policy || !canEditAll}
          isLoading={isSaving}
          onPress={() => void ruleForm.handleSubmit(handleSave)()}>
          {t('label.save')}
        </Button>
      </Box>
    </Box>
  );
};

export default AccessControlRuleFormPage;
