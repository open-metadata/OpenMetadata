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
import {
  Alert,
  Badge,
  Box,
  Button,
  ButtonUtility,
  Checkbox,
  FieldTypes,
  FormSelectItem,
  getField,
  HookForm,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useOntologyChangeSetApply } from '../../../../hooks/governance/ontology/useOntologyChangeSetApply';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getOntologyState } from '../../../../rest/ontologyAPI';
import { isAbsoluteOntologyIri } from '../../../../utils/governance/ontology/OntologyAuthoring.utils';
import {
  buildNewClassChangeSet,
  NewClassDraft,
  OwnPropertyDraft,
} from '../../../../utils/governance/ontology/OntologyNativeChangeSet.utils';
import {
  OntologyStudioModel,
  StudioDatatype,
  STUDIO_DATATYPES,
} from '../../../../utils/governance/ontology/OntologyStudioModel.utils';
import { EntityReferenceOption } from '../../../Glossary/AddGlossary/AddGlossary.interface';
import {
  toEntityReferenceOption,
  toEntityReferences,
} from '../../../Glossary/AddGlossary/AddGlossary.utils';
import { useUserTeamOptions } from '../../../Glossary/hooks/useEntityReferenceOptions';
import {
  classLocalName,
  distinctChipValues,
  inheritedClassProperties,
  isValidClassIdentity,
  isValidLocalName,
  isValidOwnProperty,
  ownPropertyDraft,
  ownPropertyTypeLabel,
} from './OntologyNewClassPanel.utils';
interface SelectionValues {
  parents: FormSelectItem[];
  equivalent: FormSelectItem[];
  disjoint: FormSelectItem[];
  owners: EntityReferenceOption[];
}
interface Props {
  ontology: Ontology;
  model: OntologyStudioModel;
  canCreate: boolean;
  canCreateProperty: boolean;
  canCreateAxiom: boolean;
  onBeforeCreate: () => void;
  onCreated: (iri: string) => Promise<boolean>;
  onClose: () => void;
  onLockChange?: (locked: boolean) => void;
}
const OntologyNewClassPanel = ({
  ontology,
  model,
  canCreate,
  canCreateProperty,
  canCreateAxiom,
  onBeforeCreate,
  onCreated,
  onClose,
  onLockChange,
}: Props) => {
  const { t } = useTranslation();
  const currentUser = useApplicationStore((state) => state.currentUser);
  const ownerPicker = useUserTeamOptions();
  const form = useForm<SelectionValues>({
    defaultValues: {
      parents: [],
      equivalent: [],
      disjoint: [],
      owners: currentUser
        ? [
            {
              ...toEntityReferenceOption({ ...currentUser, type: 'user' }),
              label:
                (currentUser.displayName ?? currentUser.name) +
                ' (' +
                t('label.you') +
                ')',
            },
          ]
        : [],
    },
  });
  const selections = form.watch();
  const [label, setLabel] = useState('');
  const [manualName, setManualName] = useState<string>();
  const localName = manualName ?? classLocalName(label);
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [abstract, setAbstract] = useState(false);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [synonym, setSynonym] = useState('');
  const [properties, setProperties] = useState<OwnPropertyDraft[]>([]);
  const [propertyName, setPropertyName] = useState('');
  const [datatype, setDatatype] = useState<StudioDatatype | 'object'>('string');
  const [range, setRange] = useState('');
  const [identifier, setIdentifier] = useState(false);
  const [enumInput, setEnumInput] = useState('');
  const [enumValues, setEnumValues] = useState<string[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState(false);
  const attemptIri = useRef('');
  const submitting = useRef(false);
  const selectedIris = (items: FormSelectItem[]) =>
    items.map((item) => String(item.id));
  const needsAxioms = Boolean(
    selections.parents.length +
      selections.equivalent.length +
      selections.disjoint.length
  );
  const permitted = [
    canCreate,
    properties.length === 0 || canCreateProperty,
    !needsAxioms || canCreateAxiom,
  ].every(Boolean);
  const reconcile = async () => {
    setReconciling(true);
    setError(false);
    try {
      if (!(await onCreated(attemptIri.current))) {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setReconciling(false);
    }
  };
  const apply = useOntologyChangeSetApply({
    canApply: permitted,
    onApplied: () => {
      void reconcile();
    },
  });
  const locked =
    preparing || apply.configurationLocked || apply.status.kind === 'applied';
  useEffect(() => {
    onLockChange?.(locked);

    return () => onLockChange?.(false);
  }, [locked, onLockChange]);
  const removeProperty = (property: OwnPropertyDraft) =>
    setProperties((previous) => previous.filter((p) => p !== property));
  const valid = isValidClassIdentity(model, label, localName, source);
  const propertyInput = {
    name: propertyName,
    datatype,
    range,
    isIdentifier: identifier,
    values: enumValues,
  };
  const rowValid = isValidOwnProperty(
    model,
    properties,
    localName,
    propertyInput
  );
  const addProperty = () => {
    if (!rowValid || locked || !canCreateProperty) {
      return;
    }
    setProperties((previous) => [...previous, ownPropertyDraft(propertyInput)]);
    setPropertyName('');
    setEnumValues([]);
    setEnumInput('');
    setIdentifier(false);
  };
  const create = async () => {
    if (!valid || !permitted || locked || submitting.current) {
      return;
    }
    submitting.current = true;
    setPreparing(true);
    setError(false);
    try {
      const state = await getOntologyState(ontology.id);
      const draft: NewClassDraft = {
        label,
        localName,
        synonyms: distinctChipValues([...synonyms, synonym]),
        description,
        definitionSource: source,
        parentIris: selectedIris(selections.parents),
        equivalentIris: selectedIris(selections.equivalent),
        disjointIris: selectedIris(selections.disjoint),
        abstract,
        owners: toEntityReferences(selections.owners),
        ownProperties: properties,
      };
      const plan = buildNewClassChangeSet(
        ontology,
        draft,
        'class-' + uuid(),
        state.workingRevision
      );
      attemptIri.current = ontology.namespace + localName;
      onBeforeCreate();
      await apply.start(plan);
    } catch {
      setError(true);
    } finally {
      setPreparing(false);
      submitting.current = false;
    }
  };
  const conceptOptions = model.concepts.map((c) => ({
    id: c.iri,
    label: c.displayName ?? c.name,
  }));
  const inherited = inheritedClassProperties(
    model,
    selectedIris(selections.parents)
  );
  const renderChips = (values: string[], remove: (value: string) => void) =>
    values.map((value) => (
      <Box align="center" gap={1} key={value}>
        <Badge>{value}</Badge>
        <ButtonUtility
          color="tertiary"
          icon={XClose}
          isDisabled={locked}
          size="xs"
          tooltip={t('label.remove-entity', { entity: value })}
          onClick={() => remove(value)}
        />
      </Box>
    ));

  const renderParentStatus = () => {
    if (selections.parents.length >= 2) {
      return (
        <Badge color="brand" data-testid="new-class-polyhierarchy">
          {t('label.polyhierarchy')}
        </Badge>
      );
    }
    if (selections.parents.length === 0) {
      return (
        <Typography size="text-xs">
          {t('message.ontology-top-level-class')}
        </Typography>
      );
    }

    return null;
  };
  const renderSubmit = () => {
    if (apply.status.kind === 'applied') {
      return (
        <Button isLoading={reconciling} onPress={() => void reconcile()}>
          {t('label.retry')}
        </Button>
      );
    }
    if (apply.status.kind === 'blocked') {
      return (
        <Button isDisabled={!permitted} onPress={() => void apply.retry()}>
          {t('label.retry')}
        </Button>
      );
    }

    return (
      <Button
        data-testid="new-class-create"
        isDisabled={[!valid, !permitted, locked].some(Boolean)}
        isLoading={preparing || apply.status.kind === 'busy'}
        onPress={() => void create()}>
        {t('label.create-class')}
      </Button>
    );
  };
  const renderProperties = () => (
    <>
      <Typography size="text-sm" weight="semibold">
        {t('label.own-property-plural')}
      </Typography>
      {properties.map((property) => (
        <Box align="center" gap={2} justify="between" key={property.name}>
          <Typography size="text-xs">
            {property.name} · {ownPropertyTypeLabel(property)}
            {property.isIdentifier ? ' · ' + t('label.identifier') : ''}
          </Typography>
          <ButtonUtility
            color="tertiary"
            icon={XClose}
            isDisabled={locked}
            size="xs"
            tooltip={t('label.remove-entity', { entity: property.name })}
            onClick={() => removeProperty(property)}
          />
        </Box>
      ))}
      <Input
        inputDataTestId="new-class-property-name"
        isDisabled={locked || !canCreateProperty}
        label={t('label.property-name')}
        value={propertyName}
        onChange={setPropertyName}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            addProperty();
          }
        }}
      />
      <Select
        isDisabled={locked || !canCreateProperty}
        items={[...STUDIO_DATATYPES, 'object'].map((id) => ({
          id,
          label: id,
        }))}
        label={t('label.type')}
        value={datatype}
        onChange={(key) =>
          setDatatype(String(key) as StudioDatatype | 'object')
        }>
        {(item) => <Select.Item id={item.id} label={item.label} />}
      </Select>
      {datatype === 'object' ? (
        <Select
          isDisabled={locked}
          items={conceptOptions}
          label={t('label.range')}
          value={range}
          onChange={(key) => setRange(String(key))}>
          {(item) => <Select.Item id={item.id} label={item.label} />}
        </Select>
      ) : null}
      {datatype === 'enum' ? (
        <>
          <Input
            inputDataTestId="new-class-enum-values"
            isDisabled={locked}
            label={t('label.allowed-values')}
            value={enumInput}
            onChange={(value) => {
              if (value.includes(',')) {
                const parts = value.split(',');
                setEnumValues((previous) =>
                  distinctChipValues([...previous, ...parts.slice(0, -1)])
                );
                setEnumInput(parts.at(-1) ?? '');
              } else {
                setEnumInput(value);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                setEnumValues((previous) =>
                  distinctChipValues([...previous, enumInput])
                );
                setEnumInput('');
              }
            }}
          />
          <Box className="tw:flex-wrap" gap={1}>
            {renderChips(enumValues, (value) =>
              setEnumValues((previous) => previous.filter((v) => v !== value))
            )}
          </Box>
          <Typography size="text-xs">
            {t('message.ontology-enum-minimum')}
          </Typography>
        </>
      ) : null}
      <Checkbox
        isDisabled={locked || !canCreateProperty}
        isSelected={identifier}
        label={t('label.identifier')}
        onChange={setIdentifier}
      />
      <Button
        color="secondary"
        data-testid="new-class-add-property"
        isDisabled={!rowValid || locked || !canCreateProperty}
        size="sm"
        onPress={addProperty}>
        {t('label.add')}
      </Button>
    </>
  );
  const renderFooter = () => (
    <Box
      className="tw:sticky tw:bottom-0 tw:shrink-0 tw:border-t tw:border-secondary tw:bg-surface tw:p-4"
      direction="col"
      gap={2}>
      {error ? (
        <Alert variant="error">
          {apply.status.kind === 'applied'
            ? t('message.ontology-class-refresh-failed')
            : t('server.unexpected-error')}
        </Alert>
      ) : null}
      {apply.status.kind === 'blocked' ? (
        <Alert variant="error">{apply.status.message}</Alert>
      ) : null}
      {renderSubmit()}
    </Box>
  );
  const renderPanel = () => (
    <aside
      aria-label={t('label.new-class')}
      className="tw:flex tw:h-full tw:w-90 tw:shrink-0 tw:flex-col tw:overflow-hidden tw:border-l tw:border-secondary tw:bg-surface"
      data-testid="ontology-new-class-panel">
      <Box
        align="center"
        className="tw:sticky tw:top-0 tw:shrink-0 tw:border-b tw:border-secondary tw:p-4"
        justify="between">
        <Typography size="text-md" weight="semibold">
          {t('label.new-class')}
        </Typography>
        <ButtonUtility
          color="tertiary"
          data-testid="ontology-new-class-close"
          icon={XClose}
          isDisabled={locked || reconciling}
          size="sm"
          tooltip={t('label.close')}
          onClick={onClose}
        />
      </Box>
      <div className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:p-4">
        <HookForm form={form} onSubmit={(event) => event.preventDefault()}>
          <Box direction="col" gap={4}>
            <Typography size="text-sm" weight="semibold">
              {t('label.identity')}
            </Typography>
            <Input
              isRequired
              inputDataTestId="new-class-label"
              isDisabled={locked}
              label={t('label.label')}
              value={label}
              onChange={setLabel}
            />
            <Input
              inputDataTestId="new-class-local-name"
              isDisabled={locked}
              isInvalid={Boolean(localName) && !isValidLocalName(localName)}
              label={t('label.local-name')}
              value={localName}
              onChange={setManualName}
            />
            <Typography
              className="tw:break-all"
              data-testid="new-class-iri"
              size="text-xs">
              {ontology.namespace + localName}
            </Typography>
            <Input
              inputDataTestId="new-class-synonyms"
              isDisabled={locked}
              label={t('label.alternative-label-plural')}
              value={synonym}
              onChange={(value) => {
                if (value.includes(',')) {
                  const parts = value.split(',');
                  setSynonyms((previous) =>
                    distinctChipValues([...previous, ...parts.slice(0, -1)])
                  );
                  setSynonym(parts.at(-1) ?? '');
                } else {
                  setSynonym(value);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  setSynonyms((previous) =>
                    distinctChipValues([...previous, synonym])
                  );
                  setSynonym('');
                }
              }}
            />
            <Box className="tw:flex-wrap" gap={1}>
              {renderChips(synonyms, (value) =>
                setSynonyms((previous) => previous.filter((v) => v !== value))
              )}
            </Box>
            <Typography size="text-sm" weight="semibold">
              {t('label.definition')}
            </Typography>
            <Input
              inputDataTestId="new-class-description"
              isDisabled={locked}
              label={t('label.description')}
              value={description}
              onChange={setDescription}
            />
            <Input
              inputDataTestId="new-class-source"
              isDisabled={locked}
              isInvalid={Boolean(source) && !isAbsoluteOntologyIri(source)}
              label={t('label.definition-source')}
              value={source}
              onChange={setSource}
            />
            <Typography size="text-sm" weight="semibold">
              {t('label.axiom-plural')}
            </Typography>
            {(
              [
                { name: 'parents', label: t('label.subclass-of') },
                { name: 'equivalent', label: t('label.equivalent-to') },
                { name: 'disjoint', label: t('label.disjoint-with') },
              ] as const
            ).map((field) => (
              <Fragment key={field.name}>
                {getField({
                  name: field.name,
                  label: field.label,
                  type: FieldTypes.MULTI_SELECT,
                  props: {
                    items: conceptOptions,
                    isDisabled: locked || !canCreateAxiom,
                  },
                })}
              </Fragment>
            ))}
            {renderParentStatus()}
            <Checkbox
              isDisabled={locked}
              isSelected={abstract}
              label={t('label.abstract')}
              onChange={setAbstract}
            />
            <Typography size="text-sm" weight="semibold">
              {t('label.inherited-property-plural')}
            </Typography>
            {inherited.map(({ property, parent }) => (
              <Typography key={property.id} size="text-xs">
                {property.displayName ?? property.name} ·{' '}
                {t('label.from-parent', {
                  parent: parent.displayName ?? parent.name,
                })}
              </Typography>
            ))}
            {renderProperties()}
            <Typography size="text-sm" weight="semibold">
              {t('label.governance')}
            </Typography>
            <Input
              isReadOnly
              label={t('label.layer')}
              value={
                ontology.layer === 'L2'
                  ? 'L2 ' + t('label.industry')
                  : ontology.layer ?? ''
              }
            />
            {getField({
              name: 'owners',
              label: t('label.owner-plural'),
              type: FieldTypes.USER_TEAM_SELECT_INPUT,
              props: {
                ...ownerPicker,
                multiple: true,
                filterOption: () => true,
                isDisabled: locked,
              },
            })}
            <Alert variant="gray">
              {t('message.ontology-class-draft-notice')}
            </Alert>
          </Box>
        </HookForm>
      </div>
      {renderFooter()}
    </aside>
  );

  return renderPanel();
};

export default OntologyNewClassPanel;
