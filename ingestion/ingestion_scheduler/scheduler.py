"""Run the scheduler process."""
from sdscheduler.server import server
from sdscheduler.corescheduler import job
import os
import json


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
