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

import { Button, Card, Form, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { trim } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { HTTP_STATUS_CODE } from '../../../constants/Auth.constants';
import { GlobalSettingOptions } from '../../../constants/GlobalSettings.constants';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Effect, Rule } from '../../../generated/api/policies/createPolicy';
import { Policy } from '../../../generated/entity/policies/policy';
import { useFqn } from '../../../hooks/useFqn';
import { getPolicyByName, patchPolicy } from '../../../rest/rolesAPIV1';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getPath,
  getPolicyWithFqnPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import RuleForm from '../RuleForm/RuleForm';

const policiesPath = getPath(GlobalSettingOptions.POLICIES);

const AddRulePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const [isLoading, setLoading] = useState<boolean>(false);
  const [policy, setPolicy] = useState<Policy>({} as Policy);
  const [ruleData, setRuleData] = useState<Rule>({
    name: '',
    description: '',
    resources: [],
    operations: [],
    condition: '',
    effect: Effect.Allow,
  });

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

  const handleSubmit = async () => {
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
  };

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
        <TitleBreadcrumb className="m-b-md" titleLinks={breadcrumb} />

        <Typography.Paragraph
          className="text-base"
          data-testid="add-rule-title">
          {t('label.add-new-entity', { entity: t('label.rule') })}
        </Typography.Paragraph>
        <Form
          data-testid="rule-form"
          id="rule-form"
          initialValues={{
            ruleEffect: ruleData.effect,
          }}
          layout="vertical"
          onFinish={handleSubmit}>
          <RuleForm ruleData={ruleData} setRuleData={setRuleData} />
          <Space align="center" className="w-full justify-end">
            <Button data-testid="cancel-btn" type="link" onClick={handleBack}>
              {t('label.cancel')}
            </Button>
            <Button
              data-testid="submit-btn"
              form="rule-form"
              htmlType="submit"
              type="primary">
              {t('label.create')}
            </Button>
          </Space>
        </Form>
      </Card>
    </PageLayoutV1>
  );
};

export default AddRulePage;
