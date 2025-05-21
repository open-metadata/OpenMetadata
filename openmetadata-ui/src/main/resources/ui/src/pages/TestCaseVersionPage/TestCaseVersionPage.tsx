import Icon from '@ant-design/icons';
import { Button, Col, Row, Tooltip, Typography } from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { AxiosError } from 'axios';
import { isUndefined, toString } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { ReactComponent as TestCaseIcon } from '../../assets/svg/ic-checklist.svg';
import { ReactComponent as VersionIcon } from '../../assets/svg/ic-version.svg';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import EntityHeaderTitle from '../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { EntityField } from '../../constants/Feeds.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { ChangeDescription, TestCase } from '../../generated/tests/testCase';
import { EntityHistory } from '../../generated/type/entityHistory';
import { useFqn } from '../../hooks/useFqn';
import {
  getTestCaseByFqn,
  getTestCaseVersionDetails,
  getTestCaseVersionList,
} from '../../rest/testAPI';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getBasicEntityInfoFromVersionData,
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
} from '../../utils/EntityVersionUtils';
import { VersionEntityTypes } from '../../utils/EntityVersionUtils.interface';
import {
  getTestCaseDetailPagePath,
  getTestCaseVersionPath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const TestCaseVersionPage = () => {
  const { t } = useTranslation();
  const { fqn: testCaseFQN } = useFqn();
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [testCasePermission, setTestCasePermission] =
    useState<OperationPermission>();
  const [testCase, setTestCase] = useState<TestCase>();
  const [currentVersionData, setCurrentVersionData] = useState<TestCase>(
    {} as TestCase
  );
  const [versionList, setVersionList] = useState<EntityHistory>({
    entityType: EntityType.TEST_CASE,
    versions: [],
  });
  const [isVersionDataLoading, setIsVersionDataLoading] =
    useState<boolean>(true);

  const { version } = useParams<{
    version: string;
  }>();

  const { hasViewPermission } = useMemo(() => {
    return {
      hasViewPermission:
        testCasePermission?.ViewAll || testCasePermission?.ViewBasic,
    };
  }, [testCasePermission]);

  const { tier, owners, breadcrumbLinks, changeDescription, deleted, domain } =
    useMemo(() => {
      return getBasicEntityInfoFromVersionData(
        currentVersionData as VersionEntityTypes,
        EntityType.TEST_CASE
      );
    }, [currentVersionData]);

  const { ownerDisplayName, ownerRef, tierDisplayName, domainDisplayName } =
    useMemo(
      () =>
        getCommonExtraInfoForVersionDetails(
          changeDescription as ChangeDescription,
          owners,
          tier,
          domain
        ),
      [changeDescription, owners, tier, domain]
    );

  const displayName = useMemo(() => {
    return getEntityVersionByField(
      changeDescription,
      EntityField.DISPLAYNAME,
      currentVersionData.displayName
    );
  }, [currentVersionData, changeDescription]);

  const fetchTestCasePermission = async () => {
    setIsPermissionLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.TEST_CASE,
        testCaseFQN
      );

      setTestCasePermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPermissionLoading(false);
    }
  };

  const fetchTestCaseData = async () => {
    setIsLoading(true);
    try {
      const response = await getTestCaseByFqn(testCaseFQN);

      const versionResponse = await getTestCaseVersionList(response.id ?? '');
      setTestCase(response);
      setVersionList(versionResponse);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', { entity: t('label.test-case') })
      );
    } finally {
      setIsLoading(false);
    }
  };
  const fetchCurrentVersion = async (id: string) => {
    setIsVersionDataLoading(true);
    try {
      const response = await getTestCaseVersionDetails(id, version);
      setCurrentVersionData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsVersionDataLoading(false);
    }
  };

  const backHandler = useCallback(() => {
    history.push(getTestCaseDetailPagePath(testCaseFQN));
  }, [testCaseFQN]);

  const versionHandler = useCallback(
    (newVersion = version) => {
      history.push(getTestCaseVersionPath(testCaseFQN, toString(newVersion)));
    },
    [testCaseFQN]
  );

  useEffect(() => {
    if (testCaseFQN) {
      fetchTestCasePermission();
    }
  }, [testCaseFQN]);

  useEffect(() => {
    if (hasViewPermission && testCaseFQN) {
      fetchTestCaseData();
    } else {
      setIsLoading(false);
    }
  }, [testCaseFQN, hasViewPermission]);

  useEffect(() => {
    if (testCase?.id) {
      fetchCurrentVersion(testCase.id);
    }
  }, [version, testCase?.id]);

  if (isLoading || isPermissionLoading) {
    return <Loader />;
  }

  if (!hasViewPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  if (isUndefined(testCase)) {
    return <ErrorPlaceHolder />;
  }

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-version-detail-plural', {
        entity: getEntityName(testCase),
      })}>
      {isVersionDataLoading ? (
        <Loader />
      ) : (
        <div className="version-data">
          <Row gutter={[0, 12]}>
            <Col span={24}>
              <TitleBreadcrumb
                className="m-b-sm"
                titleLinks={breadcrumbLinks}
              />
            </Col>
            <Col data-testid="entity-page-header" span={24}>
              <Row gutter={16}>
                <Col span={23}>
                  <EntityHeaderTitle
                    className="w-max-full-45"
                    displayName={displayName}
                    icon={<TestCaseIcon className="h-9" />}
                    name={currentVersionData?.name ?? ''}
                    serviceName="testCase"
                  />
                </Col>

                <Col className="d-flex justify-end" span={1}>
                  <ButtonGroup
                    className="data-asset-button-group spaced"
                    data-testid="asset-header-btn-group"
                    size="small">
                    <Tooltip title={t('label.version-plural-history')}>
                      <Button
                        className="version-button"
                        data-testid="version-button"
                        icon={<Icon component={VersionIcon} />}
                        onClick={backHandler}>
                        <Typography.Text>{version}</Typography.Text>
                      </Button>
                    </Tooltip>
                  </ButtonGroup>
                </Col>
              </Row>
            </Col>
          </Row>
        </div>
      )}

      <EntityVersionTimeLine
        currentVersion={toString(version)}
        entityType={EntityType.TEST_CASE}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </PageLayoutV1>
  );
};

export default TestCaseVersionPage;
