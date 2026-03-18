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
  Button,
  Select,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { Tag01 } from '@untitledui/icons';
import classNames from 'classnames';
import { groupBy, isArray, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import TagSelectForm from '../../../../components/Tag/TagsSelectForm/TagsSelectForm.component';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { GlossaryTermRelationType } from '../../../../generated/configuration/glossaryTermRelationSettings';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import {
  ChangeDescription,
  EntityReference,
} from '../../../../generated/entity/type';
import { TermRelation } from '../../../../generated/type/termRelation';
import { getGlossaryTermRelationSettings } from '../../../../rest/glossaryAPI';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../../utils/EntityUtils';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
} from '../../../../utils/EntityVersionUtils';
import { VersionStatus } from '../../../../utils/EntityVersionUtils.interface';
import { getGlossaryPath } from '../../../../utils/RouterUtils';
import { SelectOption } from '../../../common/AsyncSelectList/AsyncSelectList.interface';
import ExpandableCard from '../../../common/ExpandableCard/ExpandableCard';
import {
  EditIconButton,
  PlusIconButton,
} from '../../../common/IconButtons/EditIconButton';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
import { DEFAULT_GLOSSARY_TERM_RELATION_TYPES_FALLBACK } from '../../../OntologyExplorer/OntologyExplorer.constants';

interface RelatedTermOption {
  value?: string;
  data?: unknown;
  label?: string;
}

interface RelatedTermTagButtonProps {
  entity: EntityReference;
  relationType?: string;
  versionStatus?: VersionStatus;
  getRelationDisplayName: (relationType: string) => string;
  onRelatedTermClick: (fqn: string) => void;
}

const RelatedTermTagButton: React.FC<RelatedTermTagButtonProps> = ({
  entity,
  relationType,
  versionStatus,
  getRelationDisplayName,
  onRelatedTermClick,
}) => {
  const tooltipContent = (
    <div className="tw:p-2 tw:space-y-1">
      <Typography as="span" className="tw:block tw:font-semibold">
        {entity.fullyQualifiedName}
      </Typography>
      {relationType && (
        <Typography as="span" className="tw:block tw:text-xs tw:text-gray-500">
          {getRelationDisplayName(relationType)}
        </Typography>
      )}
      {entity.description && (
        <Typography as="span" className="tw:block tw:text-xs tw:text-gray-600">
          {entity.description}
        </Typography>
      )}
    </div>
  );

  return (
    <Tooltip placement="bottom left" title={tooltipContent}>
      <TooltipTrigger>
        <Button
          className={classNames(
            'tw:inline-flex tw:text-xs tw:whitespace-nowrap tw:cursor-pointer',
            { 'diff-added': versionStatus?.added },
            { 'diff-removed tw:text-gray-500': versionStatus?.removed }
          )}
          color="secondary"
          data-testid={getEntityName(entity)}
          iconLeading={<Tag01 className="tw:size-3" />}
          size="sm"
          onClick={() => onRelatedTermClick(entity.fullyQualifiedName ?? '')}>
          <Typography as="span" className="tw:text-xs tw:font-semibold">
            {getEntityName(entity)}
          </Typography>
        </Button>
      </TooltipTrigger>
    </Tooltip>
  );
};

const RelatedTerms = () => {
  const navigate = useNavigate();
  const {
    data: glossaryTerm,
    onUpdate,
    isVersionView,
    permissions,
  } = useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [selectedRelationType, setSelectedRelationType] =
    useState<string>('relatedTo');
  const [relationTypes, setRelationTypes] = useState<
    GlossaryTermRelationType[]
  >([]);

  const termRelations = useMemo(() => {
    return glossaryTerm?.relatedTerms ?? [];
  }, [glossaryTerm?.relatedTerms]);

  const groupedRelations = useMemo(() => {
    return groupBy(termRelations, 'relationType');
  }, [termRelations]);

  const fetchRelationTypes = useCallback(async () => {
    try {
      const settings = await getGlossaryTermRelationSettings();
      if (settings?.relationTypes) {
        setRelationTypes(settings.relationTypes);
      }
    } catch {
      setRelationTypes(DEFAULT_GLOSSARY_TERM_RELATION_TYPES_FALLBACK);
    }
  }, []);

  useEffect(() => {
    fetchRelationTypes();
  }, [fetchRelationTypes]);

  const relationTypeOptions = useMemo(
    () =>
      relationTypes.map((rt) => ({
        id: rt.name,
        label: rt.displayName,
        title: rt.description,
      })),
    [relationTypes]
  );

  const currentRelationTypeTerms = useMemo(() => {
    const existing = termRelations.filter(
      (tr) => tr.relationType === selectedRelationType
    );

    return existing
      .filter((tr) => tr.term)
      .map((tr) => ({
        ...tr.term,
        value: tr.term?.id,
        label: getEntityName(tr.term as EntityReference),
        key: tr.term?.id,
      }));
  }, [termRelations, selectedRelationType]);

  const initialOptions = useMemo(() => {
    return (
      currentRelationTypeTerms.map((item) => ({
        label: getEntityName(item as EntityReference),
        value: item.fullyQualifiedName,
        data: item,
      })) ?? []
    );
  }, [currentRelationTypeTerms]);

  const handleRelatedTermClick = (fqn: string) => {
    navigate(getGlossaryPath(fqn));
  };

  const handleRelatedTermsSave = async (
    selectedData: RelatedTermOption | RelatedTermOption[]
  ): Promise<void> => {
    if (!isArray(selectedData)) {
      return;
    }

    const newTermsForRelationType: TermRelation[] = selectedData.map(
      (value) => {
        const termRef = isUndefined(value.data)
          ? termRelations.find(
              (tr: TermRelation) => tr.term?.fullyQualifiedName === value.value
            )?.term
          : getEntityReferenceFromEntity(
              value.data as EntityReference,
              EntityType.GLOSSARY_TERM
            );

        return {
          relationType: selectedRelationType,
          term: termRef as EntityReference,
        };
      }
    );

    const otherRelations = termRelations.filter(
      (tr) => tr.relationType !== selectedRelationType
    );

    const updatedGlossaryTerm = {
      ...glossaryTerm,
      relatedTerms: [...otherRelations, ...newTermsForRelationType],
    };

    await onUpdate(updatedGlossaryTerm);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleStartEditing = () => {
    setSelectedRelationType('relatedTo');
    setIsEditing(true);
  };

  const getRelationDisplayName = useCallback(
    (relationType: string) => {
      const rt = relationTypes.find((r) => r.name === relationType);

      return rt?.displayName ?? relationType;
    },
    [relationTypes]
  );

  const getRelatedTermElement = useCallback(
    (
      entity: EntityReference,
      relationType?: string,
      versionStatus?: VersionStatus
    ) => (
      <RelatedTermTagButton
        entity={entity}
        getRelationDisplayName={getRelationDisplayName}
        key={`${entity.fullyQualifiedName}-${relationType}`}
        relationType={relationType}
        versionStatus={versionStatus}
        onRelatedTermClick={handleRelatedTermClick}
      />
    ),
    [getRelationDisplayName]
  );

  const getVersionRelatedTerms = useCallback(() => {
    const changeDescription = glossaryTerm.changeDescription;
    const relatedTermsDiff = getDiffByFieldName(
      EntityField.RELATEDTERMS,
      changeDescription as ChangeDescription
    );

    const addedRelatedTerms: TermRelation[] = JSON.parse(
      getChangedEntityNewValue(relatedTermsDiff) ?? '[]'
    );
    const deletedRelatedTerms: TermRelation[] = JSON.parse(
      getChangedEntityOldValue(relatedTermsDiff) ?? '[]'
    );

    const unchangedRelatedTerms = glossaryTerm.relatedTerms
      ? glossaryTerm.relatedTerms.filter(
          (relatedTerm: TermRelation) =>
            !addedRelatedTerms.some(
              (addedRelatedTerm: TermRelation) =>
                addedRelatedTerm.term?.id === relatedTerm.term?.id
            )
        )
      : [];

    const noRelations =
      isEmpty(unchangedRelatedTerms) &&
      isEmpty(addedRelatedTerms) &&
      isEmpty(deletedRelatedTerms);

    if (noRelations) {
      return <div>{NO_DATA_PLACEHOLDER}</div>;
    }

    return (
      <div className="d-flex flex-wrap">
        {unchangedRelatedTerms.map((relatedTerm: TermRelation) =>
          relatedTerm.term
            ? getRelatedTermElement(relatedTerm.term, relatedTerm.relationType)
            : null
        )}
        {addedRelatedTerms.map((relatedTerm: TermRelation) =>
          relatedTerm.term
            ? getRelatedTermElement(
                relatedTerm.term,
                relatedTerm.relationType,
                {
                  added: true,
                }
              )
            : null
        )}
        {deletedRelatedTerms.map((relatedTerm: TermRelation) =>
          relatedTerm.term
            ? getRelatedTermElement(
                relatedTerm.term,
                relatedTerm.relationType,
                {
                  removed: true,
                }
              )
            : null
        )}
      </div>
    );
  }, [glossaryTerm, getRelatedTermElement]);

  const relatedTermsContainer = useMemo(() => {
    if (isVersionView) {
      return getVersionRelatedTerms();
    }
    if (!permissions.EditAll || !isEmpty(termRelations)) {
      return (
        <div className="d-flex flex-col gap-3">
          {Object.entries(groupedRelations).map(([relationType, relations]) => (
            <div className="d-flex flex-col gap-1" key={relationType}>
              <Typography
                as="span"
                className="text-xs font-medium text-grey-muted">
                {getRelationDisplayName(relationType)}
              </Typography>
              <div className="d-flex flex-wrap gap-1">
                {(relations as TermRelation[]).map((tr: TermRelation) =>
                  tr.term
                    ? getRelatedTermElement(tr.term, tr.relationType)
                    : null
                )}
              </div>
            </div>
          ))}
          {!permissions.EditAll && termRelations.length === 0 && (
            <div>{NO_DATA_PLACEHOLDER}</div>
          )}
        </div>
      );
    }

    return null;
  }, [
    permissions,
    termRelations,
    groupedRelations,
    isVersionView,
    getVersionRelatedTerms,
    getRelatedTermElement,
    getRelationDisplayName,
  ]);

  const header = (
    <div className="d-flex items-center gap-2">
      <Typography as="span" className="text-sm font-medium">
        {t('label.related-term-plural')}
      </Typography>
      {permissions.EditAll &&
        (isEmpty(termRelations) ? (
          <PlusIconButton
            data-testid="related-term-add-button"
            size="small"
            title={t('label.add-entity', {
              entity: t('label.related-term-plural'),
            })}
            onClick={handleStartEditing}
          />
        ) : (
          <EditIconButton
            newLook
            data-testid="edit-button"
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.related-term-plural'),
            })}
            onClick={handleStartEditing}
          />
        ))}
    </div>
  );

  const editingContent = (
    <div className="d-flex flex-col gap-3">
      <div className="tw:flex tw:flex-col tw:gap-2">
        <Typography as="span" className="text-xs text-grey-muted">
          {t('label.relation-type')}
        </Typography>
        <Select
          className="w-full"
          data-testid="relation-type-select"
          items={relationTypeOptions}
          placeholder={t('label.select-field', {
            field: t('label.relation-type'),
          })}
          size="sm"
          value={selectedRelationType}
          onChange={(key) =>
            setSelectedRelationType(String(key ?? 'relatedTo'))
          }>
          {(item) => (
            <Select.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Select>
      </div>
      <div className="tw:flex tw:flex-col tw:gap-2">
        <Typography as="span" className="text-xs text-grey-muted">
          {t('label.term-plural')}
        </Typography>
        <TagSelectForm
          defaultValue={currentRelationTypeTerms.map(
            (item) => item.fullyQualifiedName ?? ''
          )}
          filterOptions={[glossaryTerm?.fullyQualifiedName ?? '']}
          placeholder={t('label.add-entity', {
            entity: t('label.related-term-plural'),
          })}
          tagData={initialOptions as SelectOption[]}
          onCancel={handleCancel}
          onSubmit={
            handleRelatedTermsSave as (option: unknown) => Promise<void>
          }
        />
      </div>
    </div>
  );

  return (
    <ExpandableCard
      cardProps={{
        title: header,
      }}
      dataTestId="related-term-container"
      isExpandDisabled={termRelations.length === 0 && !isEditing}>
      {isEditing ? editingContent : relatedTermsContainer}
    </ExpandableCard>
  );
};

export default RelatedTerms;
