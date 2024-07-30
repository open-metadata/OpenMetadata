from pydantic import BaseModel


class FivetranPipelineDetails(BaseModel):
    """
    Wrapper Class to combine source & destination
    """

    source: dict
    destination: dict
    group: dict
    connector_id: str

    @property
    def pipeline_name(self):
        return f'{self.group.get("id")}_{self.source.get("id")}'

    @property
    def pipeline_display_name(self):
        return f'{self.group.get("name")} <> {self.source.get("schema")}'
