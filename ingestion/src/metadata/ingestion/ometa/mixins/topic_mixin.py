#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Mixin class containing Topic specific methods

To be used by OpenMetadata class
"""

from metadata.generated.schema.entity.data.topic import Topic, TopicSampleData
from metadata.ingestion.ometa.client import REST
from metadata.ingestion.ometa.utils import ometa_logger

logger = ometa_logger()


class OMetaTopicMixin:
    """
    OpenMetadata API methods related to Topics.

    To be inherited by OpenMetadata
    """

    client: REST

    def ingest_topic_sample_data(
        self, topic: Topic, sample_data: TopicSampleData
    ) -> TopicSampleData:
        """
        PUT sample data for a topic

        :param topic: Topic Entity to update
        :param sample_data: Data to add
        """
        resp = self.client.put(
            f"{self.get_suffix(Topic)}/{topic.id.__root__}/sampleData",
            data=sample_data.json(),
        )
        return TopicSampleData(**resp["sampleData"])
