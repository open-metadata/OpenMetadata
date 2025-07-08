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
import { Button, Card, Col, Input, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { toLower } from 'lodash';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconBotProfile } from '../../../../assets/svg/bot-profile.svg';
import { PAGE_SIZE_LARGE, TERM_ADMIN } from '../../../../constants/constants';
import { GlobalSettingOptions } from '../../../../constants/GlobalSettings.constants';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { EntityType } from '../../../../enums/entity.enum';
import { Role } from '../../../../generated/entity/teams/role';
import { getRoles } from '../../../../rest/rolesAPIV1';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getSettingPath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DescriptionV1 from '../../../common/EntityDescription/DescriptionV1';
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
  const { getResourceLimit, config } = useLimitStore();

  const [disableFields, setDisableFields] = useState<string[]>(['token']);

  const { t } = useTranslation();

  const { editAllPermission, displayNamePermission, descriptionPermission } =
    useMemo(
      () => ({
        editAllPermission: botPermission.EditAll,
        displayNamePermission: botPermission.EditDisplayName,
        descriptionPermission: botPermission.EditDescription,
      }),
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

  const fetchRoles = async () => {
    try {
      const { data } = await getRoles(
        '',
        undefined,
        undefined,
        false,
        PAGE_SIZE_LARGE
      );
      setRoles(data);
    } catch (err) {
      setRoles([]);
      showErrorToast(err as AxiosError);
    }
  };

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
                      {(displayNamePermission || editAllPermission) && (
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
                <DescriptionV1
                  description={botData.description}
                  entityName={getEntityName(botData)}
                  entityType={EntityType.BOT}
                  hasEditAccess={descriptionPermission || editAllPermission}
                  showCommentsIcon={false}
                  onDescriptionUpdate={handleDescriptionChange}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={24}>
          <RolesCard
            roles={roles}
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
    fetchRoles();
    initLimits();
  }, []);

  useEffect(() => {
    prepareSelectedRoles();
  }, [botUserData]);

  return (
    <PageLayoutV1
      leftPanel={fetchLeftPanel()}
      pageTitle={t('label.bot-detail')}
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
