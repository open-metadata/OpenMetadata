/**
 * Type used for capturing the details of a collection.
 */
export interface CollectionDescriptor {
  collection?: CollectionInfo;
}

/**
 * Collection Info.
 */
export interface CollectionInfo {
  /**
   * Description of collection.
   */
  documentation?: string;
  /**
   * URL of the API endpoint where given collections are available.
   */
  href?: string;
  images?: ImageList;
  /**
   * Unique name that identifies a collection.
   */
  name?: string;
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
