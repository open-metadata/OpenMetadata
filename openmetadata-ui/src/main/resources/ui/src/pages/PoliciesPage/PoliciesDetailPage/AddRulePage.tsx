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
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { trim } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { INITIAL_RULE } from '../../../components/discovery/personal-space/Profile/tabs/access-control/AccessControl.constants';
import AccessControlRuleForm from '../../../components/discovery/personal-space/Profile/tabs/access-control/AccessControlRuleForm';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { HTTP_STATUS_CODE } from '../../../constants/Auth.constants';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Rule } from '../../../generated/api/policies/createPolicy';
import { Policy } from '../../../generated/entity/policies/policy';
import { useFqn } from '../../../hooks/useFqn';
import { getPolicyByName, patchPolicy } from '../../../rest/rolesAPIV1';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  getPath,
  getPolicyWithFqnPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const policiesPath = getPath(GlobalSettingOptions.POLICIES);

const AddRulePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const [isLoading, setLoading] = useState<boolean>(false);
  const [policy, setPolicy] = useState<Policy>({} as Policy);
  const ruleForm = useForm<Rule>({ defaultValues: INITIAL_RULE });

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.setting-plural'),
        url: getSettingPath(),
      },
      {
        name: t('label.policy-plural'),
        url: policiesPath,
      },
      {
        name: getEntityName(policy),
        url: getPolicyWithFqnPath(fqn),
      },

      {
        name: t('label.add-new-entity', {
          entity: t('label.rule'),
        }),
        url: '',
      },
    ],
    [fqn, policy]
  );

  const fetchPolicy = async () => {
    setLoading(true);
    try {
      const data = await getPolicyByName(
        fqn,
        `${TabSpecificField.OWNERS},${TabSpecificField.LOCATION},${TabSpecificField.TEAMS},${TabSpecificField.ROLES}`
      );
      setPolicy(data ?? ({} as Policy));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(getPolicyWithFqnPath(fqn));
  };

  const handleSubmit = ruleForm.handleSubmit(async (ruleData: Rule) => {
    const { condition, ...rest } = { ...ruleData, name: trim(ruleData.name) };
    const patch = compare(policy, {
      ...policy,
      rules: [...policy.rules, condition ? { ...rest, condition } : rest],
    });
    try {
      const data = await patchPolicy(patch, policy.id);
      if (data) {
        handleBack();
      }
    } catch (error) {
      if (
        (error as AxiosError).response?.status === HTTP_STATUS_CODE.CONFLICT
      ) {
        showErrorToast(
          t('server.entity-already-exist', {
            entity: t('label.rule'),
            entityPlural: t('label.rule-lowercase-plural'),
            name: ruleData.name,
          })
        );
      } else {
        showErrorToast(
          error as AxiosError,
          t('server.create-entity-error', {
            entity: t('label.rule-lowercase'),
          })
        );
      }
    }
  });

  useEffect(() => {
    fetchPolicy();
  }, [fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.add-new-entity', {
        entity: t('label.rule'),
      })}>
      <Card className="m-x-auto w-800">
        <Card.Content>
          <TitleBreadcrumb className="m-b-md" titleLinks={breadcrumb} />

          <Typography
            as="p"
            className="text-base tw:mb-4!"
            data-testid="add-rule-title">
            {t('label.add-new-entity', { entity: t('label.rule') })}
          </Typography>
          <Box data-testid="rule-form" direction="col" gap={4}>
            <AccessControlRuleForm form={ruleForm} />
            <Box
              inline
              align="center"
              className="layout-space layout-space-horizontal w-full justify-end"
              gap={2}
              itemClassName="layout-space-item">
              <Button
                color="secondary"
                data-testid="cancel-btn"
                onClick={handleBack}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="submit-btn"
                onClick={() => handleSubmit()}>
                {t('label.create')}
              </Button>
            </Box>
          </Box>
        </Card.Content>
      </Card>
    </PageLayoutV1>
  );
};

export default AddRulePage;
