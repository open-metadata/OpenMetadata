/**
 * This schema defines the Pipeline entity. A pipeline enables the flow of data from source
 * to destination through a series of processing steps. ETL is a type of pipeline where the
 * series of steps Extract, Transform and Load the data.
 */
export interface Pipeline {
  /**
   * Description of this pipeline.
   */
  description?: string;
  /**
   * A unique name that identifies a pipeline in the format 'ServiceName.PipelineName'.
   */
  fullyQualifiedName?: string;
  /**
   * Link to the resource corresponding to this entity.
   */
  href?: string;
  /**
   * Unique identifier that identifies a pipeline instance.
   */
  id: string;
  /**
   * Name that identifies this pipeline instance uniquely.
   */
  name: string;
  /**
   * Owner of this pipeline.
   */
  owner?: EntityReference;
  /**
   * Link to service where this pipeline is hosted in.
   */
  service: EntityReference;
}

/**
 * Owner of this pipeline.
 *
 * This schema defines the EntityReference type used for referencing an entity.
 * EntityReference is used for capturing relationships from one entity to another. For
 * example, a table has an attribute called database of type EntityReference that captures
 * the relationship of a table `belongs to a` database.
 *
 * Link to service where this pipeline is hosted in.
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
