/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isNull, isUndefined } from 'lodash';
import { Database, Paging, ServiceOption } from 'Models';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDatabases } from '../../axiosAPIs/databaseAPI';
import { getServiceByFQN, updateService } from '../../axiosAPIs/serviceAPI';
import { getTopics } from '../../axiosAPIs/topicsAPI';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import PopOver from '../../components/common/popover/PopOver';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import { ModalWithMarkdownEditor } from '../../components/Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import Tags from '../../components/tags/tags';
import { pagingObject } from '../../constants/constants';
import { ServiceCategory } from '../../enums/service.enum';
import { Topic } from '../../generated/entity/data/topic';
import useToastContext from '../../hooks/useToastContext';
import { isEven } from '../../utils/CommonUtils';
import {
  getFrequencyTime,
  getServiceCategoryFromType,
  serviceTypeLogo,
} from '../../utils/ServiceUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getUsagePercentile } from '../../utils/TableUtils';

const ServicePage: FunctionComponent = () => {
  const { serviceFQN, serviceType } = useParams() as Record<string, string>;
  const [serviceName, setServiceName] = useState(
    getServiceCategoryFromType(serviceType)
  );
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [serviceDetails, setServiceDetails] = useState<ServiceOption>();
  const [data, setData] = useState<Array<Database>>([]);
  const [isLoading, setIsloading] = useState(true);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const showToast = useToastContext();

  const fetchDatabases = (paging?: string) => {
    setIsloading(true);
    getDatabases(serviceFQN, paging, ['owner', 'usageSummary', 'service'])
      .then((res: AxiosResponse) => {
        if (res.data.data) {
          setData(res.data.data);
          setPaging(res.data.paging);
          setIsloading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsloading(false);
        }
      })
      .catch(() => {
        setIsloading(false);
      });
  };

  const fetchTopics = (paging?: string) => {
    setIsloading(true);
    getTopics(serviceFQN, paging, ['owner', 'service', 'tags'])
      .then((res: AxiosResponse) => {
        if (res.data.data) {
          setData(res.data.data);
          setPaging(res.data.paging);
          setIsloading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsloading(false);
        }
      })
      .catch(() => {
        setIsloading(false);
      });
  };

  const getOtherDetails = (paging?: string) => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        fetchDatabases(paging);

        break;
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        fetchTopics(paging);

        break;
      }
      default:
        break;
    }
  };

  const getOptionalFields = (): JSX.Element => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        return (
          <span>
            <span className="tw-text-grey-muted tw-font-normal">
              Driver Class :
            </span>{' '}
            <span className="tw-pl-1tw-font-normal ">
              {serviceDetails?.jdbc?.driverClass || '--'}
            </span>
            <span className="tw-mx-3 tw-inline-block tw-text-gray-400">•</span>
          </span>
        );
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        return (
          <span>
            <span className="tw-text-grey-muted tw-font-normal">Brokers :</span>{' '}
            <span className="tw-pl-1tw-font-normal ">
              {serviceDetails?.brokers?.length ? (
                <>
                  {serviceDetails.brokers.slice(0, 3).join(', ')}
                  {serviceDetails.brokers.length > 3 ? (
                    <PopOver
                      html={
                        <div className="tw-text-left">
                          {serviceDetails.brokers
                            .slice(3)
                            .map((broker, index) => (
                              <Fragment key={index}>
                                <span className="tw-block tw-py-1">
                                  {broker}
                                </span>
                              </Fragment>
                            ))}
                        </div>
                      }
                      position="bottom"
                      theme="light"
                      trigger="click">
                      <span className="show-more tw-ml-1">...</span>
                    </PopOver>
                  ) : null}
                </>
              ) : (
                '--'
              )}
            </span>
            <span className="tw-mx-3 tw-inline-block tw-text-gray-400">•</span>
          </span>
        );
      }
      default: {
        return <></>;
      }
    }
  };

  const getTableHeaders = (): JSX.Element => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        return (
          <>
            <th className="tableHead-cell">Database Name</th>
            <th className="tableHead-cell">Description</th>
            <th className="tableHead-cell">Owner</th>
            <th className="tableHead-cell">Usage</th>
          </>
        );
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        return (
          <>
            <th className="tableHead-cell">Topic Name</th>
            <th className="tableHead-cell">Description</th>
            <th className="tableHead-cell">Owner</th>
            <th className="tableHead-cell">Tags</th>
          </>
        );
      }
      default:
        return <></>;
    }
  };

  const getOptionalTableCells = (data: Database | Topic) => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        const database = data as Database;

        return (
          <td className="tableBody-cell">
            <p>
              {getUsagePercentile(
                database.usageSummary.weeklyStats.percentileRank
              )}
            </p>
          </td>
        );
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        const topic = data as Topic;

        return (
          <td className="tableBody-cell">
            {topic.tags && topic.tags?.length > 0
              ? topic.tags.map((tag, tagIndex) => (
                  <PopOver
                    key={tagIndex}
                    position="top"
                    size="small"
                    title={tag.labelType}
                    trigger="mouseenter">
                    <Tags
                      className="tw-bg-gray-200"
                      tag={`#${
                        tag.tagFQN?.startsWith('Tier.Tier')
                          ? tag.tagFQN.split('.')[1]
                          : tag.tagFQN
                      }`}
                    />
                  </PopOver>
                ))
              : '--'}
          </td>
        );
      }
      default:
        return <></>;
    }
  };

  useEffect(() => {
    setServiceName(getServiceCategoryFromType(serviceType));
  }, [serviceType]);

  useEffect(() => {
    getServiceByFQN(serviceName, serviceFQN).then(
      (resService: AxiosResponse) => {
        const { description, serviceType } = resService.data;
        setServiceDetails(resService.data);
        setDescription(description);
        setSlashedTableName([
          {
            name: serviceFQN,
            url: '',
            imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
            activeTitle: true,
          },
        ]);
        getOtherDetails();
      }
    );
  }, [serviceFQN, serviceName]);

  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (description !== updatedHTML && !isUndefined(serviceDetails)) {
      const { id } = serviceDetails;

      const updatedServiceDetails = {
        ...serviceDetails,
        description: updatedHTML,
      };

      updateService(serviceName, id, updatedServiceDetails)
        .then(() => {
          setDescription(updatedHTML);
          setServiceDetails(updatedServiceDetails);
          setIsEdit(false);
        })
        .catch((err: AxiosError) => {
          const errMsg = err.message || 'Something went wrong!';
          showToast({
            variant: 'error',
            body: errMsg,
          });
        });
    }
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };

  const pagingHandler = (cursorType: string) => {
    const pagingString = `&${cursorType}=${
      paging[cursorType as keyof typeof paging]
    }`;
    getOtherDetails(pagingString);
  };

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <PageContainer>
          <div className="tw-px-4">
            <TitleBreadcrumb titleLinks={slashedTableName} />

            <div className="tw-flex tw-gap-1 tw-mb-2 tw-mt-1">
              {getOptionalFields()}
              <span>
                <span className="tw-text-grey-muted tw-font-normal">
                  Ingestion :
                </span>{' '}
                <span className="tw-pl-1 tw-font-normal">
                  {' '}
                  {serviceDetails?.ingestionSchedule
                    ? getFrequencyTime(
                        serviceDetails.ingestionSchedule.repeatFrequency
                      )
                    : '--'}
                </span>
                <span className="tw-mx-3 tw-inline-block tw-text-gray-400">
                  •
                </span>
              </span>
              <span>
                <span className="tw-text-grey-muted tw-font-normal">
                  Service Type :
                </span>{' '}
                <span className="tw-pl-1 tw-font-normal">
                  {serviceDetails?.serviceType}
                </span>
              </span>
            </div>

            <div className="tw-bg-white tw-my-4">
              <div className="tw-col-span-3">
                <div className="schema-description tw-flex tw-flex-col tw-h-full tw-relative tw-border tw-border-main tw-rounded-md">
                  <div className="tw-flex tw-items-center tw-px-3 tw-py-1 tw-border-b tw-border-main">
                    <span className="tw-flex-1 tw-leading-8 tw-m-0 tw-text-sm tw-font-normal">
                      Description
                    </span>
                    <div className="tw-flex-initial">
                      <button
                        className="focus:tw-outline-none"
                        onClick={onDescriptionEdit}>
                        <SVGIcons
                          alt="edit"
                          icon="icon-edit"
                          title="Edit"
                          width="12px"
                        />
                      </button>
                    </div>
                  </div>
                  <div className="tw-px-3 tw-pl-5 tw-py-2 tw-overflow-y-auto">
                    <div data-testid="description" id="description" />
                    {description ? (
                      <RichTextEditorPreviewer markdown={description} />
                    ) : (
                      <span className="tw-no-description">
                        No description added
                      </span>
                    )}
                    {isEdit && (
                      <ModalWithMarkdownEditor
                        header={`Edit description for ${serviceFQN}`}
                        placeholder="Enter Description"
                        value={description}
                        onCancel={onCancel}
                        onSave={onDescriptionUpdate}
                        // onSuggest={onSuggest}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="tw-mt-4">
              <table
                className="tw-bg-white tw-w-full tw-mb-4"
                data-testid="database-tables">
                <thead>
                  <tr className="tableHead-row">{getTableHeaders()}</tr>
                </thead>
                <tbody className="tableBody">
                  {data.length > 0 ? (
                    data.map((database, index) => (
                      <tr
                        className={classNames(
                          'tableBody-row',
                          !isEven(index + 1) ? 'odd-row' : null
                        )}
                        data-testid="column"
                        key={index}>
                        <td className="tableBody-cell">
                          <Link to={`/database/${database.fullyQualifiedName}`}>
                            {database.name}
                          </Link>
                        </td>
                        <td className="tableBody-cell">
                          {database.description ? (
                            <RichTextEditorPreviewer
                              markdown={database.description}
                            />
                          ) : (
                            <span className="tw-no-description">
                              No description added
                            </span>
                          )}
                        </td>
                        <td className="tableBody-cell">
                          <p>{database?.owner?.name || '--'}</p>
                        </td>
                        {getOptionalTableCells(database)}
                      </tr>
                    ))
                  ) : (
                    <tr className="tableBody-row">
                      <td className="tableBody-cell tw-text-center" colSpan={4}>
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {Boolean(!isNull(paging.after) || !isNull(paging.before)) && (
              <NextPrevious paging={paging} pagingHandler={pagingHandler} />
            )}
          </div>
        </PageContainer>
      )}
    </>
  );
};

export default ServicePage;
