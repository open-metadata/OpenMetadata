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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Card, Col, Input, Row, Tag, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { debounce, toLower, uniqBy } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconBotProfile } from '../../../../assets/svg/bot-profile.svg';
import { TERM_ADMIN } from '../../../../constants/constants';
import { GlobalSettingOptions } from '../../../../constants/GlobalSettings.constants';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { EntityType } from '../../../../enums/entity.enum';
import { Role } from '../../../../generated/entity/teams/role';
import { searchRoles } from '../../../../rest/rolesAPIV1';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { getSettingPath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import Description from '../../../common/EntityDescription/Description';
import { EditIconButton } from '../../../common/IconButtons/EditIconButton';
import InheritedRolesCard from '../../../common/InheritedRolesCard/InheritedRolesCard.component';
import RolesCard from '../../../common/RolesCard/RolesCard.component';
import TitleBreadcrumb from '../../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import AccessTokenCard from '../../Users/AccessTokenCard/AccessTokenCard.component';
import { BotsDetailProps } from './BotDetails.interfaces';

const BotDetails: FC<BotsDetailProps> = ({
  botData,
  botUserData,
  updateBotsDetails,
  revokeTokenHandler,
  botPermission,
  updateUserDetails,
}) => {
  const [displayName, setDisplayName] = useState(botData.displayName);
  const [isDisplayNameEdit, setIsDisplayNameEdit] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Array<string>>([]);
  const [roles, setRoles] = useState<Array<Role>>([]);
  const [isRolesLoading, setIsRolesLoading] = useState(false);
  const selectedRolesRef = useRef<string[]>([]);
  const { getResourceLimit, config } = useLimitStore();

  const [disableFields, setDisableFields] = useState<string[]>(['token']);

  const { t } = useTranslation();

  // Consumer via the `botPermission: OperationPermission` prop (raw contract kept per Task 8
  // rule 2). No `deleted` argument — bots aren't soft-deletable through this page and the old
  // expressions never referenced a deleted concept. Both call sites below OR'd a raw
  // field-specific flag with the raw `botPermission.EditAll` (displayNamePermission ||
  // editAllPermission, descriptionPermission || editAllPermission) — each now reads
  // canEditDisplayName/canEditDescription directly (explicit-deny-wins fix, Task 6 Finding 1);
  // the prioritized flag already folds in the EditAll fallback, so the separate EditAll term
  // isn't lost, just no longer spelled out raw. The old `editAllPermission` (bare EditAll-only)
  // local is now unused and dropped (Task 7/8 dead-code precedent).
  const { canEditDisplayName, canEditDescription } = useMemo(
    () => getDerivedPermissionFlags(botPermission),
    [botPermission]
  );

  const initLimits = async () => {
    if (!config?.enable) {
      setDisableFields([]);
    } else {
      const limits = await getResourceLimit('bot', false);

      setDisableFields(limits.configuredLimit.disabledFields ?? []);
    }
  };

  const fetchRoles = useCallback(async (query = '') => {
    setIsRolesLoading(true);

    try {
      const data = await searchRoles(query);
      setRoles((prevRoles) => {
        const selectedRoleOptions = prevRoles.filter((role) =>
          selectedRolesRef.current.includes(role.id)
        );

        return uniqBy([...selectedRoleOptions, ...data], 'id');
      });
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsRolesLoading(false);
    }
  }, []);

  const debouncedFetchRoles = useMemo(
    () => debounce(fetchRoles, 300),
    [fetchRoles]
  );

  const onDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayName(e.target.value);
  };

  const handleDisplayNameChange = () => {
    if (displayName !== botData.displayName) {
      updateBotsDetails({ displayName: displayName ?? '' });
    }
    setIsDisplayNameEdit(false);
  };

  const handleDescriptionChange = async (description: string) => {
    await updateBotsDetails({ description });
  };

  const prepareSelectedRoles = () => {
    const defaultRoles = [...(botUserData.roles?.map((role) => role.id) || [])];
    if (botUserData.isAdmin) {
      defaultRoles.push(toLower(TERM_ADMIN));
    }
    setSelectedRoles(defaultRoles);
  };

  const fetchLeftPanel = () => {
    return (
      <Row gutter={[0, 20]}>
        <Col span={24}>
          <Card className="page-layout-v1-left-panel mt-2">
            <div data-testid="left-panel">
              <div className="d-flex flex-col gap-5">
                <IconBotProfile widths="280px" />

                <div className="d-flex gap-2 items-center">
                  {isDisplayNameEdit ? (
                    <>
                      <Input
                        data-testid="displayName"
                        id="displayName"
                        name="displayName"
                        placeholder={t('label.display-name')}
                        value={displayName}
                        onChange={onDisplayNameChange}
                      />
                      <div className="flex justify-end" data-testid="buttons">
                        <Button
                          className="text-sm mr-1"
                          data-testid="cancel-displayName"
                          icon={<CloseOutlined />}
                          size="small"
                          type="primary"
                          onMouseDown={() => setIsDisplayNameEdit(false)}
                        />

                        <Button
                          className="text-sm mr-1"
                          data-testid="save-displayName"
                          icon={<CheckOutlined />}
                          size="small"
                          type="primary"
                          onClick={handleDisplayNameChange}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {displayName ? (
                        <Typography.Title ellipsis className="m-0" level={5}>
                          {displayName}
                        </Typography.Title>
                      ) : (
                        <Typography.Text className="text-grey-muted">
                          {t('label.add-entity', {
                            entity: t('label.display-name'),
                          })}
                        </Typography.Text>
                      )}
                      {canEditDisplayName && (
                        <div>
                          <EditIconButton
                            newLook
                            data-testid="edit-displayName"
                            size="small"
                            title={t('label.edit-entity', {
                              entity: t('label.display-name'),
                            })}
                            onClick={() => setIsDisplayNameEdit(true)}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
                {botUserData.allowImpersonation && (
                  <Tooltip title={t('message.allow-impersonation-help')}>
                    <Tag
                      className="w-fit-content"
                      color="blue"
                      data-testid="impersonation-enabled-badge">
                      {t('label.impersonation-enabled')}
                    </Tag>
                  </Tooltip>
                )}
                <Description
                  description={botData.description}
                  entityName={getEntityName(botData)}
                  entityType={EntityType.BOT}
                  hasEditAccess={canEditDescription}
                  showCommentsIcon={false}
                  onDescriptionUpdate={handleDescriptionChange}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={24}>
          <RolesCard
            isRolesLoading={isRolesLoading}
            roles={roles}
            searchRolesOptions={debouncedFetchRoles}
            selectedRoles={selectedRoles}
            setSelectedRoles={(selectedRoles) =>
              setSelectedRoles(selectedRoles)
            }
            updateUserDetails={updateUserDetails}
            userData={botUserData}
          />
        </Col>
        <Col span={24}>
          <InheritedRolesCard userData={botUserData} />
        </Col>
      </Row>
    );
  };

  useEffect(() => {
    selectedRolesRef.current = selectedRoles;
  }, [selectedRoles]);

  useEffect(() => {
    fetchRoles();
    initLimits();
  }, []);

  useEffect(() => {
    return () => {
      debouncedFetchRoles.cancel();
    };
  }, [debouncedFetchRoles]);

  useEffect(() => {
    prepareSelectedRoles();
    setRoles((prevRoles) =>
      uniqBy(
        [
          ...prevRoles,
          ...((botUserData.roles ?? []).map((role) => ({
            id: role.id,
            name: role.name ?? '',
            displayName: role.displayName,
          })) as Role[]),
        ],
        'id'
      )
    );
  }, [botUserData]);

  return (
    <PageLayoutV1
      leftPanel={fetchLeftPanel()}
      pageTitle={getEntityName(botData) || t('label.bot-detail')}
      rightPanel={
        <Card className="h-full m-b-box" data-testid="right-panel">
          <div className="d-flex flex-col">
            <Typography.Text className="mb-2 text-lg">
              {t('label.token-security')}
            </Typography.Text>
            <Typography.Text className="mb-2">
              {t('message.token-security-description')}
            </Typography.Text>
          </div>
        </Card>
      }
      rightPanelWidth={300}>
      <div className="m-x-box">
        <TitleBreadcrumb
          className="m-y-mlg"
          titleLinks={[
            {
              name: 'Bots',
              url: getSettingPath(GlobalSettingOptions.BOTS),
            },
            { name: botData.name || '', url: '', activeTitle: true },
          ]}
        />
        <AccessTokenCard
          isBot
          botData={botData}
          botUserData={botUserData}
          disabled={disableFields.includes('token')}
          revokeTokenHandlerBot={revokeTokenHandler}
        />
      </div>
    </PageLayoutV1>
  );
};

export default BotDetails;
