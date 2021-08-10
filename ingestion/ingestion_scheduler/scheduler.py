"""Run the scheduler process."""
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

from simplescheduler.server import server
import os
import json
from simplescheduler.server import server


class SimpleServer(server.SchedulerServer):

    def post_scheduler_start(self):
        jobs = self.scheduler_manager.get_jobs()
        if len(jobs) == 0:
            for filename in os.listdir(os.getcwd() + '/pipelines/'):
                if filename.endswith('.json'):
                    with open(os.path.join(os.getcwd() + '/pipelines', filename), 'r') as stream:
                        config_data = json.load(stream)
                        print(config_data)
                        self.scheduler_manager.add_job(
                            job_class_string='jobs.MetadataLoaderJob',
                            name='Ingest - {}'.format(filename),
                            pub_args=[json.dumps(config_data)],
                            minute=config_data['cron']['minute'],
                            hour=config_data['cron']['hour'],
                            day=config_data['cron']['day'],
                            month=config_data['cron']['month'],
                            day_of_week=config_data['cron']['day_of_week'],
                        )


if __name__ == "__main__":
    SimpleServer.run()
