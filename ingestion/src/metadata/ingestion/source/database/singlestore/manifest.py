from metadata.ingestion.source.database.singlestore.metadata import SinglestoreSource
from metadata.utils.manifest import BaseManifest, get_class_path

SinglestoreManifest = BaseManifest(profler_class=get_class_path(SinglestoreSource))
