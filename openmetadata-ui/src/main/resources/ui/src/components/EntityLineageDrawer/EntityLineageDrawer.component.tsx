import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { debounce, isEmpty } from 'lodash';
import { FormatedTableData } from 'Models';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { addLineage, searchData } from '../../axiosAPIs/miscAPI';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { formatDataResponse } from '../../utils/APIUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { stringToHTML } from '../../utils/StringsUtils';
import { Button } from '../buttons/Button/Button';
import {
  Edge,
  LineageDrawerProps,
} from '../EntityLineage/EntityLineage.interface';
import Loader from '../Loader/Loader';

type ValidationType = {
  edgeType: boolean;
  entityType: boolean;
};

const getEntityName = (name = '') => {
  const nameArr = name.split('.');

  return nameArr[nameArr.length - 1];
};

const nodeTypeArr = [
  { name: 'upstream', value: 'upstream' },
  { name: 'downstream', value: 'downstream' },
];

const entityTypeArr = [
  {
    name: 'Table',
    value: 'table',
  },
  {
    name: 'Pipeline',
    value: 'pipeline',
  },
  {
    name: 'Dashboard',
    value: 'dashboard',
  },
];

const getEntityCard = (
  _entityType: string,
  data: FormatedTableData,
  selectedEntity: string,
  entitySelectHandler: (v: string) => void,
  suggestionHandler: (v: boolean) => void
) => {
  return (
    <div
      className={classNames('tw-p-1')}
      onClick={() => {
        entitySelectHandler(data.id);
        suggestionHandler(false);
      }}>
      <div className="tw-flex">
        <img
          alt=""
          className="tw-inline tw-h-5 tw-w-5"
          src={serviceTypeLogo(data.serviceType || '')}
        />
        <h6
          className={classNames(
            'tw-flex tw-items-center tw-m-0 tw-heading tw-pl-2'
          )}>
          <button
            className={classNames('tw-font-medium', {
              'tw-text-primary': data.id === selectedEntity,
              'tw-text-grey-body': data.id !== selectedEntity,
            })}
            data-testid="table-link">
            {stringToHTML(data.name)}
          </button>
        </h6>
      </div>
    </div>
  );
};

const errorMsg = (value: string) => {
  return (
    <div className="tw-mt-1">
      <strong className="tw-text-red-500 tw-text-xs tw-italic">{value}</strong>
    </div>
  );
};

const EntityLineageDrawer = ({
  show,
  onCancel,
  selectedNode,
  editModeHandler,
}: LineageDrawerProps) => {
  const [edgeType, setEdgeType] = useState<string>('');
  const [entityType, setEntityType] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [isLoading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<Array<FormatedTableData>>([]);
  const [selectedEntity, setSelectedEntity] = useState<FormatedTableData>(
    {} as FormatedTableData
  );
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [showErrorMsg, setShowErrorMsg] = useState<ValidationType>({
    entityType: false,
    edgeType: false,
  });

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const name = event.target.name;

    switch (name) {
      case 'edgeType':
        setEdgeType(value);

        break;
      case 'entityType':
        setEntityType(value);

        break;

      default:
        break;
    }
    setShowErrorMsg({
      ...showErrorMsg,
      [name]: !value,
    });
  };

  const getEntityData = (text: string, type: string) => {
    let index = '';
    switch (type) {
      case EntityType.TABLE:
        index = SearchIndex.TABLE;

        break;

      case EntityType.DASHBOARD:
        index = SearchIndex.DASHBOARD;

        break;

      case EntityType.PIPELINE:
        index = SearchIndex.PIPELINE;

        break;

      default:
        index = '';

        break;
    }
    setLoading(true);
    searchData(text, 1, 10, '', '', '', index)
      .then((res: AxiosResponse) => {
        const {
          hits: { hits },
        } = res.data;
        setData(formatDataResponse(hits));
      })
      .catch((err: AxiosError) => {
        // eslint-disable-next-line
        console.log(err);
      })
      .finally(() => setLoading(false));
  };

  const entitySelectHandler = (id: string) => {
    const entity = data.find((d) => d.id === id);
    setSelectedEntity(entity ?? ({} as FormatedTableData));
  };
  const suggestionHandler = (v: boolean) => {
    setShowSuggestions(v);
  };

  const fetchEntities = useCallback((text, type): void => {
    if (text && type) {
      getEntityData(text, type);
    } else {
      setShowSuggestions(false);
    }
  }, []);

  const debouncedOnSearch = useCallback(
    (text: string): void => {
      fetchEntities(text, entityType);
    },
    [fetchEntities, entityType]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnSearch, 1000), [
    debouncedOnSearch,
  ]);

  const addLineageEdge = () => {
    if (!entityType || !edgeType) {
      setShowErrorMsg({
        ...showErrorMsg,
        entityType: !entityType,
        edgeType: !edgeType,
      });
    } else {
      let data: Edge;
      switch (edgeType) {
        case 'upstream':
          data = {
            edge: {
              fromEntity: {
                id: selectedEntity.id,
                type: selectedEntity.entityType as string,
              },
              toEntity: {
                id: selectedNode.entityId,
                type: selectedNode.type,
              },
            },
          };

          break;

        case 'downstream':
          data = {
            edge: {
              toEntity: {
                id: selectedEntity.id,
                type: selectedEntity.entityType as string,
              },
              fromEntity: {
                id: selectedNode.entityId,
                type: selectedNode.type,
              },
            },
          };

          break;

        default:
          data = {} as Edge;

          break;
      }
      addLineage(data)
        .then(() => {
          onCancel(false);
          setEntityType('');
          setEdgeType('');
        })
        .catch((err: AxiosError) => {
          // eslint-disable-next-line
          console.log(err);
        })
        .finally(() => {
          editModeHandler(false);
          setSelectedEntity({} as FormatedTableData);
        });
    }
  };

  useEffect(() => {
    setShowSuggestions(data.length > 0);
  }, [data]);

  return (
    <div className={classNames('side-drawer', { open: show })}>
      <header className="tw-flex tw-justify-between">
        <p className="tw-flex">
          <span>{`Add lineage to "${getEntityName(selectedNode.name)}"`}</span>
        </p>
        <div className="tw-flex">
          <svg
            className="tw-w-5 tw-h-5 tw-ml-1 tw-cursor-pointer"
            data-testid="closeDrawer"
            fill="none"
            stroke="#6B7280"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            onClick={() => {
              onCancel(false);
              setEntityType('');
              setEdgeType('');
            }}>
            <path
              d="M6 18L18 6M6 6l12 12"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </div>
      </header>
      <hr className="tw-mt-3 tw-border-primary-hover-lite" />
      <div className="tw-mt-3">
        <select
          className={classNames('tw-form-inputs tw-px-3 tw-py-1')}
          data-testid="select-node-type"
          id="selectNode"
          name="edgeType"
          value={edgeType}
          onChange={handleValidation}>
          <option value="">Select Edge Type</option>
          {nodeTypeArr.map((node, index) => (
            <option key={index} value={node.value}>
              {node.name}
            </option>
          ))}
        </select>
        {showErrorMsg.edgeType && errorMsg('EntityType is required')}
      </div>
      <div className="tw-mt-3">
        <select
          className={classNames('tw-form-inputs tw-px-3 tw-py-1')}
          data-testid="select-entity-type"
          id="selectEntity"
          name="entityType"
          value={entityType}
          onChange={handleValidation}>
          <option value="">Select Entity Type</option>
          {entityTypeArr.map((entity, index) => (
            <option key={index} value={entity.value}>
              {entity.name}
            </option>
          ))}
        </select>
        {showErrorMsg.entityType && errorMsg('EntityType is required')}
      </div>
      {entityType && (
        <div className="tw-mt-3 tw-relative">
          <input
            className={classNames('tw-form-inputs tw-px-3 tw-py-1')}
            data-testid="select-entity-type"
            id="search"
            name="search"
            placeholder="Search Table, Dashboard and Topics..."
            type="search"
            value={searchText}
            onChange={(e) => {
              const sText = e.target.value;
              setSearchText(sText);
              debounceOnSearch(sText);
            }}
          />
          {data.length > 0 && showSuggestions ? (
            <div
              aria-labelledby="menu-button"
              aria-orientation="vertical"
              className="tw-origin-top-right tw-absolute tw-z-20
             tw-w-full tw-my-1 tw-rounded-md tw-shadow-lg
           tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none tw-p-2"
              role="menu">
              {isLoading ? (
                <Loader />
              ) : (
                <Fragment>
                  {data.length > 0 ? (
                    <Fragment>
                      <div className="tw-flex tw-flex-col tw-gap-y-2">
                        {data
                          .filter((d) => d.id !== selectedNode.entityId)
                          .slice(0, 5)
                          .map((d, i) => (
                            <Fragment key={i}>
                              {getEntityCard(
                                entityType,
                                d,
                                selectedEntity.id,
                                entitySelectHandler,
                                suggestionHandler
                              )}
                            </Fragment>
                          ))}
                      </div>
                    </Fragment>
                  ) : null}
                </Fragment>
              )}
            </div>
          ) : null}
        </div>
      )}

      {!isEmpty(selectedEntity) ? (
        <Fragment>
          <div className="tw-mt-3">
            <div className="tw-bg-white tw-p-2">
              <div className="tw-flex">
                <img
                  alt=""
                  className="tw-inline tw-h-5 tw-w-5"
                  src={serviceTypeLogo(selectedEntity.serviceType || '')}
                />
                <h6
                  className={classNames(
                    'tw-flex tw-items-center tw-m-0 tw-heading tw-pl-2'
                  )}>
                  <button
                    className={classNames('tw-font-medium tw-text-grey-body')}
                    data-testid="table-link">
                    {stringToHTML(selectedEntity.name)}
                  </button>
                </h6>
              </div>
            </div>
          </div>

          <div className="tw-mt-3">
            <Button theme="primary" onClick={() => addLineageEdge()}>
              Save
            </Button>
          </div>
        </Fragment>
      ) : null}
    </div>
  );
};

export default EntityLineageDrawer;
