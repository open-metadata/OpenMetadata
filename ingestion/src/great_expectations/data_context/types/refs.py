class GeCloudIdAwareRef:
    """
    This class serves as a base class for refs tied to a Great Expectations Cloud ID.
    """

    def __init__(self, ge_cloud_id: str):
        self._ge_cloud_id = ge_cloud_id

    @property
    def ge_cloud_id(self):
        return self._ge_cloud_id


class GeCloudResourceRef(GeCloudIdAwareRef):
    """
    This class represents a reference to a Great Expectations object persisted to Great Expectations Cloud.
    """

    def __init__(self, resource_type: str, ge_cloud_id: str, url: str):
        self._resource_type = resource_type
        self._url = url
        super().__init__(ge_cloud_id=ge_cloud_id)

    @property
    def resource_type(self):
        # e.g. "checkpoint"
        return self._resource_type

    @property
    def url(self):
        return self._url
