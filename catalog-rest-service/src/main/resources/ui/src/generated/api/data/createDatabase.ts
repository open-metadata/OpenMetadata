/**
 * Create Database entity request
 */
export interface CreateDatabase {
  /**
   * Description of the database instance. What it has and how to use it.
   */
  description?: string;
  /**
   * Name that identifies this database instance uniquely.
   */
  name: string;
  /**
   * Owner of this database
   */
  owner?: EntityReference;
  /**
   * Link to the database service where this database is hosted in
   */
  service: EntityReference;
}

/**
 * Owner of this database
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Link to the database service where this database is hosted in
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
