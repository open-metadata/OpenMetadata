/**
 * This schema defines the User entity. A user can be part of 0 or more teams. A special
 * type of user called Bot is used for automation. A user can be an owner of zero or more
 * data assets. A user can also follow zero or more data assets.
 */
export interface User {
  /**
   * When true indicates the user has been deactivated. Users are deactivated instead of
   * deleted.
   */
  deactivated?: boolean;
  /**
   * Name used for display purposes. Example 'FirstName LastName'.
   */
  displayName?: string;
  /**
   * Email address of the user.
   */
  email: string;
  /**
   * List of entities followed by the user.
   */
  follows?: EntityReference[];
  /**
   * Link to the resource corresponding to this entity.
   */
  href: string;
  /**
   * Unique identifier that identifies a user entity instance.
   */
  id: string;
  /**
   * When true indicates user is an administrator for the system with superuser privileges.
   */
  isAdmin?: boolean;
  /**
   * When true indicates a special type of user called Bot.
   */
  isBot?: boolean;
  name: string;
  /**
   * List of entities owned by the user.
   */
  owns?: EntityReference[];
  /**
   * Profile of the user.
   */
  profile?: Profile;
  /**
   * Teams that the user belongs to.
   */
  teams?: EntityReference[];
  /**
   * Timezone of the user.
   */
  timezone?: string;
}

/**
 * List of entities followed by the user.
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
 * Profile of the user.
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
