import datetime
import logging
from itertools import chain

import ipywidgets as widgets
from IPython.display import display

logger = logging.getLogger(__name__)


class ExpectationExplorer:
    def __init__(self):
        self.state = {"data_assets": {}}
        self.expectation_kwarg_field_names = {
            "expect_column_values_to_be_unique": ["mostly"],
            "expect_column_unique_value_count_to_be_between": [
                "min_value",
                "max_value",
            ],
            "expect_column_value_lengths_to_be_between": [
                "min_value",
                "max_value",
                "mostly",
            ],
            "expect_table_row_count_to_be_between": ["min_value", "max_value"],
            "expect_table_column_count_to_be_between": ["min_value", "max_value"],
            "expect_column_proportion_of_unique_values_to_be_between": [
                "min_value",
                "max_value",
            ],
            "expect_column_median_to_be_between": ["min_value", "max_value"],
            "expect_column_mean_to_be_between": ["min_value", "max_value"],
            "expect_column_stdev_to_be_between": ["min_value", "max_value"],
            "expect_column_quantile_values_to_be_between": ["quantile_ranges"],
            "expect_column_sum_to_be_between": ["min_value", "max_value"],
            "expect_column_values_to_not_be_null": ["mostly"],
            "expect_column_values_to_be_null": ["mostly"],
            "expect_column_values_to_be_json_parseable": ["mostly"],
            "expect_column_values_to_be_dateutil_parseable": ["mostly"],
            "expect_column_values_to_be_increasing": [
                "strictly",
                "parse_strings_as_datetimes",
                "mostly",
            ],
            "expect_column_values_to_be_decreasing": [
                "strictly",
                "parse_strings_as_datetimes",
                "mostly",
            ],
            "expect_column_values_to_match_regex": ["regex", "mostly"],
            "expect_column_values_to_not_match_regex": ["regex", "mostly"],
            "expect_column_values_to_match_json_schema": ["json_schema", "mostly"],
            "expect_column_values_to_match_regex_list": [
                "regex_list",
                "match_on",
                "mostly",
            ],
            "expect_column_values_to_not_match_regex_list": ["regex_list", "mostly"],
            "expect_column_values_to_be_in_set": [
                "value_set",
                "parse_strings_as_datetimes",
                "mostly",
            ],
            "expect_column_values_to_not_be_in_set": [
                "value_set",
                "parse_strings_as_datetimes",
                "mostly",
            ],
            "expect_column_distinct_values_to_be_in_set": [
                "value_set",
                "parse_strings_as_datetimes",
            ],
            "expect_column_distinct_values_to_equal_set": [
                "value_set",
                "parse_strings_as_datetimes",
            ],
            "expect_column_distinct_values_to_contain_set": [
                "value_set",
                "parse_strings_as_datetimes",
            ],
            "expect_column_most_common_value_to_be_in_set": ["value_set", "ties_okay"],
            "expect_column_to_exist": ["column_index"],
            "expect_column_value_lengths_to_equal": ["value", "mostly"],
            "expect_table_row_count_to_equal": ["value"],
            "expect_table_column_count_to_equal": ["value"],
            "expect_column_values_to_match_strftime_format": [
                "strftime_format",
                "mostly",
            ],
            "expect_column_values_to_be_between": [
                "min_max_type",
                "parse_strings_as_datetimes",
                "output_strftime_format",
                "min_value",
                "max_value",
                "mostly",
                "allow_cross_type_comparisons",
            ],
            "expect_column_max_to_be_between": [
                "min_max_type",
                "parse_strings_as_datetimes",
                "output_strftime_format",
                "min_value",
                "max_value",
            ],
            "expect_column_min_to_be_between": [
                "min_max_type",
                "parse_strings_as_datetimes",
                "output_strftime_format",
                "min_value",
                "max_value",
            ],
            "expect_table_columns_to_match_ordered_list": ["column_list"],
            "expect_table_columns_to_match_set": ["column_set", "exact_match"],
            ####
            "expect_column_pair_values_to_be_equal": ["ignore_row_if"],
            "expect_column_pair_values_A_to_be_greater_than_B": [
                "or_equal",
                "ignore_row_if",
                "allow_cross_type_comparisons",
            ],
            "expect_column_pair_values_to_be_in_set": [
                "value_pairs_set",
                "ignore_row_if",
                "mostly",
            ],
            "expect_compound_columns_to_be_unique": ["ignore_row_if"],
            "expect_multicolumn_sum_to_equal": ["sum_total", "ignore_row_if"],
            "expect_select_column_values_to_be_unique_within_record": ["ignore_row_if"],
            "expect_column_values_to_be_of_type": ["type_", "mostly"],
            "expect_column_values_to_be_in_type_list": ["type_list", "mostly"],
            "expect_column_kl_divergence_to_be_less_than": [
                "partition_object",
                "threshold",
                "internal_weight_holdout",
                "tail_weight_holdout",
            ],
            "expect_column_chisquare_test_p_value_to_be_greater_than": [
                "partition_object",
                "p",
            ],
            "expect_column_bootstrapped_ks_test_p_value_to_be_greater_than": [
                "partition_object",
                "p",
                "bootstrap_samples",
                "bootstrap_sample_size",
            ],
            "expect_column_parameterized_distribution_ks_test_p_value_to_be_greater_than": [
                "distribution",
                "p_value",
                "params",
            ],
            "_expect_column_values_to_be_in_type_list__aggregate": ["type_list"],
            "_expect_column_values_to_be_in_type_list__map": ["type_list"],
        }
        self.kwarg_widget_exclusions = ["column", "result_format", "include_config"]
        self.min_max_subtypes = {
            "integer": {
                "positive": [
                    "expect_column_unique_value_count_to_be_between",
                    "expect_column_value_lengths_to_be_between",
                    "expect_table_row_count_to_be_between",
                ],
                "unbounded": ["expect_column_median_to_be_between"],
            },
            "float": {
                "unit_interval": [
                    "expect_column_proportion_of_unique_values_to_be_between"
                ],
                "unbounded": [
                    "expect_column_mean_to_be_between",
                    "expect_column_stdev_to_be_between",
                    "expect_column_sum_to_be_between",
                ],
            },
            "mixed": {
                "unbounded": [
                    "expect_column_values_to_be_between",
                    "expect_column_min_to_be_between",
                    "expect_column_max_to_be_between",
                ]
            },
        }
        self.debug_view = widgets.Output()
        self.styles = {"description_width": {"description_width": "150px"}}

    def update_result(self, data_asset_name, new_result, column=None):
        new_success_value = new_result.get("success")
        expectation_type = new_result.expectation_config.expectation_type
        new_result_widgets = self.generate_expectation_result_detail_widgets(
            result=new_result.result
        )
        new_border_color = "green" if new_success_value else "red"
        data_asset_expectations = self.state["data_assets"][data_asset_name][
            "expectations"
        ]

        if column:
            data_asset_expectations[column][expectation_type][
                "success"
            ].value = "<span><strong>Success: </strong>{new_success_value}</span>".format(
                new_success_value=str(new_success_value)
            )
            data_asset_expectations[column][expectation_type][
                "result_detail_widget"
            ].children = new_result_widgets
            data_asset_expectations[column][expectation_type][
                "editor_widget"
            ].layout.border = "2px solid {new_border_color}".format(
                new_border_color=new_border_color
            )
        else:
            data_asset_expectations["non_column_expectations"][expectation_type][
                "success"
            ].value = "<span><strong>Success: </strong>{new_success_value}</span>".format(
                new_success_value=str(new_success_value)
            )
            data_asset_expectations["non_column_expectations"][expectation_type][
                "result_detail_widget"
            ].children = new_result_widgets
            data_asset_expectations["non_column_expectations"][expectation_type][
                "editor_widget"
            ].layout.border = "2px solid {new_border_color}".format(
                new_border_color=new_border_color
            )

    def get_expectation_state(self, data_asset_name, expectation_type, column=None):
        data_asset_state = self.state["data_assets"].get(data_asset_name, {})
        data_asset_expectations = data_asset_state.get("expectations", {})

        if column:
            column_expectations = data_asset_expectations.get(column)
            if not column_expectations:
                return None
            return column_expectations.get(expectation_type)
        else:
            non_column_expectations = data_asset_expectations.get(
                "non_column_expectations"
            )
            if not non_column_expectations:
                return None
            return non_column_expectations.get(expectation_type)

    def initialize_data_asset_state(self, data_asset):
        data_asset_name = data_asset.data_asset_name

        self.state["data_assets"][data_asset_name] = {
            "data_asset": data_asset,
            "expectations": {},
        }

    def set_expectation_state(self, data_asset, expectation_state, column=None):
        data_asset_name = data_asset.data_asset_name
        expectation_type = expectation_state.get("expectation_type")
        data_asset_state = self.state["data_assets"].get(data_asset_name)

        data_asset_expectations = data_asset_state.get("expectations")

        if column:
            column_expectations = data_asset_expectations.get(column, {})
            column_expectations[expectation_type] = expectation_state
            data_asset_expectations[column] = column_expectations
        else:
            non_column_expectations = data_asset_expectations.get(
                "non_column_expectations", {}
            )
            non_column_expectations[expectation_type] = expectation_state
            data_asset_expectations["non_column_expectations"] = non_column_expectations

    # interconvert expectation kwargs
    def expectation_kwarg_dict_to_ge_kwargs(self, kwarg_dict):
        # kwarg_exclusions are non-ge keys which contain ancillary widgets required for proper parsing
        # for e.g., a widget for setting the date type of min/max
        ancillary_kwargs = ["min_max_type"]
        expectation_kwargs = {}

        for kwarg_name, widget_dict in kwarg_dict.items():
            if kwarg_name == "column":
                expectation_kwargs["column"] = widget_dict
                continue
            if kwarg_name in ancillary_kwargs:
                continue
            elif not hasattr(self, f"generate_{kwarg_name}_widget_dict"):
                expectation_kwargs[kwarg_name] = widget_dict.get("ge_kwarg_value")
            else:
                expectation_kwargs[kwarg_name] = (
                    widget_dict.get("ge_kwarg_value")
                    if "ge_kwarg_value" in widget_dict
                    else widget_dict["kwarg_widget"].value
                )

        return expectation_kwargs

    def update_kwarg_widget_dict(
        self, expectation_state, current_widget_dict, ge_kwarg_name, new_ge_kwarg_value
    ):
        def update_tag_list_widget_dict(widget_dict, new_list):
            widget_dict["ge_kwarg_value"] = new_list
            widget_display = widget_dict["widget_display"]
            widget_display.children = self.generate_tag_button_list(
                expectation_state=expectation_state,
                tag_list=new_list,
                widget_display=widget_display,
            )

        def ge_number_to_widget_string(widget_dict, number_kwarg):
            if hasattr(widget_dict["kwarg_widget"], "value"):
                widget_dict["kwarg_widget"].value = (
                    str(number_kwarg) if number_kwarg or number_kwarg == 0 else ""
                )
            if widget_dict.get("ge_kwarg_value"):
                widget_dict["ge_kwarg_value"] = (
                    str(number_kwarg) if number_kwarg or number_kwarg == 0 else ""
                )

        def min_max_value_to_string(widget_dict, number_kwarg):
            # expectations with min/max kwargs where widget expects a string
            number_to_string_expectations = [
                "expect_column_values_to_be_between",
                "expect_column_max_to_be_between",
                "expect_column_min_to_be_between",
            ]

            if (
                expectation_state.get("expectation_type")
                in number_to_string_expectations
            ):
                ge_number_to_widget_string(widget_dict, number_kwarg)

        updater_functions = {
            "regex_list": update_tag_list_widget_dict,
            "value_set": update_tag_list_widget_dict,
            "column_list": update_tag_list_widget_dict,
            "column_index": ge_number_to_widget_string,
            "min_value": min_max_value_to_string,
            "max_value": min_max_value_to_string,
        }
        updater_functions.get(
            ge_kwarg_name,
            lambda current_widget_dict, ge_kwarg_value: setattr(
                current_widget_dict["kwarg_widget"], "value", ge_kwarg_value
            ),
        )(current_widget_dict, new_ge_kwarg_value)

    def update_expectation_state(
        self, existing_expectation_state, expectation_validation_result, validation_time
    ):
        expectation_editor_widget = existing_expectation_state.get("editor_widget")
        new_ge_expectation_kwargs = expectation_validation_result.expectation_config[
            "kwargs"
        ]
        current_expectation_kwarg_dict = existing_expectation_state["kwargs"]
        column = current_expectation_kwarg_dict.get("column")
        data_asset_name = existing_expectation_state.get("data_asset_name")

        for ge_kwarg_name, ge_kwarg_value in new_ge_expectation_kwargs.items():
            if ge_kwarg_name in self.kwarg_widget_exclusions:
                continue

            current_widget_dict = current_expectation_kwarg_dict.get(ge_kwarg_name)

            if current_widget_dict:
                if not hasattr(
                    self,
                    "generate_{ge_kwarg_name}_widget_dict".format(
                        ge_kwarg_name=ge_kwarg_name
                    ),
                ):
                    current_expectation_kwarg_dict[
                        ge_kwarg_name
                    ] = self.generate_expectation_kwarg_fallback_widget_dict(
                        expectation_kwarg_name=ge_kwarg_name,
                        **new_ge_expectation_kwargs,
                    )
                else:
                    self.update_kwarg_widget_dict(
                        expectation_state=existing_expectation_state,
                        current_widget_dict=current_widget_dict,
                        ge_kwarg_name=ge_kwarg_name,
                        new_ge_kwarg_value=ge_kwarg_value,
                    )
            else:
                widget_dict_generator = getattr(
                    self,
                    "generate_{ge_kwarg_name}_widget_dict".format(
                        ge_kwarg_name=ge_kwarg_name
                    ),
                    None,
                )
                widget_dict = (
                    widget_dict_generator(
                        expectation_state=existing_expectation_state,
                        **new_ge_expectation_kwargs,
                    )
                    if widget_dict_generator
                    else self.generate_expectation_kwarg_fallback_widget_dict(
                        expectation_kwarg_name=ge_kwarg_name,
                        **new_ge_expectation_kwargs,
                    )
                )
                current_expectation_kwarg_dict[ge_kwarg_name] = widget_dict
                expectation_editor_widget.children[0].children[1].children += (
                    widget_dict["kwarg_widget"],
                )

        self.update_result(
            data_asset_name=data_asset_name,
            new_result=expectation_validation_result,
            column=column,
        )
        # TODO: This is messy. Figure out better way of storing/accessing UI elements
        validation_time_widget = (
            expectation_editor_widget.children[0].children[0].children[0].children[-1]
        )
        validation_time_widget.value = "<div><strong>Date/Time Validated (UTC): </strong>{validation_time}</div>".format(
            validation_time=validation_time
        )
        return expectation_editor_widget

    # widget generators for general input fields
    def generate_boolean_checkbox_widget(
        self, value, description="", description_tooltip="", disabled=False
    ):
        return widgets.Checkbox(
            value=value,
            description=description,
            style=self.styles.get("description_width"),
            layout={"width": "400px"},
            description_tooltip=description_tooltip,
            disabled=disabled,
        )

    def generate_text_area_widget(
        self,
        value,
        description="",
        description_tooltip="",
        continuous_update=False,
        placeholder="",
    ):
        return widgets.Textarea(
            value=value,
            placeholder=placeholder,
            description="<strong>{description}: </strong>".format(
                description=description
            ),
            style=self.styles.get("description_width"),
            layout={"width": "400px"},
            description_tooltip=description_tooltip,
            continuous_update=continuous_update,
        )

    def generate_text_widget(
        self,
        value,
        description="",
        description_tooltip="",
        continuous_update=False,
        placeholder="",
        disabled=False,
    ):
        return widgets.Text(
            value=value,
            placeholder=placeholder,
            description="<strong>{description}: </strong>".format(
                description=description
            ),
            style=self.styles.get("description_width"),
            layout={"width": "400px"},
            description_tooltip=description_tooltip,
            continuous_update=continuous_update,
            disabled=disabled,
        )

    def generate_radio_buttons_widget(
        self, value, options=None, description="", description_tooltip=""
    ):
        if options is None:
            options = []

        return widgets.RadioButtons(
            options=options,
            value=value,
            description="<strong>{description}: </strong>".format(
                description=description
            ),
            layout={"width": "400px"},
            style=self.styles.get("description_width"),
            description_tooltip=description_tooltip,
        )

    def generate_remove_expectation_button(self, expectation_state):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]

        column = expectation_state["kwargs"].get("column")

        remove_expectation_button = widgets.Button(
            description="Remove Expectation",
            button_style="danger",
            tooltip="click to remove expectation",
            icon="trash",
            layout={"width": "auto"},
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_click(button):
            editor_widget = expectation_state.get("editor_widget")
            expectation = data_asset.remove_expectation(
                expectation_type=expectation_type, column=column
            )
            data_asset_state = self.state["data_assets"].get(data_asset_name, {})
            data_asset_expectations = data_asset_state.get("expectations")

            if column:
                column_expectations = data_asset_expectations.get(column)
                column_expectations.pop(expectation_type)
            else:
                non_column_expectations = data_asset_expectations.get(
                    "non_column_expectations"
                )
                non_column_expectations.pop(expectation_type)

            editor_widget.close()

        remove_expectation_button.on_click(on_click)

        return remove_expectation_button

    def generate_tag_button(self, expectation_state, tag, tag_list, widget_display):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        tag_button = widgets.Button(
            description=str(tag),
            button_style="info",
            tooltip="click to delete",
            icon="trash",
            layout={"width": "auto"},
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_click(button):
            if len(tag_list) == 1:
                with expectation_feedback_widget:
                    print("Warning: cannot remove - set must have at least one member")
                return
            tag_list.remove(tag)

            display_children = list(widget_display.children)
            display_children.remove(tag_button)
            widget_display.children = display_children

            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        tag_button.on_click(on_click)

        return tag_button

    def generate_tag_button_list(self, expectation_state, tag_list, widget_display):
        return (
            [
                self.generate_tag_button(
                    expectation_state=expectation_state,
                    tag=tag,
                    tag_list=tag_list,
                    widget_display=widget_display,
                )
                for tag in tag_list
            ]
            if tag_list
            else []
        )

    def generate_zero_or_positive_integer_widget(
        self, value, max=int(9e300), description="", continuous_update=False
    ):
        return widgets.BoundedIntText(
            value=value,
            min=0,
            max=max,
            description="<strong>{description}: </strong>".format(
                description=description
            ),
            style=self.styles.get("description_width"),
            layout={"width": "400px"},
            continuous_update=continuous_update,
        )

    # widget dict generators for kwarg input fields
    def generate_output_strftime_format_widget_dict(
        self,
        expectation_state,
        output_strftime_format="",
        column=None,
        **expectation_kwargs,
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]

        parse_strings_as_datetimes = expectation_kwargs.get(
            "parse_strings_as_datetimes", False
        )

        output_strftime_format_widget = self.generate_text_widget(
            value=output_strftime_format,
            description="output strftime format",
            placeholder="press enter to confirm...",
            description_tooltip="Enter a valid strfime format for datetime output.",
            disabled=not parse_strings_as_datetimes,
        )

        widget_dict = {"kwarg_widget": output_strftime_format_widget}

        @expectation_feedback_widget.capture(clear_output=True)
        def on_output_strftime_format_submit(widget):
            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        output_strftime_format_widget.on_submit(on_output_strftime_format_submit)

        return widget_dict

    def generate_strftime_format_widget_dict(
        self, expectation_state, strftime_format="", column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]

        strftime_format_widget = self.generate_text_widget(
            value=strftime_format,
            description="strftime format",
            placeholder="press enter to confirm...",
        )

        widget_dict = {"kwarg_widget": strftime_format_widget}

        @expectation_feedback_widget.capture(clear_output=True)
        def on_strftime_format_submit(widget):
            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        strftime_format_widget.on_submit(on_strftime_format_submit)

        return widget_dict

    def generate_value_widget_dict(
        self, expectation_state, value=None, column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]

        value_widget = self.generate_zero_or_positive_integer_widget(
            value=value, description="value"
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_value_change(change):
            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        value_widget.observe(on_value_change, names="value")

        widget_dict = {"kwarg_widget": value_widget}

        return widget_dict

    def generate_json_schema_widget_dict(
        self, expectation_state, json_schema="", column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]

        json_schema_widget = self.generate_text_area_widget(
            value=json_schema,
            description="json schema",
            placeholder="enter json schema",
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_json_schema_change(change):
            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        json_schema_widget.observe(on_json_schema_change, names="value")

        widget_dict = {"kwarg_widget": json_schema_widget}

        return widget_dict

    def generate_ties_okay_widget_dict(
        self, expectation_state, ties_okay=None, column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        ties_okay_widget = self.generate_boolean_checkbox_widget(
            value=ties_okay,
            description="ties_okay",
            description_tooltip="If True, then the expectation will still succeed if values outside the designated set are as common (but not more common) than designated values.",
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_ties_okay_change(change):
            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        ties_okay_widget.observe(on_ties_okay_change, names="value")

        widget_dict = {"kwarg_widget": ties_okay_widget}

        return widget_dict

    def generate_match_on_widget_dict(
        self, expectation_state, match_on="any", column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        match_on_widget = self.generate_radio_buttons_widget(
            value=match_on,
            options=["any", "all"],
            description="match_on",
            description_tooltip="Use “any” if the value should match at least one regular expression in the list. Use “all” if it should match each regular expression in the list.",
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_match_on_change(change):
            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        match_on_widget.observe(on_match_on_change, names="value")

        widget_dict = {"kwarg_widget": match_on_widget}

        return widget_dict

    def generate_regex_list_widget_dict(
        self, expectation_state, regex_list=None, column=None, **expectation_kwargs
    ):
        if regex_list is None:
            regex_list = []

        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        regex_list_widget_display = widgets.Box(
            layout={"display": "flex", "flex_flow": "row wrap"}
        )
        regex_list_widget_input = self.generate_text_widget(
            value=None,
            description="add regex",
            placeholder="press enter to add...",
            continuous_update=True,
        )
        regex_list_label = widgets.HTML(
            value='<div style="text-align:right"><strong>regex list: </strong></div>',
            layout={"width": "150px"},
        )
        regex_list_widget = widgets.VBox(
            [
                widgets.HBox([regex_list_label, regex_list_widget_display]),
                regex_list_widget_input,
            ]
        )

        widget_dict = {
            "kwarg_widget": regex_list_widget,
            "ge_kwarg_value": regex_list,
            "widget_display": regex_list_widget_display,
            "widget_input": regex_list_widget_input,
        }

        regex_list_widget_display.children = self.generate_tag_button_list(
            expectation_state=expectation_state,
            tag_list=regex_list,
            widget_display=regex_list_widget_display,
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_regex_list_input_submit(widget):
            widget_display = expectation_state["kwargs"]["regex_list"]["widget_display"]
            regex_list = expectation_state["kwargs"]["regex_list"]["ge_kwarg_value"]
            new_regex = widget.value

            if new_regex in regex_list:
                with expectation_feedback_widget:
                    print("Warning: regex already exists in set")
                return

            regex_list.append(new_regex)
            widget_display.children += (
                self.generate_tag_button(
                    tag=new_regex,
                    expectation_state=expectation_state,
                    tag_list=regex_list,
                    widget_display=widget_display,
                ),
            )
            widget.value = ""

            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        regex_list_widget_input.on_submit(on_regex_list_input_submit)

        return widget_dict

    def generate_column_list_widget_dict(
        self, expectation_state, column_list=None, column=None, **expectation_kwargs
    ):
        if column_list is None:
            column_list = []

        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        column_list_widget_display = widgets.Box(
            layout={"display": "flex", "flex_flow": "row wrap"}
        )
        column_list_widget_input = self.generate_text_widget(
            value=None,
            description="add column",
            placeholder="press enter to add...",
            continuous_update=True,
        )
        column_list_label = widgets.HTML(
            value='<div style="text-align:right"><strong>column list: </strong></div>',
            layout={"width": "150px"},
        )
        column_list_widget = widgets.VBox(
            [
                widgets.HBox([column_list_label, column_list_widget_display]),
                column_list_widget_input,
            ]
        )

        widget_dict = {
            "kwarg_widget": column_list_widget,
            "ge_kwarg_value": column_list,
            "widget_display": column_list_widget_display,
            "widget_input": column_list_widget_input,
        }

        column_list_widget_display.children = self.generate_tag_button_list(
            expectation_state=expectation_state,
            tag_list=column_list,
            widget_display=column_list_widget_display,
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_column_list_input_submit(widget):
            widget_display = expectation_state["kwargs"]["column_list"][
                "widget_display"
            ]
            column_list = expectation_state["kwargs"]["column_list"]["ge_kwarg_value"]
            new_column = widget.value

            if new_column in column_list:
                with expectation_feedback_widget:
                    print("Warning: column already exists in list")
                return

            column_list.append(new_column)
            widget_display.children += (
                self.generate_tag_button(
                    tag=new_column,
                    expectation_state=expectation_state,
                    tag_list=column_list,
                    widget_display=widget_display,
                ),
            )
            widget.value = ""

            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        column_list_widget_input.on_submit(on_column_list_input_submit)

        return widget_dict

    def generate_column_index_widget_dict(
        self, expectation_state, column, column_index="", **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]

        column_index_widget = self.generate_text_widget(
            value=str(column_index),
            description="column_index",
            continuous_update=True,
            placeholder="press enter to confirm...",
        )

        widget_dict = {
            "kwarg_widget": column_index_widget,
            "ge_kwarg_value": column_index,
        }

        @expectation_feedback_widget.capture(clear_output=True)
        def on_column_index_submit(widget):
            new_column_index = widget.value if widget.value else None
            if new_column_index:
                if "." in new_column_index or "-" in new_column_index:
                    with expectation_feedback_widget:
                        print("Warning: column_index must be an integer >= 0")
                    return
                try:
                    new_column_index = int(new_column_index)
                except ValueError:
                    with expectation_feedback_widget:
                        print("Warning: column_index must be an integer >= 0")
                    return

            widget_dict["ge_kwarg_value"] = new_column_index

            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        column_index_widget.on_submit(on_column_index_submit)

        return widget_dict

    def generate_regex_widget_dict(
        self, expectation_state, regex="", column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        regex_widget = self.generate_text_area_widget(
            value=regex, description="regex", placeholder=r"e.g. ([A-Z])\w+"
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_regex_change(change):
            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        regex_widget.observe(on_regex_change, names="value")

        widget_dict = {"kwarg_widget": regex_widget}

        return widget_dict

    def generate_parse_strings_as_datetimes_widget_dict(
        self,
        expectation_state,
        parse_strings_as_datetimes=None,
        column=None,
        **expectation_kwargs,
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        min_max_type_widget_dict = expectation_state["kwargs"].get("min_max_type", {})
        min_max_type_widget = min_max_type_widget_dict.get("kwarg_widget")
        min_max_type = min_max_type_widget.value if min_max_type_widget else None
        parse_strings_as_datetimes_widget = self.generate_boolean_checkbox_widget(
            value=parse_strings_as_datetimes,
            description="parse strings as datetimes",
            disabled=False if min_max_type == "string" or not min_max_type else True,
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_parse_strings_as_datetimes_change(change):
            output_strftime_format_widget_dict = expectation_state["kwargs"].get(
                "output_strftime_format", {}
            )
            output_strftime_format_widget = output_strftime_format_widget_dict.get(
                "kwarg_widget"
            )
            if output_strftime_format_widget:
                output_strftime_format_widget.disabled = not change["new"]

            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        parse_strings_as_datetimes_widget.observe(
            on_parse_strings_as_datetimes_change, names="value"
        )

        widget_dict = {"kwarg_widget": parse_strings_as_datetimes_widget}

        return widget_dict

    def generate_strictly_widget_dict(
        self, expectation_state, strictly=None, column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        inc_dec = expectation_type.split("_")[-1]
        strictly_widget = self.generate_boolean_checkbox_widget(
            value=strictly, description=f"strictly {inc_dec}"
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_strictly_change(change):
            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        strictly_widget.observe(on_strictly_change, names="value")

        widget_dict = {"kwarg_widget": strictly_widget}

        return widget_dict

    def generate_mostly_widget_dict(
        self, expectation_state, mostly=1, column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        mostly_widget = widgets.FloatSlider(
            value=mostly,
            min=0,
            max=1.0,
            step=0.01,
            description="<strong>mostly: </strong>",
            style=self.styles.get("description_width"),
            layout={"width": "400px"},
            continuous_update=True,
            orientation="horizontal",
            readout=True,
            readout_format=".2f",
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_mostly_change(change):
            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        mostly_widget.observe(on_mostly_change, names="value")
        widget_dict = {"kwarg_widget": mostly_widget}

        return widget_dict

    def generate_min_max_type_widget_dict(
        self, expectation_state, type_option=None, column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]

        min_value = expectation_kwargs.get("min_value")
        min_value_type = type(min_value)

        max_value = expectation_kwargs.get("max_value")
        max_value_type = type(max_value)

        number_types = [int, float]
        if min_value_type in number_types or max_value_type in number_types:
            type_option = "number"
        elif min_value_type is str or max_value_type is str:
            type_option = "string"

        min_max_type_widget = self.generate_radio_buttons_widget(
            value=type_option, options=["string", "number"], description="min/max type"
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_min_max_type_change(change):
            new_type_selection = change.get("new")

            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )
            min_value = ge_expectation_kwargs.get("min_value")
            max_value = ge_expectation_kwargs.get("max_value")

            parse_strings_as_datetimes_widget_dict = expectation_state["kwargs"].get(
                "parse_strings_as_datetimes", {}
            )
            parse_strings_as_datetimes_widget = (
                parse_strings_as_datetimes_widget_dict.get("kwarg_widget")
            )

            if new_type_selection == "string":
                ge_expectation_kwargs["min_value"] = (
                    str(min_value) if min_value else None
                )
                ge_expectation_kwargs["max_value"] = (
                    str(max_value) if max_value else None
                )

                if parse_strings_as_datetimes_widget:
                    parse_strings_as_datetimes_widget.disabled = False
            elif new_type_selection == "number":
                ge_expectation_kwargs["min_value"] = (
                    float(min_value) if min_value else None
                )
                ge_expectation_kwargs["max_value"] = (
                    float(max_value) if max_value else None
                )

                if parse_strings_as_datetimes_widget:
                    parse_strings_as_datetimes_widget.value = False
                    parse_strings_as_datetimes_widget.disabled = True

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        min_max_type_widget.observe(on_min_max_type_change, names="value")

        return {"kwarg_widget": min_max_type_widget}

    def generate_min_value_widget_dict(
        self, expectation_state, min_value=None, column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        min_value_widget_dict = expectation_state["kwargs"].get("min_value", {})
        min_value_widget = (
            min_value_widget_dict.get("kwarg_widget") if min_value_widget_dict else None
        )
        max_value_widget_dict = expectation_state["kwargs"].get("max_value", {})
        max_value_widget = (
            max_value_widget_dict.get("kwarg_widget") if max_value_widget_dict else None
        )

        # integer
        if expectation_type in list(
            chain.from_iterable(self.min_max_subtypes["integer"].values())
        ):
            if expectation_type in self.min_max_subtypes["integer"]["positive"]:
                default_min_value = 0
                default_max_value = int(9e300)
            elif expectation_type in self.min_max_subtypes["integer"]["unbounded"]:
                default_min_value = -int(9e300)
                default_max_value = int(9e300)

            if min_value_widget:
                min_value_widget.value = min_value if min_value else default_min_value
            else:
                min_value_widget = widgets.BoundedIntText(
                    value=min_value or default_min_value,
                    min=default_min_value,
                    description="min_value: ",
                    disabled=False,
                )
            if not max_value_widget:
                max_value_widget = widgets.BoundedIntText(
                    description="max_value: ",
                    value=default_max_value,
                    max=default_max_value,
                    disabled=False,
                )
        # float
        elif expectation_type in list(
            chain.from_iterable(self.min_max_subtypes["float"].values())
        ):
            if expectation_type in self.min_max_subtypes["float"]["unit_interval"]:
                default_min_value = 0
                default_max_value = 1
            elif expectation_type in self.min_max_subtypes["float"]["unbounded"]:
                default_min_value = -int(9e300)
                default_max_value = int(9e300)

            if min_value_widget:
                min_value_widget.value = min_value if min_value else default_min_value
            else:
                min_value_widget = widgets.BoundedFloatText(
                    value=min_value or default_min_value,
                    min=default_min_value,
                    step=0.01,
                    description="min_value: ",
                    disabled=False,
                )
            if not max_value_widget:
                max_value_widget = widgets.BoundedFloatText(
                    description="max_value: ",
                    value=default_max_value,
                    max=default_max_value,
                    step=0.01,
                    disabled=False,
                )
        # number or string
        elif expectation_type in list(
            chain.from_iterable(self.min_max_subtypes["mixed"].values())
        ):
            min_value_str = str(min_value) if min_value or min_value == 0 else ""
            if min_value_widget:
                min_value_widget.value = min_value
            else:
                min_value_widget = self.generate_text_widget(
                    value=min_value_str,
                    description="min_value",
                    placeholder="press enter to confirm...",
                )

            @expectation_feedback_widget.capture(clear_output=True)
            def on_min_value_change(change):
                min_max_type = expectation_state["kwargs"]["min_max_type"][
                    "kwarg_widget"
                ].value
                ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                    expectation_state["kwargs"]
                )
                min_value = ge_expectation_kwargs.get("min_value")
                max_value = ge_expectation_kwargs.get("max_value")

                if min_max_type == "string":
                    min_value = str(min_value) if min_value else None
                    max_value = str(max_value) if max_value else None
                elif min_max_type == "number":
                    min_value = float(min_value) if min_value else None
                    max_value = float(max_value) if max_value else None

                if min_value and max_value and min_value > max_value:
                    with expectation_feedback_widget:
                        print(
                            "Error: min_value must be less than or equal to max_value."
                        )
                    return

                ge_expectation_kwargs["min_value"] = min_value
                ge_expectation_kwargs["max_value"] = max_value

                getattr(data_asset, expectation_type)(
                    include_config=True, **ge_expectation_kwargs
                )

            min_value_widget.observe(on_min_value_change, names="value")

        if (
            min_value_widget
            and max_value_widget
            and expectation_type
            not in list(chain.from_iterable(self.min_max_subtypes["mixed"].values()))
        ):

            @expectation_feedback_widget.capture(clear_output=True)
            def on_min_value_change(change):
                ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                    expectation_state["kwargs"]
                )
                getattr(data_asset, expectation_type)(
                    include_config=True, **ge_expectation_kwargs
                )

            min_value_widget.observe(on_min_value_change, names="value")
            max_dl = widgets.link(
                (max_value_widget, "value"), (min_value_widget, "max")
            )
            expectation_state["kwargs"]["max_value"] = {
                "kwarg_widget": max_value_widget
            }

        if min_value_widget:
            min_value_widget_dict["kwarg_widget"] = min_value_widget
        else:
            min_value_widget_dict = (
                self.generate_expectation_kwarg_fallback_widget_dict(
                    expectation_kwarg_name="min_value", **{"min_value": min_value}
                )
            )

        expectation_state["kwargs"]["min_value"] = min_value_widget_dict

        return min_value_widget_dict

    def generate_max_value_widget_dict(
        self, expectation_state, max_value=None, column=None, **expectation_kwargs
    ):
        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]
        min_value_widget_dict = expectation_state["kwargs"].get("min_value")
        min_value_widget = (
            min_value_widget_dict.get("kwarg_widget") if min_value_widget_dict else None
        )
        max_value_widget_dict = expectation_state["kwargs"].get("max_value")
        max_value_widget = (
            max_value_widget_dict.get("kwarg_widget") if max_value_widget_dict else None
        )

        # integer
        if expectation_type in list(
            chain.from_iterable(self.min_max_subtypes["integer"].values())
        ):
            if expectation_type in self.min_max_subtypes["integer"]["positive"]:
                default_min_value = 0
                default_max_value = int(9e300)
            elif expectation_type in self.min_max_subtypes["integer"]["unbounded"]:
                default_min_value = -int(9e300)
                default_max_value = int(9e300)

            if max_value_widget:
                max_value_widget.value = max_value if max_value else default_max_value
            else:
                max_value_widget = widgets.BoundedIntText(
                    value=max_value or default_max_value,
                    max=default_max_value,
                    description="max_value: ",
                    disabled=False,
                )
            if not min_value_widget:
                min_value_widget = widgets.BoundedIntText(
                    min=default_min_value,
                    value=default_min_value,
                    description="min_value: ",
                    disabled=False,
                )
        # float
        elif expectation_type in list(
            chain.from_iterable(self.min_max_subtypes["float"].values())
        ):
            if expectation_type in self.min_max_subtypes["float"]["unit_interval"]:
                default_min_value = 0
                default_max_value = 1
            elif expectation_type in self.min_max_subtypes["float"]["unbounded"]:
                default_min_value = -int(9e300)
                default_max_value = int(9e300)

            if max_value_widget:
                max_value_widget.value = max_value if max_value else default_max_value
            else:
                max_value_widget = widgets.BoundedFloatText(
                    value=max_value or default_max_value,
                    max=default_max_value,
                    step=0.01,
                    description="max_value: ",
                    disabled=False,
                )
            if not min_value_widget:
                min_value_widget = widgets.BoundedFloatText(
                    min=default_min_value,
                    step=0.01,
                    value=default_min_value,
                    description="min_value: ",
                    disabled=False,
                )
        # number or string
        elif expectation_type in list(
            chain.from_iterable(self.min_max_subtypes["mixed"].values())
        ):
            max_value_str = str(max_value) if max_value or max_value == 0 else ""
            if max_value_widget:
                max_value_widget.value = max_value
            else:
                max_value_widget = self.generate_text_widget(
                    value=max_value_str,
                    description="max_value",
                    placeholder="press enter to confirm...",
                )

            @expectation_feedback_widget.capture(clear_output=True)
            def on_max_value_change(change):
                min_max_type = expectation_state["kwargs"]["min_max_type"][
                    "kwarg_widget"
                ].value
                ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                    expectation_state["kwargs"]
                )
                min_value = ge_expectation_kwargs.get("min_value")
                max_value = ge_expectation_kwargs.get("max_value")

                if min_max_type == "string":
                    min_value = str(min_value) if min_value else None
                    max_value = str(max_value) if max_value else None
                elif min_max_type == "number":
                    min_value = float(min_value) if min_value else None
                    max_value = float(max_value) if max_value else None

                if min_value and max_value and min_value > max_value:
                    with expectation_feedback_widget:
                        print(
                            "Error: min_value must be less than or equal to max_value."
                        )
                    return

                ge_expectation_kwargs["min_value"] = min_value
                ge_expectation_kwargs["max_value"] = max_value

                getattr(data_asset, expectation_type)(
                    include_config=True, **ge_expectation_kwargs
                )

            max_value_widget.observe(on_max_value_change, names="value")

        if (
            min_value_widget
            and max_value_widget
            and expectation_type
            not in list(chain.from_iterable(self.min_max_subtypes["mixed"].values()))
        ):

            @expectation_feedback_widget.capture(clear_output=True)
            def on_max_value_change(change):
                ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                    expectation_state["kwargs"]
                )
                getattr(data_asset, expectation_type)(
                    include_config=True, **ge_expectation_kwargs
                )

            max_value_widget.observe(on_max_value_change, names="value")
            min_dl = widgets.link(
                (min_value_widget, "value"), (max_value_widget, "min")
            )
            expectation_state["kwargs"]["min_value"] = {
                "kwarg_widget": min_value_widget
            }

        max_value_widget_dict = (
            {"kwarg_widget": max_value_widget}
            if max_value_widget
            else self.generate_expectation_kwarg_fallback_widget_dict(
                expectation_kwarg_name="max_value", **{"max_value": max_value}
            )
        )
        expectation_state["kwargs"]["max_value"] = max_value_widget_dict

        return max_value_widget_dict

    def generate_value_set_widget_dict(
        self, expectation_state, value_set=None, column=None, **expectation_kwargs
    ):
        if value_set is None:
            value_set = []

        data_asset_name = expectation_state["data_asset_name"]
        data_asset = self.state["data_assets"].get(data_asset_name)["data_asset"]
        expectation_feedback_widget = expectation_state["expectation_feedback_widget"]
        expectation_type = expectation_state["expectation_type"]

        value_set_widget_display = widgets.Box()

        value_set_widget_number_input = self.generate_text_widget(
            value=None,
            description="add number",
            placeholder="press enter to add number...",
            continuous_update=True,
        )
        value_set_widget_string_input = self.generate_text_widget(
            value=None,
            description="add string",
            placeholder="press enter to add string...",
            continuous_update=True,
        )
        value_set_widget_input = widgets.VBox(
            [value_set_widget_string_input, value_set_widget_number_input]
        )
        value_set_label = widgets.HTML(
            value='<div style="text-align:right"><strong>value set: </strong></div>',
            layout={"width": "150px"},
        )
        value_set_widget = widgets.VBox(
            [
                widgets.HBox([value_set_label, value_set_widget_display]),
                value_set_widget_input,
            ]
        )

        widget_dict = {
            "kwarg_widget": value_set_widget,
            "ge_kwarg_value": value_set,
            "widget_display": value_set_widget_display,
            "widget_input": value_set_widget_input,
        }

        value_set_widget_display.children = self.generate_tag_button_list(
            expectation_state=expectation_state,
            tag_list=value_set,
            widget_display=value_set_widget_display,
        )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_value_set_number_input_submit(widget):
            widget_display = expectation_state["kwargs"]["value_set"]["widget_display"]
            value_set = expectation_state["kwargs"]["value_set"]["ge_kwarg_value"]
            new_value = widget.value

            new_value = float(new_value) if "." in new_value else int(new_value)

            if new_value in value_set:
                with expectation_feedback_widget:
                    print("Warning: value already exists in set")
                return

            value_set.append(new_value)
            widget_display.children += (
                self.generate_tag_button(
                    tag=new_value,
                    expectation_state=expectation_state,
                    tag_list=value_set,
                    widget_display=widget_display,
                ),
            )
            widget.value = ""

            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        @expectation_feedback_widget.capture(clear_output=True)
        def on_value_set_string_input_submit(widget):
            widget_display = expectation_state["kwargs"]["value_set"]["widget_display"]
            value_set = expectation_state["kwargs"]["value_set"]["ge_kwarg_value"]
            new_value = widget.value

            if new_value in value_set:
                with expectation_feedback_widget:
                    print("Warning: value already exists in set")
                return

            value_set.append(new_value)
            widget_display.children += (
                self.generate_tag_button(
                    tag=new_value,
                    expectation_state=expectation_state,
                    tag_list=value_set,
                    widget_display=widget_display,
                ),
            )
            widget.value = ""

            ge_expectation_kwargs = self.expectation_kwarg_dict_to_ge_kwargs(
                expectation_state["kwargs"]
            )

            getattr(data_asset, expectation_type)(
                include_config=True, **ge_expectation_kwargs
            )

        value_set_widget_number_input.on_submit(on_value_set_number_input_submit)
        value_set_widget_string_input.on_submit(on_value_set_string_input_submit)

        return widget_dict

    def generate_expectation_kwarg_fallback_widget_dict(
        self, expectation_kwarg_name, **expectation_kwargs
    ):
        ge_kwarg_value = expectation_kwargs.get(expectation_kwarg_name)
        warning_message = widgets.HTML(
            value='<div><strong>Warning: </strong>No input widget for kwarg "{expectation_kwarg_name}". To change value, call expectation again with the modified value.</div>'.format(
                expectation_kwarg_name=expectation_kwarg_name
            ),
            layout={"width": "400px", "margin": "0px 0px 0px 10px"},
        )
        static_widget = widgets.Textarea(
            value=str(ge_kwarg_value),
            description="<strong>{expectation_kwarg_name}: </strong>".format(
                expectation_kwarg_name=expectation_kwarg_name
            ),
            style=self.styles.get("description_width"),
            layout={"width": "400px"},
            disabled=True,
        )
        widget_dict = {
            "kwarg_widget": widgets.HBox([static_widget, warning_message]),
            "ge_kwarg_value": ge_kwarg_value,
        }

        return widget_dict

    # widget generators for general info shared between all expectations
    def generate_column_widget(self, column=None):
        return (
            widgets.HTML(
                value="<div><strong>Column: </strong>{column}</div>".format(
                    column=column
                )
            )
            if column
            else None
        )

    def generate_expectation_type_widget(self, expectation_type):
        return widgets.HTML(
            value="<span><strong>Expectation Type: </strong>{expectation_type}</span>".format(
                expectation_type=expectation_type
            )
        )

    def generate_basic_expectation_info_box(
        self,
        data_asset_name,
        expectation_type,
        success_widget,
        validation_time,
        column=None,
    ):
        if column:
            return widgets.VBox(
                [
                    widgets.HTML(
                        value="<div><strong>Data Asset Name: </strong>{data_asset_name}</div>".format(
                            data_asset_name=data_asset_name
                        )
                    ),
                    self.generate_column_widget(column=column),
                    self.generate_expectation_type_widget(expectation_type),
                    success_widget,
                    widgets.HTML(
                        value="<div><strong>Date/Time Validated (UTC): </strong>{validation_time}</div>".format(
                            validation_time=validation_time
                        )
                    ),
                ],
                layout=widgets.Layout(margin="10px", width="40%"),
            )
        else:
            return widgets.VBox(
                [
                    widgets.HTML(
                        value="<div><strong>Data Asset Name: </strong>{data_asset_name}</div>".format(
                            data_asset_name=data_asset_name
                        )
                    ),
                    self.generate_expectation_type_widget(expectation_type),
                    success_widget,
                    widgets.HTML(
                        value="<div><strong>Date/Time Validated (UTC): </strong>{validation_time}</div>".format(
                            validation_time=validation_time
                        )
                    ),
                ],
                layout=widgets.Layout(margin="10px", width="40%"),
            )

    def generate_expectation_result_detail_widgets(self, result=None):
        if result is None:
            result = {}

        result_detail_widgets = []

        for result_title, result_value in result.items():
            result_detail_widgets.append(
                widgets.HTML(
                    value="<span><strong>{}: </strong>{:.2f}</span>".format(
                        result_title, result_value
                    )
                    if type(result_value) is float
                    else "<span><strong>{result_title}: </strong>{result_value}</span>".format(
                        result_title=result_title, result_value=result_value
                    )
                )
            )

        return result_detail_widgets

    # widget generator for complete expectation widget

    def create_expectation_widget(
        self, data_asset, expectation_validation_result, collapsed=False
    ):
        validation_time = datetime.datetime.now(datetime.timezone.utc).strftime(
            "%Y-%m-%d %H:%M"
        )
        data_asset_name = data_asset.data_asset_name
        data_asset_state = self.state["data_assets"].get(data_asset_name)
        expectation_type = (
            expectation_validation_result.expectation_config.expectation_type
        )
        expectation_kwargs = expectation_validation_result.expectation_config["kwargs"]
        column = expectation_kwargs.get("column")

        if data_asset_state:
            existing_expectation_state = self.get_expectation_state(
                data_asset_name=data_asset_name,
                expectation_type=expectation_type,
                column=column,
            )
            if existing_expectation_state:
                return self.update_expectation_state(
                    existing_expectation_state,
                    expectation_validation_result,
                    validation_time,
                )
        else:
            self.initialize_data_asset_state(data_asset)

        # success_widget
        success = expectation_validation_result.success
        success_widget = widgets.HTML(
            value="<span><strong>Success: </strong>{success}</span>".format(
                success=str(success)
            )
        )

        # widget with result details
        result_detail_widget = widgets.VBox(
            children=self.generate_expectation_result_detail_widgets(
                result=expectation_validation_result.result
            )
        )

        # accordion container for result_detail_widget
        result_detail_accordion = widgets.Accordion(children=[result_detail_widget])
        result_detail_accordion.set_title(0, "Validation Result Details")
        result_detail_accordion.selected_index = None

        # widget for displaying kwarg widget exceptions
        expectation_feedback_widget = widgets.Output()
        exception_accordion = widgets.Accordion(children=[expectation_feedback_widget])
        exception_accordion.set_title(0, "Exceptions/Warnings")

        # create scaffold dict for expectation state
        expectation_state = {
            "success": success_widget,
            "expectation_type": expectation_type,
            "expectation_feedback_widget": expectation_feedback_widget,
            "data_asset_name": data_asset_name,
            "result_detail_widget": result_detail_widget,
            "kwargs": {},
        }

        if column:
            expectation_state["kwargs"]["column"] = column

        remove_expectation_button = self.generate_remove_expectation_button(
            expectation_state=expectation_state
        )

        # widget with basic info (column, expectation_type)
        basic_expectation_info_box = self.generate_basic_expectation_info_box(
            data_asset_name, expectation_type, success_widget, validation_time, column
        )

        # collect widget dicts for kwarg inputs
        expectation_kwarg_input_widget_dicts = []
        for expectation_kwarg_name in self.expectation_kwarg_field_names.get(
            expectation_type
        ):
            widget_dict_generator = getattr(
                self,
                "generate_{expectation_kwarg_name}_widget_dict".format(
                    expectation_kwarg_name=expectation_kwarg_name
                ),
                None,
            )
            widget_dict = (
                widget_dict_generator(
                    expectation_state=expectation_state, **expectation_kwargs
                )
                if widget_dict_generator
                else self.generate_expectation_kwarg_fallback_widget_dict(
                    expectation_kwarg_name=expectation_kwarg_name, **expectation_kwargs
                )
            )
            expectation_state["kwargs"][expectation_kwarg_name] = widget_dict
            expectation_kwarg_input_widget_dicts.append(widget_dict)

        # container for kwarg input widgets
        kwarg_widgets = [
            dict["kwarg_widget"] for dict in expectation_kwarg_input_widget_dicts
        ]
        expectation_kwarg_input_box = widgets.VBox(
            children=kwarg_widgets, layout=widgets.Layout(margin="10px", width="60%")
        )

        # top-level widget container
        expectation_editor_widget_content = widgets.VBox(
            [
                widgets.HBox([basic_expectation_info_box, expectation_kwarg_input_box]),
                exception_accordion,
                result_detail_accordion,
                remove_expectation_button,
            ]
        )
        expectation_editor_widget = widgets.Accordion(
            children=[expectation_editor_widget_content],
            layout=widgets.Layout(
                border="2px solid {color}".format(color="green" if success else "red"),
                margin="5px",
            ),
        )
        expectation_editor_title = (
            "{column} | {expectation_type}".format(
                column=column, expectation_type=expectation_type
            )
            if column
            else "non_column_expectation | {expectation_type}".format(
                expectation_type=expectation_type
            )
        )
        expectation_editor_widget.set_title(0, expectation_editor_title)

        if collapsed:
            expectation_editor_widget.selected_index = None

        # complete expectation state scaffold
        expectation_state["editor_widget"] = expectation_editor_widget

        # set expectation state
        self.set_expectation_state(data_asset, expectation_state, column)

        # update expectation_suite_editor
        expectation_suite_editor = self.state["data_assets"][data_asset_name].get(
            "expectation_suite_editor"
        )
        if expectation_suite_editor:
            expectation_suite = data_asset.get_expectation_suite(
                discard_failed_expectations=False
            )
            expectation_suite_editor.children = (
                self.generate_expectation_suite_editor_widgets(
                    data_asset, expectation_suite
                )
            )

        return expectation_editor_widget

    # expectation_suite_editing
    def get_column_names(self, data_asset_name):
        data_asset_state = self.state["data_assets"].get(data_asset_name)
        if not data_asset_state:
            return []
        data_asset_expectations = data_asset_state.get("expectations")
        if not data_asset_expectations:
            return []

        column_names = [
            column_name
            for column_name in data_asset_expectations.keys()
            if column_name != "non_column_expectations"
        ]
        column_names.sort()
        if "non_column_expectations" in data_asset_expectations.keys():
            column_names.insert(0, "non_column_expectations")

        return column_names

    def get_expectation_types(self, data_asset_name):
        data_asset_state = self.state["data_assets"].get(data_asset_name)
        data_asset_expectations = data_asset_state.get("expectations")
        if not data_asset_state or not data_asset_expectations:
            return []

        expectation_types = []

        for expectation_group in data_asset_expectations.values():
            expectation_types += list(expectation_group.keys())

        return list(set(expectation_types))

    def generate_expectation_suite_editor_widgets(self, data_asset, expectation_suite):
        data_asset_name = data_asset.data_asset_name
        column_names = self.get_column_names(data_asset_name)
        column_accordions = []
        data_asset_state = self.state["data_assets"].get(data_asset_name, {})
        data_asset_expectations = data_asset_state.get("expectations", {})

        # TODO: Deprecate "great_expectations.__version__"
        ge_version = expectation_suite.get("meta").get(
            "great_expectations_version"
        ) or expectation_suite.get("meta").get("great_expectations.__version__")
        column_count = len(column_names)
        expectation_count = len(expectation_suite["expectations"])

        summary_widget_content = """\
            <div>
                <h1>Expectation Suite Editor</h1>
                <hr>
                <ul>
                    <li><strong>Data Asset Name</strong>: {data_asset_name}</li>
                    <li><strong>Great Expectations Version</strong>: {ge_version}</li>
                    <li><strong>Column Count</strong>: {column_count}</li>
                    <li><strong>Expectation Count</strong>: {expectation_count}</li>
                </ul>
                <hr>
                <h2>Columns:</h2>
            </div>\
        """.format(
            data_asset_name=data_asset_name,
            ge_version=ge_version,
            column_count=column_count,
            expectation_count=expectation_count,
        )
        summary_widget = widgets.HTML(
            value=summary_widget_content,
            layout=widgets.Layout(
                margin="10px",
            ),
        )

        for column_name in column_names:
            expectation_editor_widgets = []
            column_expectations = data_asset_expectations[column_name]
            expectation_types = list(column_expectations.keys())
            expectation_types.sort()
            for expectation_type in expectation_types:
                editor_widget = column_expectations[expectation_type]["editor_widget"]
                editor_widget.selected_index = None
                expectation_editor_widgets.append(editor_widget)
            column_accordion_content = widgets.VBox(children=expectation_editor_widgets)
            column_accordion = widgets.Accordion(children=[column_accordion_content])
            column_accordion.set_title(0, column_name)
            column_accordion.selected_index = None
            column_accordions.append(column_accordion)

        return [summary_widget] + column_accordions

    def edit_expectation_suite(self, data_asset):
        data_asset_name = data_asset.data_asset_name
        expectation_suite = data_asset.get_expectation_suite(
            discard_failed_expectations=False
        )
        expectations = expectation_suite.get("expectations")

        ################### editor widgets
        for expectation in expectations:
            expectation_type = expectation.get("expectation_type")
            expectation_kwargs = expectation.get("kwargs")
            editor_widget = getattr(data_asset, expectation_type)(
                include_config=True, **expectation_kwargs
            )

        expectation_suite_editor_widgets = (
            self.generate_expectation_suite_editor_widgets(
                data_asset, expectation_suite
            )
        )
        ###################
        expectation_suite_editor = widgets.VBox(
            children=expectation_suite_editor_widgets,
            layout=widgets.Layout(
                border="2px solid black",
            ),
        )

        self.state["data_assets"][data_asset_name][
            "expectation_suite_editor"
        ] = expectation_suite_editor

        return expectation_suite_editor
