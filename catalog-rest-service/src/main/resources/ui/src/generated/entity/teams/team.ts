/**
 * This schema defines the Team entity. A Team is a group of zero or more users. Teams can
 * own zero or more data assets.
 */
export interface Team {
  /**
   * When true the team has been deleted.
   */
  deleted?: boolean;
  /**
   * Description of the team.
   */
  description?: string;
  /**
   * Name used for display purposes. Example 'Data Science team'.
   */
  displayName?: string;
  /**
   * Link to the resource corresponding to this entity.
   */
  href: string;
  id: string;
  name: string;
  /**
   * List of entities owned by the team.
   */
  owns?: EntityReference[];
  /**
   * Team profile information.
   */
  profile?: Profile;
  /**
   * Users that are part of the team.
   */
  users?: EntityReference[];
}

/**
 * List of entities owned by the team.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 */
export interface EntityReference {
  /**
   * Optional description of entity.
   */
  description?: string;
  /**
   * Link to the entity resource.
   */
  href?: string;
  /**
   * Unique identifier that identifies an entity instance.
   */
  id: string;
  /**
   * Name of the entity instance. For entities such as tables, databases where the name is not
   * unique, fullyQualifiedName is returned in this field.
   */
  name?: string;
  /**
   * Entity type/class name - Examples: `database`, `table`, `metrics`, `redshift`, `mysql`,
   * `bigquery`, `snowflake`...
   */
  type: string;
}

/**
 * Team profile information.
 *
 * This schema defines the type for a profile of a user, team, or organization.
 */
export interface Profile {
  images?: ImageList;
}

/**
 * Links to a list of images of varying resolutions/sizes.
 */
export interface ImageList {
  image?: string;
  image192?: string;
  image24?: string;
  image32?: string;
  image48?: string;
  image512?: string;
  image72?: string;
}
