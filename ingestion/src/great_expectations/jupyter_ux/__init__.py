"""Utility functions for working with great_expectations within jupyter notebooks or jupyter lab.
"""

import logging
import sys
from datetime import datetime

import pandas as pd
import tzlocal
from IPython.core.display import HTML, display

pd.set_option("display.max_rows", None)
pd.set_option("display.max_columns", None)
pd.set_option("display.width", None)
pd.set_option("display.max_colwidth", -1)

from great_expectations.render.renderer import (
    ExpectationSuiteColumnSectionRenderer,
    ProfilingResultsColumnSectionRenderer,
    ValidationResultsColumnSectionRenderer,
)
from great_expectations.render.view import DefaultJinjaSectionView


def set_data_source(context, data_source_type=None):
    """
    TODO: Needs a docstring and tests.
    """

    data_source_name = None

    if not data_source_type:
        configured_datasources = [
            datasource for datasource in context.list_datasources()
        ]

        if len(configured_datasources) == 0:
            display(
                HTML(
                    """
<p>
No data sources found in the great_expectations.yml of your project.
</p>

<p>
If you did not create the data source during init, here is how to add it now: <a href="https://great-expectations.readthedocs.io/en/latest/how_to_add_data_source.html">How To Add a Data Source</a>
</p>
"""
                )
            )
        elif len(configured_datasources) > 1:
            display(
                HTML(
                    """
<p>
Found more than one data source in the great_expectations.yml of your project:
<b>{1:s}</b>
</p>
<p>
Uncomment the next cell and set data_source_name to one of these names.
</p>
""".format(
                        data_source_type,
                        ",".join(
                            [
                                datasource["name"]
                                for datasource in configured_datasources
                            ]
                        ),
                    )
                )
            )
        else:
            data_source_name = configured_datasources[0]["name"]
            display(
                HTML(
                    "Will be using this data source from your project's great_expectations.yml: <b>{:s}</b>".format(
                        data_source_name
                    )
                )
            )

    else:
        configured_datasources = [
            datasource["name"]
            for datasource in context.list_datasources()
            if datasource["type"] == data_source_type
        ]
        if len(configured_datasources) == 0:
            display(
                HTML(
                    """
<p>
No {:s} data sources found in the great_expectations.yml of your project.
</p>

<p>
If you did not create the data source during init, here is how to add it now: <a href="https://great-expectations.readthedocs.io/en/latest/how_to_add_data_source.html">How To Add a Data Source</a>
</p>
""".format(
                        data_source_type
                    )
                )
            )
        elif len(configured_datasources) > 1:
            display(
                HTML(
                    """
<p>
Found more than one {:s} data source in the great_expectations.yml of your project:
<b>{:s}</b>
</p>
<p>
Uncomment the next cell and set data_source_name to one of these names.
</p>
""".format(
                        data_source_type, ",".join(configured_datasources)
                    )
                )
            )
        else:
            data_source_name = configured_datasources[0]
            display(
                HTML(
                    "Will be using this {:s} data source from your project's great_expectations.yml: <b>{:s}</b>".format(
                        data_source_type, data_source_name
                    )
                )
            )

    return data_source_name


def setup_notebook_logging(logger=None, log_level=logging.INFO):
    """Set up the provided logger for the GE default logging configuration.

    Args:
        logger - the logger to configure
    """

    def posix2local(timestamp, tz=tzlocal.get_localzone()):
        """Seconds since the epoch -> local time as an aware datetime object."""
        return datetime.fromtimestamp(timestamp, tz)

    class Formatter(logging.Formatter):
        def converter(self, timestamp):
            return posix2local(timestamp)

        def formatTime(self, record, datefmt=None):
            dt = self.converter(record.created)
            if datefmt:
                s = dt.strftime(datefmt)
            else:
                t = dt.strftime(self.default_time_format)
                s = self.default_msec_format % (t, record.msecs)
            return s

    if not logger:
        logger = logging.getLogger("great_expectations")

    chandler = logging.StreamHandler(stream=sys.stdout)
    chandler.setLevel(logging.DEBUG)
    # chandler.setFormatter(Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s", "%Y-%m-%dT%H:%M:%S%z"))
    chandler.setFormatter(
        Formatter("%(asctime)s - %(levelname)s - %(message)s", "%Y-%m-%dT%H:%M:%S%z")
    )
    logger.addHandler(chandler)
    logger.setLevel(log_level)
    logger.info(
        "Great Expectations logging enabled at %s level by JupyterUX module."
        % (log_level,)
    )
    #
    # # Filter warnings
    # import warnings
    # warnings.filterwarnings('ignore')


def show_available_data_asset_names(context, data_source_name=None):
    """List asset names found in the current context."""
    # TODO: Needs tests.
    styles = """
    <style type='text/css'>
    ul.data-assets {
        margin-top: 0px;
    }
    ul.data-assets li {
        line-height: 1.2em;
        list-style-type: circle;
    }
    ul.data-assets li span.expectation-suite {
        background: #ddd;
    }
    </style>
    """

    print("Inspecting your data sources. This may take a moment...")
    expectation_suite_keys = context.list_expectation_suites()
    datasources = context.list_datasources()
    html = ""
    for datasource in datasources:
        if data_source_name and datasource["name"] != data_source_name:
            continue
        html += "<h2 style='margin: 0'>Datasource: {:s} ({:s})</h2>".format(
            datasource["name"], datasource["class_name"]
        )
        ds = context.get_datasource(datasource["name"])
        generators = ds.list_batch_kwargs_generators()
        for generator_info in generators:
            html += "batch_kwargs_generator: {:s} ({:s})".format(
                generator_info["name"], generator_info["class_name"]
            )
            generator = ds.get_batch_kwargs_generator(generator_info["name"])

            # TODO hacks to deal w/ inconsistent return types. Remove urgently
            mystery_object = generator.get_available_data_asset_names()
            if isinstance(mystery_object, dict) and "names" in mystery_object.keys():
                data_asset_names = sorted(name[0] for name in mystery_object["names"])
            elif isinstance(mystery_object, list):
                data_asset_names = sorted(mystery_object)
            else:
                data_asset_names = []

            if len(data_asset_names) > 0:
                html += "<h3 style='margin: 0.2em 0'>Data Assets Found:</h3>"
                html += styles
                html += "<ul class='data-assets'>"
                for data_asset_name in data_asset_names:
                    html += f"<li>{data_asset_name:s}</li>"
                    data_asset_expectation_suite_keys = [
                        es_key
                        for es_key in expectation_suite_keys
                        if es_key.data_asset_name.datasource == datasource["name"]
                        and es_key.data_asset_name.generator == generator_info["name"]
                        and es_key.data_asset_name.generator_asset == data_asset_name
                    ]
                    if len(data_asset_expectation_suite_keys) > 0:
                        html += "<ul>"
                        for es_key in data_asset_expectation_suite_keys:
                            html += "<li><span class='expectation-suite'>Expectation Suite</span>: {:s}</li>".format(
                                es_key.expectation_suite_name
                            )
                        html += "</ul>"
                html += "</ul>"
            else:
                display(
                    HTML(
                        """<p>No data assets found in this data source.</p>
<p>Read about how batch kwargs generators derive data assets from data sources:
<a href="https://great-expectations.readthedocs.io/en/latest/how_to_add_data_source.html">Data assets</a>
</p>"""
                    )
                )
        display(HTML(html))

    # TODO: add expectation suite names (existing)


bootstrap_link_element = """<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">"""
cooltip_style_element = """<style type="text/css">
.cooltip {
    display:inline-block;
    position:relative;
    text-align:left;
}

.cooltip .top {
    min-width:200px;
    top:-6px;
    left:50%;
    transform:translate(-50%, -100%);
    padding:10px 20px;
    color:#FFFFFF;
    background-color:#222222;
    font-weight:normal;
    font-size:13px;
    border-radius:8px;
    position:absolute;
    z-index:99999999;
    box-sizing:border-box;
    box-shadow:0 1px 8px rgba(0,0,0,0.5);
    display:none;
}

.cooltip:hover .top {
    display:block;
}

.cooltip .top i {
    position:absolute;
    top:100%;
    left:50%;
    margin-left:-12px;
    width:24px;
    height:12px;
    overflow:hidden;
}

.cooltip .top i::after {
    content:'';
    position:absolute;
    width:12px;
    height:12px;
    left:50%;
    transform:translate(-50%,-50%) rotate(45deg);
    background-color:#222222;
    box-shadow:0 1px 8px rgba(0,0,0,0.5);
}
</style>
"""


def _render_for_jupyter(
    view,
    include_styling,
    return_without_displaying,
):
    if include_styling:
        html_to_display = bootstrap_link_element + cooltip_style_element + view
    else:
        html_to_display = view

    if return_without_displaying:
        return html_to_display
    else:
        display(HTML(html_to_display))


def display_column_expectations_as_section(
    expectation_suite,
    column,
    include_styling=True,
    return_without_displaying=False,
):
    """This is a utility function to render all of the Expectations in an ExpectationSuite with the same column name as an HTML block.

    By default, the HTML block is rendered using ExpectationSuiteColumnSectionRenderer and the view is rendered using DefaultJinjaSectionView.
    Therefore, it should look exactly the same as the default renderer for build_docs.

    Example usage:
    exp = context.get_expectation_suite("notable_works_by_charles_dickens", "BasicDatasetProfiler")
    display_column_expectations_as_section(exp, "Type")
    """

    # TODO: replace this with a generic utility function, preferably a method on an ExpectationSuite class
    column_expectation_list = [
        e
        for e in expectation_suite.expectations
        if "column" in e.kwargs and e.kwargs["column"] == column
    ]

    # TODO: Handle the case where zero evrs match the column name

    document = (
        ExpectationSuiteColumnSectionRenderer()
        .render(column_expectation_list)
        .to_json_dict()
    )
    view = DefaultJinjaSectionView().render({"section": document, "section_loop": 1})

    return _render_for_jupyter(
        view,
        include_styling,
        return_without_displaying,
    )


def display_profiled_column_evrs_as_section(
    evrs,
    column,
    include_styling=True,
    return_without_displaying=False,
):
    """This is a utility function to render all of the EVRs in an ExpectationSuite with the same column name as an HTML block.

    By default, the HTML block is rendered using ExpectationSuiteColumnSectionRenderer and the view is rendered using DefaultJinjaSectionView.
    Therefore, it should look exactly the same as the default renderer for build_docs.

    Example usage:
    display_column_evrs_as_section(exp, "my_column")

    WARNING: This method is experimental.
    """

    # TODO: replace this with a generic utility function, preferably a method on an ExpectationSuite class
    column_evr_list = [
        e
        for e in evrs.results
        if "column" in e.expectation_config.kwargs
        and e.expectation_config.kwargs["column"] == column
    ]

    # TODO: Handle the case where zero evrs match the column name

    document = (
        ProfilingResultsColumnSectionRenderer().render(column_evr_list).to_json_dict()
    )
    view = DefaultJinjaSectionView().render(
        {
            "section": document,
            "section_loop": {"index": 1},
        }
    )

    return _render_for_jupyter(
        view,
        include_styling,
        return_without_displaying,
    )


def display_column_evrs_as_section(
    evrs,
    column,
    include_styling=True,
    return_without_displaying=False,
):
    """
    Display validation results for a single column as a section.

    WARNING: This method is experimental.
    """

    # TODO: replace this with a generic utility function, preferably a method on an ExpectationSuite class
    column_evr_list = [
        e
        for e in evrs.results
        if "column" in e.expectation_config.kwargs
        and e.expectation_config.kwargs["column"] == column
    ]

    # TODO: Handle the case where zero evrs match the column name

    document = (
        ValidationResultsColumnSectionRenderer().render(column_evr_list).to_json_dict()
    )
    view = DefaultJinjaSectionView().render(
        {
            "section": document,
            "section_loop": {"index": 1},
        }
    )

    return _render_for_jupyter(
        view,
        include_styling,
        return_without_displaying,
    )


# When importing the jupyter_ux module, we set up a preferred logging configuration
logger = logging.getLogger("great_expectations")
setup_notebook_logging(logger)
