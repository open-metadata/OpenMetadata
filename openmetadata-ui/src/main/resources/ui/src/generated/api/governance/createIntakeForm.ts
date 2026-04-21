/**
 * Create IntakeForm API request.
 */
export interface CreateIntakeForm {
    /**
     * Description of what governance policy this IntakeForm enforces.
     */
    description?: string;
    /**
     * Name used for display purposes.
     */
    displayName?: string;
    /**
     * Whether this IntakeForm is currently enforced.
     */
    enabled?: boolean;
    /**
     * The entity type this IntakeForm applies to.
     */
    entityType: TargetEntityType;
    /**
     * Unique name of the IntakeForm.
     */
    name: string;
    /**
     * Owners of this IntakeForm configuration.
     */
    owners?: EntityReference[];
    /**
     * Additional required fields enforced by this IntakeForm.
     */
    requiredFields?: RequiredField[];
}

/**
 * The entity type this IntakeForm applies to.
 *
 * Entity types supported by IntakeForm today.
 */
export enum TargetEntityType {
    DataProduct = "dataProduct",
    Domain = "domain",
    GlossaryTerm = "glossaryTerm",
}

/**
 * Owners of this IntakeForm configuration.
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
 * A single field declared as required by this IntakeForm.
 */
export interface RequiredField {
    /**
     * Optional override for the validation error message when this field is missing.
     */
    errorMessage?: string;
    fieldKind:     FieldKind;
    /**
     * Human-friendly label used in validation error messages and on the intake form UI.
     */
    fieldLabel: string;
    /**
     * Path to the field on the entity. Native paths are simple attribute names (e.g.,
     * 'dataProductType'). Custom property paths look like 'extension.<propertyName>'.
     */
    fieldPath: string;
}

/**
 * Whether a required field refers to a native entity attribute or a custom property defined
 * via the Type system.
 */
export enum FieldKind {
    CustomProperty = "customProperty",
    Native = "native",
}
