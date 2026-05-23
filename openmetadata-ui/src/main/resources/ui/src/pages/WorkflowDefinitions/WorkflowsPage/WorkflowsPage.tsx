/*
 *  Copyright 2024 Collate.
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
  Button,
  Input,
  SlideoutMenu,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as WorkflowIcon } from '../../../assets/svg/workflow.svg';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import PaginationComponent from '../../../components/PaginationComponent/PaginationComponent';
import WorkflowCard from '../../../components/WorkflowDefinitions/WorkflowCard/WorkflowCard.component';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { Paging } from '../../../generated/type/paging';
import {
  createWorkflowDefinition,
  getWorkflowDefinitions,
  WorkflowDefinitionsParams,
} from '../../../rest/workflowDefinitionsAPI';
import { SettingMenuItem } from '../../../utils/GlobalSettingsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import workflowClassBase from '../../../utils/WorkflowClassBase';
import { getWorkflowDefinitionDetailPath } from '../../../utils/WorkflowRouterUtils';
import {
  WORKFLOW_NAME_MAX_LENGTH,
  WORKFLOW_NAME_MIN_LENGTH,
  WORKFLOW_NAME_REGEX,
} from '../../../utils/WorkflowValidationUtils';
import { WorkflowDetailsTabs } from '../WorkflowDetails/workflow-details.interface';

const WorkflowsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState<SettingMenuItem[]>([]);
  const [paging, setPaging] = useState<Paging>({
    after: undefined,
    before: undefined,
    total: 0,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const pageCursorsRef = useRef<{ [key: number]: string }>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const allowCreateWorkflow = useMemo(
    () => workflowClassBase.getCapabilities().allowCreateWorkflow,
    []
  );

  const validateWorkflowName = useCallback(
    (value: string): string => {
      if (!value) {
        return t('label.workflow-name-is-required');
      }
      if (!WORKFLOW_NAME_REGEX.test(value)) {
        return t('message.workflow-name-invalid-characters');
      }
      if (value.length < WORKFLOW_NAME_MIN_LENGTH) {
        return t('message.workflow-name-min-length', {
          count: WORKFLOW_NAME_MIN_LENGTH,
        });
      }
      if (value.length > WORKFLOW_NAME_MAX_LENGTH) {
        return t('message.workflow-name-max-length', {
          count: WORKFLOW_NAME_MAX_LENGTH,
        });
      }

      return '';
    },
    [t]
  );

  const resetForm = useCallback(() => {
    setWorkflowName('');
    setDescription('');
    setNameError('');
  }, []);

  const onWorkflowClick = useCallback((key: string) => {
    navigate(
      getWorkflowDefinitionDetailPath(key, WorkflowDetailsTabs.WORKFLOW)
    );
  }, []);

  const handleNewWorkflowClick = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleModalCancel = useCallback(() => {
    setIsModalOpen(false);
    setIsSubmitting(false);
    resetForm();
  }, [resetForm]);

  const getWorkflows = useCallback(
    async (page?: number, cursor?: string) => {
      try {
        setLoading(true);

        const params: WorkflowDefinitionsParams = {
          limit: PAGE_SIZE_MEDIUM,
        };
        const pageCursor = cursor || pageCursorsRef.current[page || 1];

        if (pageCursor) {
          params.after = pageCursor;
        }

        const res = await getWorkflowDefinitions(params);

        const result = (res.data || []).map((workflow: WorkflowDefinition) => ({
          ...workflow,
          icon: WorkflowIcon,
          key: workflow.fullyQualifiedName || '',
          label: workflow.displayName ?? workflow.name,
        }));

        setWorkflows(result);
        setPaging(res.paging || { total: 0 });

        if (res.paging && res.paging.after) {
          const nextPage = page ? page + 1 : 2;
          pageCursorsRef.current[nextPage] = res.paging.after;
        }

        if (page) {
          setCurrentPage(page);
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoading(false);
      }
    },
    [PAGE_SIZE_MEDIUM]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      getWorkflows(page);
    },
    [getWorkflows]
  );

  useEffect(() => {
    getWorkflows();
  }, [getWorkflows]);

  const handleModalSubmit = useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    const error = validateWorkflowName(workflowName);
    if (error) {
      setNameError(error);

      return;
    }

    setIsSubmitting(true);
    try {
      const workflowData = {
        description: description || '',
        displayName: workflowName,
        edges: [],
        name: workflowName,
        nodes: [],
        trigger: {
          config: {},
          output: [],
          type: 'eventBasedEntity',
        },
      };

      await createWorkflowDefinition(workflowData);
      await getWorkflows(1);

      setIsModalOpen(false);
      resetForm();

      navigate(
        `${getWorkflowDefinitionDetailPath(
          workflowName,
          WorkflowDetailsTabs.WORKFLOW
        )}?mode=edit`
      );
    } catch (err) {
      showErrorToast(
        err as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.workflow'),
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    workflowName,
    description,
    validateWorkflowName,
    resetForm,
    navigate,
    t,
    getWorkflows,
  ]);

  if (loading) {
    return <Loader />;
  }

  if (!loading && workflows.length === 0) {
    return (
      <ErrorPlaceHolder
        className="m-y-md"
        type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
      />
    );
  }

  return (
    <PageLayoutV1
      className="workflow-page"
      pageContainerStyle={{ paddingLeft: 0, paddingRight: 0 }}
      pageTitle={t('label.workflow-plural')}>
      <div className="tw:flex tw:flex-col tw:overflow-hidden tw:mx-6 tw:my-4">
        <div className="tw:px-6 tw:py-4 tw:bg-primary tw:rounded-xl tw:border tw:border-border-secondary tw:mb-4">
          <div className="tw:flex tw:items-center tw:justify-between">
            <PageHeader
              data={{
                header: t('label.workflow-plural'),
                subHeader: t('message.workflow-subtitle'),
              }}
              learningPageId={LEARNING_PAGE_IDS.WORKFLOWS}
              title={t('label.workflow-plural')}
            />
            {allowCreateWorkflow && (
              <Button
                data-testid="create-workflow-button"
                iconLeading={Plus}
                size="sm"
                onPress={handleNewWorkflowClick}>
                {t('label.new-workflow')}
              </Button>
            )}
          </div>
        </div>

        <div className="tw:px-6 tw:py-4 tw:bg-primary tw:rounded-xl tw:border tw:border-border-secondary tw:flex tw:flex-col tw:flex-1 tw:justify-between">
          <div className="tw:mb-4">
            <div className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5">
              {workflows.map((workflow) => (
                <WorkflowCard
                  data={workflow}
                  key={workflow.key}
                  onClick={onWorkflowClick}
                />
              ))}
            </div>
          </div>
          {paging.total > PAGE_SIZE_MEDIUM && (
            <div
              className="tw:flex tw:justify-center tw:py-4"
              data-testid="workflows-pagination">
              <PaginationComponent
                current={currentPage}
                hideOnSinglePage={false}
                pageSize={PAGE_SIZE_MEDIUM}
                total={paging.total}
                onChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>

      <SlideoutMenu
        className="tw:z-9999"
        isOpen={allowCreateWorkflow && isModalOpen}
        width={640}
        onOpenChange={(open) => {
          if (!open) {
            handleModalCancel();
          }
        }}>
        {({ close }) => (
          <>
            <SlideoutMenu.Header onClose={close}>
              <Typography
                as="p"
                className="tw:m-0 tw:mb-1 tw:text-base tw:font-semibold tw:text-primary">
                {t('label.create-new-workflow')}
              </Typography>
              <Typography
                as="p"
                className="tw:m-0 tw:text-sm tw:text-secondary">
                {t('message.automate-your-tasks-by-creating-custom-workflows')}
              </Typography>
            </SlideoutMenu.Header>
            <SlideoutMenu.Content>
              <div className="tw:flex tw:flex-col tw:gap-5">
                <div>
                  <div className="tw:flex tw:items-center tw:gap-0.5 tw:m-0 tw:mb-1.5 tw:text-sm tw:font-medium tw:text-secondary">
                    <Typography as="span">
                      {t('label.workflow-name')}
                    </Typography>
                    <Typography as="span" className="tw:text-error-primary">
                      *
                    </Typography>
                  </div>
                  <Input
                    data-testid="workflow-name"
                    isDisabled={isSubmitting}
                    isInvalid={!!nameError}
                    placeholder={t('label.workflow-name-placeholder')}
                    value={workflowName}
                    onChange={(value) => {
                      setWorkflowName(value);
                      if (nameError) {
                        setNameError('');
                      }
                    }}
                  />
                  {nameError && (
                    <Typography
                      as="p"
                      className="tw:m-0 tw:mt-1 tw:text-error-primary"
                      size="text-xs">
                      {nameError}
                    </Typography>
                  )}
                </div>
                <div>
                  <Typography
                    as="p"
                    className="tw:m-0 tw:mb-1.5 tw:text-sm tw:font-medium tw:text-secondary">
                    {t('label.description')}
                  </Typography>
                  <TextArea
                    data-testid="workflow-description"
                    isDisabled={isSubmitting}
                    placeholder={t('label.description')}
                    rows={4}
                    value={description}
                    onChange={setDescription}
                  />
                </div>
              </div>
            </SlideoutMenu.Content>
            <SlideoutMenu.Footer className="tw:shadow-none tw:p-0">
              <div className="tw:flex tw:justify-end tw:gap-3 tw:px-4 tw:py-4 tw:border-t tw:border-border-secondary">
                <Button
                  color="secondary"
                  data-testid="cancel-workflow-button"
                  size="sm"
                  onPress={close}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="submit-workflow-button"
                  isDisabled={isSubmitting}
                  isLoading={isSubmitting}
                  size="sm"
                  onPress={handleModalSubmit}>
                  {t('label.save-and-next')}
                </Button>
              </div>
            </SlideoutMenu.Footer>
          </>
        )}
      </SlideoutMenu>
    </PageLayoutV1>
  );
};

export default WorkflowsPage;
