import logging

from ...core import RunIdentifier
from ...data_context.types.resource_identifiers import BatchIdentifier

logger = logging.getLogger(__name__)

from .renderer import Renderer


class MicrosoftTeamsRenderer(Renderer):

    MICROSOFT_TEAMS_SCHEMA_URL = "http://adaptivecards.io/schemas/adaptive-card.json"

    def __init__(self):
        super().__init__()

    def render(
        self,
        validation_result=None,
        validation_result_suite_identifier=None,
        data_docs_pages=None,
    ):
        default_text = (
            "No validation occurred. Please ensure you passed a validation_result."
        )

        status = "Failed :("

        query = {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": {
                        "$schema": self.MICROSOFT_TEAMS_SCHEMA_URL,
                        "type": "AdaptiveCard",
                        "version": "1.0",
                        "body": [
                            {
                                "type": "Container",
                                "height": "auto",
                                "separator": True,
                                "items": [
                                    {
                                        "type": "ColumnSet",
                                        "columns": [
                                            {
                                                "type": "Column",
                                                "width": "stretch",
                                                "items": [
                                                    {
                                                        "type": "TextBlock",
                                                        "text": "Validation results",
                                                        "weight": "bolder",
                                                        "size": "large",
                                                        "wrap": True,
                                                    },
                                                ],
                                            }
                                        ],
                                    },
                                ],
                            },
                            {
                                "type": "Container",
                                "height": "auto",
                                "separator": True,
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": default_text,
                                        "horizontalAlignment": "left",
                                    }
                                ],
                            },
                        ],
                        "actions": [],
                    },
                }
            ],
        }

        validation_result_elements = []
        if validation_result:
            if validation_result.success:
                status = "Success !!!"

            status_element = self._render_validation_result_element(
                key="Batch validation status",
                value=status,
                validation_result=validation_result,
            )
            validation_result_elements.append(status_element)

            if validation_result_suite_identifier:
                batch_identifier = validation_result_suite_identifier.batch_identifier
                if isinstance(batch_identifier, BatchIdentifier):
                    data_asset_name = batch_identifier.data_asset_name
                    batch_identifier = batch_identifier.batch_identifier
                else:
                    data_asset_name = "__no_data_asset_name_"

                data_asset_name_element = self._render_validation_result_element(
                    key="Data asset name", value=data_asset_name
                )
                validation_result_elements.append(data_asset_name_element)

                expectation_suite_name = (
                    validation_result_suite_identifier.expectation_suite_identifier.expectation_suite_name
                )
                expectation_suite_name_element = self._render_validation_result_element(
                    key="Expectation suite name", value=expectation_suite_name
                )
                validation_result_elements.append(expectation_suite_name_element)

                run_id = validation_result_suite_identifier.run_id
                if isinstance(run_id, RunIdentifier):
                    run_name = run_id.run_name
                    run_time = run_id.run_time
                else:
                    run_time = "__no_run_time_"
                    run_name = run_id

                run_name_element = self._render_validation_result_element(
                    key="Run name", value=run_name
                )
                validation_result_elements.append(run_name_element)

                batch_id_element = self._render_validation_result_element(
                    key="Batch ID", value=batch_identifier
                )
                validation_result_elements.append(batch_id_element)

                query["attachments"][0]["content"]["body"][0]["items"][0]["columns"][0][
                    "items"
                ].append(
                    {
                        "type": "TextBlock",
                        "spacing": "none",
                        "text": run_time.strftime("%b %d %Y %H:%M:%S"),
                        "isSubtle": True,
                        "wrap": True,
                    }
                )

            n_checks_succeeded = validation_result.statistics["successful_expectations"]
            n_checks = validation_result.statistics["evaluated_expectations"]
            check_details_text = "*{}* of *{}* expectations were met".format(
                n_checks_succeeded, n_checks
            )
            check_details_text_element = self._render_validation_result_element(
                key="Summary", value=check_details_text
            )
            validation_result_elements.append(check_details_text_element)

            query["attachments"][0]["content"]["body"][1][
                "items"
            ] = validation_result_elements

            if data_docs_pages:
                for docs_link_key in data_docs_pages.keys():
                    if docs_link_key == "class":
                        continue
                    docs_link = data_docs_pages[docs_link_key]
                    report_element = self._get_report_element(docs_link)
                    if report_element:
                        query["attachments"][0]["content"]["actions"].append(
                            report_element
                        )

        return query

    @staticmethod
    def _get_report_element(docs_link):
        report_element = {
            "type": "Action.OpenUrl",
            "title": "Open data docs",
            "url": docs_link,
        }
        return report_element

    @staticmethod
    def _render_validation_result_element(key, value, validation_result=None):
        validation_result_element = {
            "type": "TextBlock",
            "text": f"**{key}:** {value}",
            "horizontalAlignment": "left",
        }
        if validation_result and validation_result.success:
            validation_result_element["color"] = "good"
        elif validation_result and not validation_result.success:
            validation_result_element["color"] = "attention"
        return validation_result_element
