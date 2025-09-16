/*
 *  Copyright 2025 Collate.
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
/**
 * Configuration for the Automator External Application.
 */
export interface AutomatorAppConfig {
    /**
     * Action to take on those entities. E.g., propagate description through lineage, auto
     * tagging, etc.
     */
    actions: Action[];
    /**
     * Entities selected to run the automation.
     */
    resources: Resource;
    /**
     * Application Type
     */
    type: AutomatorAppType;
}

/**
 * Action to take on those entities. E.g., propagate description through lineage, auto
 * tagging, etc.
 *
 * Apply Classification Tags to the selected assets.
 *
 * Remove Classification Tags Action Type
 *
 * Apply Glossary Terms to the selected assets.
 *
 * Remove Glossary Terms Action Type
 *
 * Add domains to the selected assets.
 *
 * Remove domains from the selected assets.
 *
 * Apply Tags to the selected assets.
 *
 * Add a Custom Property to the selected assets.
 *
 * Remove Owner Action Type
 *
 * Add an owner to the selected assets.
 *
 * Add Test Cases to the selected assets.
 *
 * Remove Test Cases Action Type
 *
 * Add owners to the selected assets.
 *
 * Remove Custom Properties Action Type
 *
 * Add a Data Product to the selected assets.
 *
 * Remove a Data Product to the selected assets.
 *
 * Propagate description, tags and glossary terms via lineage
 *
 * ML Tagging action configuration for external automator.
 */
export interface Action {
    /**
     * Apply tags to the children of the selected assets that match the criteria. E.g., columns,
     * tasks, topic fields,...
     *
     * Remove tags from the children of the selected assets. E.g., columns, tasks, topic
     * fields,...
     *
     * Apply terms to the children of the selected assets that match the criteria. E.g.,
     * columns, tasks, topic fields,...
     *
     * Remove terms from the children of the selected assets. E.g., columns, tasks, topic
     * fields,...
     *
     * Apply the description to the children of the selected assets that match the criteria.
     * E.g., columns, tasks, topic fields,...
     *
     * Remove descriptions from the children of the selected assets. E.g., columns, tasks, topic
     * fields,...
     *
     * Add tests to the selected table columns
     *
     * Remove tests to the selected table columns
     */
    applyToChildren?: string[];
    /**
     * Update tags even if they are already defined in the asset. By default, incoming tags are
     * merged with the existing ones.
     *
     * Update terms even if they are already defined in the asset. By default, incoming terms
     * are merged with the existing ones.
     *
     * Update the domains even if they are defined in the asset. By default, we will only apply
     * the domains to assets without domains.
     *
     * Update the description even if they are already defined in the asset. By default, we'll
     * only add the descriptions to assets without the description set.
     *
     * Update the Custom Property even if it is defined in the asset. By default, we will only
     * apply the owners to assets without the given Custom Property informed.
     *
     * Update the tier even if it is defined in the asset. By default, we will only apply the
     * tier to assets without tier.
     *
     * Update the test even if it is defined in the asset. By default, we will only apply the
     * test to assets without the existing test already existing.
     *
     * Update the owners even if it is defined in the asset. By default, we will only apply the
     * owners to assets without owner.
     *
     * Update the Data Product even if the asset belongs to a different Domain. By default, we
     * will only add the Data Product if the asset has no Domain, or it belongs to the same
     * domain as the Data Product.
     *
     * Update descriptions, tags and Glossary Terms via lineage even if they are already defined
     * in the asset. By default, descriptions are only updated if they are not already defined
     * in the asset, and incoming tags are merged with the existing ones.
     */
    overwriteMetadata?: boolean;
    /**
     * Classification Tags to apply (source must be 'Classification')
     *
     * Classification Tags to remove (source must be 'Classification')
     */
    tags?: TierElement[];
    /**
     * Application Type
     */
    type: ActionType;
    /**
     * Remove tags from all the children and parent of the selected assets.
     *
     * Remove terms from all the children and parent of the selected assets.
     *
     * Remove descriptions from all the children and parent of the selected assets.
     */
    applyToAll?: boolean;
    /**
     * Remove tags by its label type
     *
     * Remove terms by its label type
     */
    labels?: LabelElement[];
    /**
     * Glossary Terms to apply
     *
     * Glossary Terms to remove
     */
    terms?: TierElement[];
    /**
     * Domains to apply
     */
    domains?: EntityReference[];
    /**
     * Description to apply
     */
    description?: string;
    /**
     * Owners to apply
     *
     * Custom Properties keys to remove
     */
    customProperties?: any;
    /**
     * tier to apply
     */
    tier?: TierElement;
    /**
     * Test Cases to apply
     */
    testCases?: TestCaseDefinitions[];
    /**
     * Remove all test cases
     */
    removeAll?: boolean;
    /**
     * Test Cases to remove
     */
    testCaseDefinitions?: string[];
    /**
     * Owners to apply
     */
    owners?: EntityReference[];
    /**
     * Data Products to apply
     *
     * Data Products to remove
     */
    dataProducts?: EntityReference[];
    /**
     * Propagate the metadata to columns via column-level lineage.
     */
    propagateColumnLevel?: boolean;
    /**
     * Propagate description through lineage
     */
    propagateDescription?: boolean;
    /**
     * Propagate domains from the parent through lineage
     */
    propagateDomains?: boolean;
    /**
     * Propagate glossary terms through lineage
     */
    propagateGlossaryTerms?: boolean;
    /**
     * Propagate owner from the parent
     */
    propagateOwner?: boolean;
    /**
     * Propagate the metadata to the parents (e.g., tables) via lineage.
     */
    propagateParent?: boolean;
    /**
     * Propagate tags through lineage
     */
    propagateTags?: boolean;
    /**
     * Propagate tier from the parent
     */
    propagateTier?: boolean;
    /**
     * Number of levels to propagate lineage. If not set, it will propagate to all levels.
     */
    propagationDepth?: number;
    /**
     * List of configurations to stop propagation based on conditions
     */
    propagationStopConfigs?: PropagationStopConfig[];
}

/**
 * Domains to apply
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 */
export interface EntityReference {
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type: string;
}

/**
 * Remove tags by its label type
 *
 * Remove terms by its label type
 */
export enum LabelElement {
    Automated = "Automated",
    Manual = "Manual",
    Propagated = "Propagated",
}

/**
 * Configuration to stop lineage propagation based on conditions
 */
export interface PropagationStopConfig {
    /**
     * The metadata attribute to check for stopping propagation
     */
    metadataAttribute: MetadataAttribute;
    /**
     * List of attribute values that will stop propagation when any of them is matched
     */
    value: Array<TagLabel | string>;
}

/**
 * The metadata attribute to check for stopping propagation
 */
export enum MetadataAttribute {
    Description = "description",
    Domains = "domains",
    GlossaryTerms = "glossaryTerms",
    Owner = "owner",
    Tags = "tags",
    Tier = "tier",
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 *
 * tier to apply
 *
 * Domains to apply
 *
 * This schema defines the EntityReferenceList type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 */
export interface TagLabel {
    /**
     * Description for the tag label.
     *
     * Optional description of entity.
     */
    description?: string;
    /**
     * Display Name that identifies this tag.
     *
     * Display Name that identifies this entity.
     */
    displayName?: string;
    /**
     * Link to the tag resource.
     *
     * Link to the entity resource.
     */
    href?: string;
    /**
     * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
     * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
     * relationship (see Classification.json for more details). 'Propagated` indicates a tag
     * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
     * used to determine the tag label.
     */
    labelType?: LabelTypeEnum;
    /**
     * Name of the tag or glossary term.
     *
     * Name of the entity instance.
     */
    name?: string;
    /**
     * Label is from Tags or Glossary.
     */
    source?: TagSource;
    /**
     * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
     * entity must confirm the suggested labels before it is marked as 'Confirmed'.
     */
    state?:  State;
    style?:  Style;
    tagFQN?: string;
    /**
     * If true the entity referred to has been soft-deleted.
     */
    deleted?: boolean;
    /**
     * Fully qualified name of the entity instance. For entities such as tables, databases
     * fullyQualifiedName is returned in this field. For entities that don't have name hierarchy
     * such as `user` and `team` this will be same as the `name` field.
     */
    fullyQualifiedName?: string;
    /**
     * Unique identifier that identifies an entity instance.
     */
    id?: string;
    /**
     * If true the relationship indicated by this entity reference is inherited from the parent
     * entity.
     */
    inherited?: boolean;
    /**
     * Entity type/class name - Examples: `database`, `table`, `metrics`, `databaseService`,
     * `dashboardService`...
     */
    type?: string;
}

/**
 * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
 * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
 * relationship (see Classification.json for more details). 'Propagated` indicates a tag
 * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
 * used to determine the tag label.
 */
export enum LabelTypeEnum {
    Automated = "Automated",
    Derived = "Derived",
    Generated = "Generated",
    Manual = "Manual",
    Propagated = "Propagated",
}

/**
 * Label is from Tags or Glossary.
 */
export enum TagSource {
    Classification = "Classification",
    Glossary = "Glossary",
}

/**
 * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
 * entity must confirm the suggested labels before it is marked as 'Confirmed'.
 */
export enum State {
    Confirmed = "Confirmed",
    Suggested = "Suggested",
}

/**
 * UI Style is used to associate a color code and/or icon to entity to customize the look of
 * that entity in UI.
 */
export interface Style {
    /**
     * Hex Color Code to mark an entity such as GlossaryTerm, Tag, Domain or Data Product.
     */
    color?: string;
    /**
     * An icon to associate with GlossaryTerm, Tag, Domain or Data Product.
     */
    iconURL?: string;
}

/**
 * This schema defines the type for labeling an entity with a Tag.
 *
 * tier to apply
 */
export interface TierElement {
    /**
     * Description for the tag label.
     */
    description?: string;
    /**
     * Display Name that identifies this tag.
     */
    displayName?: string;
    /**
     * Link to the tag resource.
     */
    href?: string;
    /**
     * Label type describes how a tag label was applied. 'Manual' indicates the tag label was
     * applied by a person. 'Derived' indicates a tag label was derived using the associated tag
     * relationship (see Classification.json for more details). 'Propagated` indicates a tag
     * label was propagated from upstream based on lineage. 'Automated' is used when a tool was
     * used to determine the tag label.
     */
    labelType: LabelTypeEnum;
    /**
     * Name of the tag or glossary term.
     */
    name?: string;
    /**
     * Label is from Tags or Glossary.
     */
    source: TagSource;
    /**
     * 'Suggested' state is used when a tag label is suggested by users or tools. Owner of the
     * entity must confirm the suggested labels before it is marked as 'Confirmed'.
     */
    state:  State;
    style?: Style;
    tagFQN: string;
}

/**
 * Minimum set of requirements to get a Test Case request ready
 */
export interface TestCaseDefinitions {
    /**
     * Compute the passed and failed row count for the test case.
     */
    computePassedFailedRowCount?: boolean;
    parameterValues?:             TestCaseParameterValue[];
    /**
     * Tags to apply
     */
    tags?: TierElement[];
    /**
     * Fully qualified name of the test definition.
     */
    testDefinition?: string;
    /**
     * If the test definition supports it, use dynamic assertion to evaluate the test case.
     */
    useDynamicAssertion?: boolean;
    [property: string]: any;
}

/**
 * This schema defines the parameter values that can be passed for a Test Case.
 */
export interface TestCaseParameterValue {
    /**
     * name of the parameter. Must match the parameter names in testCaseParameterDefinition
     */
    name?: string;
    /**
     * value to be passed for the Parameters. These are input from Users. We capture this in
     * string and convert during the runtime.
     */
    value?: string;
    [property: string]: any;
}

/**
 * Application Type
 *
 * Add Tags action type.
 *
 * Remove Classification Tags Action Type.
 *
 * Add Terms action type.
 *
 * Remove Terms Action Type.
 *
 * Add Domain Action Type.
 *
 * Remove Domain Action Type
 *
 * Add Description Action Type.
 *
 * Add Custom Properties Action Type.
 *
 * Remove Description Action Type
 *
 * Add Tier Action Type.
 *
 * Remove Tier Action Type
 *
 * Add Test Case Action Type.
 *
 * Remove Test Case Action Type
 *
 * Add Owner Action Type.
 *
 * Remove Owner Action Type
 *
 * Remove Custom Properties Action Type.
 *
 * Add Data Products Action Type.
 *
 * Remove Data Products Action Type.
 *
 * Lineage propagation action type.
 *
 * ML PII Tagging action type.
 */
export enum ActionType {
    AddCustomPropertiesAction = "AddCustomPropertiesAction",
    AddDataProductAction = "AddDataProductAction",
    AddDescriptionAction = "AddDescriptionAction",
    AddDomainAction = "AddDomainAction",
    AddOwnerAction = "AddOwnerAction",
    AddTagsAction = "AddTagsAction",
    AddTermsAction = "AddTermsAction",
    AddTestCaseAction = "AddTestCaseAction",
    AddTierAction = "AddTierAction",
    LineagePropagationAction = "LineagePropagationAction",
    MLTaggingAction = "MLTaggingAction",
    RemoveCustomPropertiesAction = "RemoveCustomPropertiesAction",
    RemoveDataProductAction = "RemoveDataProductAction",
    RemoveDescriptionAction = "RemoveDescriptionAction",
    RemoveDomainAction = "RemoveDomainAction",
    RemoveOwnerAction = "RemoveOwnerAction",
    RemoveTagsAction = "RemoveTagsAction",
    RemoveTermsAction = "RemoveTermsAction",
    RemoveTestCaseAction = "RemoveTestCaseAction",
    RemoveTierAction = "RemoveTierAction",
}

/**
 * Entities selected to run the automation.
 */
export interface Resource {
    /**
     * Filter JSON tree to be used for rendering the filters in the UI. This comes from
     * Immutable Tree type of react-awesome-query-builder.
     */
    filterJsonTree?: string;
    /**
     * Query filter to be passed to ES. E.g.,
     * `{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"domain.displayName.keyword":"DG
     * Anim"}}]}}]}}}`. This is the same payload as in the Explore page.
     */
    queryFilter?: string;
    /**
     * Type of the entity. E.g., 'table', 'chart',...
     */
    type?: string[];
    [property: string]: any;
}

/**
 * Application Type
 *
 * Application type.
 */
export enum AutomatorAppType {
    Automator = "Automator",
}
