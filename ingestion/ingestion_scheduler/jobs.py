#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import json
from metadata.ingestion.workflow.workflow import Workflow
from simplescheduler.corescheduler import job


class MetadataLoaderJob(job.JobBase, Workflow):
    def __init__(self, job_id, execution_id):
        self.workflow = None
        self.report = None

    def get_status_log(self, pipeline):
        return json.dumps(pipeline.report, indent=4, sort_keys=True)

    @classmethod
    def meta_info(cls):
        return {
            'job_class_string': '%s.%s' % (cls.__module__, cls.__name__),
            'notes': 'Mysql Loader Job to load configured mysql database data into Catalog'
        }

    def run(self, pipeline_data, *args, **kwargs):
        config_data = json.loads(pipeline_data)
        del config_data['cron']
        self.workflow = Workflow.create(config_data)
        self.workflow.execute()
        self.workflow.raise_from_status()
        return self.get_status_log(self.workflow)

    @classmethod
    def status_log(cls, pipeline_data, *args, **kwargs):
        return cls.report
