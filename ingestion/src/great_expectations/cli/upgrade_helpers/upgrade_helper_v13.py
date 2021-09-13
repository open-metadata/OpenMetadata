import datetime
import json
import os
from typing import Optional

from ruamel.yaml.comments import CommentedMap

from great_expectations import DataContext
from great_expectations.cli.upgrade_helpers.base_upgrade_helper import BaseUpgradeHelper
from great_expectations.data_context.types.base import (
    DataContextConfig,
    DataContextConfigDefaults,
)
from great_expectations.data_context.util import default_checkpoints_exist


class UpgradeHelperV13(BaseUpgradeHelper):
    def __init__(self, data_context=None, context_root_dir=None):
        assert (
            data_context or context_root_dir
        ), "Please provide a data_context object or a context_root_dir."

        self.data_context = data_context or DataContext(
            context_root_dir=context_root_dir
        )

        self.upgrade_log = {
            "skipped_upgrade": False,
            "update_version": True,
            "added_checkpoint_store": {},
        }

        self.upgrade_checklist = {
            "stores": {},
            "checkpoint_store_name": None,
        }

        self._generate_upgrade_checklist()

    def _generate_upgrade_checklist(self):
        if default_checkpoints_exist(directory_path=self.data_context.root_directory):
            self._process_checkpoint_store_for_checklist()
        else:
            self.upgrade_log["skipped_upgrade"] = True

    def _process_checkpoint_store_for_checklist(self):
        config_commented_map: CommentedMap = (
            self.data_context.get_config().commented_map
        )
        checkpoint_store_name: Optional[str] = config_commented_map.get(
            "checkpoint_store_name"
        )
        stores: dict = config_commented_map["stores"]
        if checkpoint_store_name:
            if stores.get(checkpoint_store_name):
                self.upgrade_log["skipped_upgrade"] = True
            else:
                self.upgrade_checklist["stores"] = {
                    checkpoint_store_name: DataContextConfigDefaults.DEFAULT_STORES.value[
                        DataContextConfigDefaults.DEFAULT_CHECKPOINT_STORE_NAME.value
                    ]
                }
        else:
            checkpoint_store_name = (
                DataContextConfigDefaults.DEFAULT_CHECKPOINT_STORE_NAME.value
            )
            self.upgrade_checklist["checkpoint_store_name"] = checkpoint_store_name
            if not stores.get(checkpoint_store_name):
                self.upgrade_checklist["stores"] = {
                    checkpoint_store_name: DataContextConfigDefaults.DEFAULT_STORES.value[
                        checkpoint_store_name
                    ]
                }

    def _upgrade_configuration(self):
        if self.upgrade_log["skipped_upgrade"]:
            return
        config_commented_map: CommentedMap = (
            self.data_context.get_config().commented_map
        )
        for name, value in self.upgrade_checklist.items():
            if isinstance(value, dict):
                for key, config in value.items():
                    config_commented_map[name][key] = config
            else:
                config_commented_map[name] = value
        data_context_config: DataContextConfig = DataContextConfig.from_commented_map(
            commented_map=config_commented_map
        )
        self.data_context.set_config(project_config=data_context_config)
        # noinspection PyProtectedMember
        self.data_context._save_project_config()
        self._update_upgrade_log()

    def _update_upgrade_log(self):
        data_context_config: DataContextConfig = self.data_context.get_config()
        self.upgrade_log["added_checkpoint_store"].update(
            {
                "stores": {
                    DataContextConfigDefaults.DEFAULT_CHECKPOINT_STORE_NAME.value: data_context_config.stores[
                        DataContextConfigDefaults.DEFAULT_CHECKPOINT_STORE_NAME.value
                    ],
                },
                "checkpoint_store_name": data_context_config.checkpoint_store_name,
            }
        )

    def get_upgrade_overview(self):
        upgrade_overview = f"""\
<cyan>\
++====================================++
|| UpgradeHelperV13: Upgrade Overview ||
++====================================++\
</cyan>

UpgradeHelperV13 will upgrade your project to be compatible with Great Expectations 0.13.x.
"""
        stores_upgrade_checklist = [
            config_attribute
            for config_attribute in self.upgrade_checklist["stores"].keys()
        ]
        store_names_upgrade_checklist = ["checkpoint_store_name"]
        if self.upgrade_log["skipped_upgrade"]:
            upgrade_overview += """
<green>\
Good news! No special upgrade steps are required to bring your project up to date.
The Upgrade Helper will simply increment the config_version of your great_expectations.yml for you.
</green>
Would you like to proceed?
"""
        else:
            upgrade_overview += """
<red>**WARNING**: Before proceeding, please make sure you have appropriate backups of your project.</red>
"""
            if stores_upgrade_checklist or store_names_upgrade_checklist:
                upgrade_overview += """
<cyan>\
Automated Steps
================
</cyan>
The following Stores and/or Store Names will be upgraded:

"""
                upgrade_overview += (
                    f"""\
    - Stores: {", ".join(stores_upgrade_checklist)}
"""
                    if stores_upgrade_checklist
                    else ""
                )
                upgrade_overview += (
                    f"""\
    - Store Names: {", ".join(store_names_upgrade_checklist)}
"""
                    if store_names_upgrade_checklist
                    else ""
                )

            upgrade_overview += """
<cyan>\
Manual Steps
=============
</cyan>
No manual upgrade steps are required.
"""

            upgrade_overview += """
<cyan>\
Upgrade Confirmation
=====================
</cyan>
Please consult the 0.13.x migration guide to learn more about the automated upgrade process:

    <cyan>https://docs.greatexpectations.io/en/latest/guides/how_to_guides/migrating_versions.html</cyan>

Would you like to proceed with the project upgrade?\
"""
        return upgrade_overview, False

    def _save_upgrade_log(self):
        current_time = datetime.datetime.now(datetime.timezone.utc).strftime(
            "%Y%m%dT%H%M%S.%fZ"
        )
        dest_path = os.path.join(
            self.data_context.root_directory,
            "uncommitted",
            "logs",
            "project_upgrades",
            f"UpgradeHelperV13_{current_time}.json",
        )
        dest_dir, dest_filename = os.path.split(dest_path)
        os.makedirs(dest_dir, exist_ok=True)

        with open(dest_path, "w") as outfile:
            json.dump(self.upgrade_log, outfile, indent=2)

        return dest_path

    def _generate_upgrade_report(self):
        upgrade_log_path = self._save_upgrade_log()
        increment_version = self.upgrade_log["update_version"]
        upgrade_report = f"""\
<cyan>\
++================++
|| Upgrade Report ||
++================++\
</cyan>
"""
        if increment_version:
            upgrade_report += f"""
<green>\
Your project was successfully upgraded to be compatible with Great Expectations 0.13.x.
The config_version of your great_expectations.yml has been automatically incremented to 3.0.

A log detailing the upgrade can be found here:

    - {upgrade_log_path}\
</green>\
"""
        else:
            upgrade_report += f"""
<yellow>\
The Upgrade Helper has completed the automated upgrade steps.
A log detailing the upgrade can be found here:

    - {upgrade_log_path}\
</yellow>\
"""
        exception_occurred = False
        return upgrade_report, increment_version, exception_occurred

    def upgrade_project(self):
        try:
            self._upgrade_configuration()
        except Exception:
            pass

        # return a report of what happened, boolean indicating whether version should be incremented if the version
        # should not be incremented, the report should include instructions for steps to be performed manually
        (
            upgrade_report,
            increment_version,
            exception_occurred,
        ) = self._generate_upgrade_report()
        return upgrade_report, increment_version, exception_occurred
