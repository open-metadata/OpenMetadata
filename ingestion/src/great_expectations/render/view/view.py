import datetime
import json
import re
from collections import OrderedDict
from string import Template as pTemplate
from uuid import uuid4

import mistune
from jinja2 import (
    ChoiceLoader,
    Environment,
    FileSystemLoader,
    PackageLoader,
    contextfilter,
    select_autoescape,
)

from great_expectations import __version__ as ge_version
from great_expectations.render.types import (
    RenderedComponentContent,
    RenderedContent,
    RenderedDocumentContent,
)


class NoOpTemplate:
    def render(self, document):
        return document


class PrettyPrintTemplate:
    def render(self, document, indent=2):
        print(json.dumps(document, indent=indent))


# Abe 2019/06/26: This View should probably actually be called JinjaView or something similar.
# Down the road, I expect to wind up with class hierarchy along the lines of:
#   View > JinjaView > GEContentBlockJinjaView
class DefaultJinjaView:
    """
    Defines a method for converting a document to human-consumable form

    Dependencies
    ~~~~~~~~~~~~
    * Font Awesome 5.10.1
    * Bootstrap 4.3.1
    * jQuery 3.2.1
    * Vega 5
    * Vega-Lite 4
    * Vega-Embed 6

    """

    _template = NoOpTemplate

    def __init__(self, custom_styles_directory=None, custom_views_directory=None):
        self.custom_styles_directory = custom_styles_directory
        self.custom_views_directory = custom_views_directory

        templates_loader = PackageLoader("great_expectations", "render/view/templates")
        styles_loader = PackageLoader("great_expectations", "render/view/static/styles")

        loaders = [templates_loader, styles_loader]
        if self.custom_styles_directory:
            loaders.append(FileSystemLoader(self.custom_styles_directory))
        if self.custom_views_directory:
            loaders.append(FileSystemLoader(self.custom_views_directory))

        self.env = Environment(
            loader=ChoiceLoader(loaders),
            autoescape=select_autoescape(["html", "xml"]),
            extensions=["jinja2.ext.do"],
        )

        self.env.filters["render_string_template"] = self.render_string_template
        self.env.filters[
            "render_styling_from_string_template"
        ] = self.render_styling_from_string_template
        self.env.filters["render_styling"] = self.render_styling
        self.env.filters["render_content_block"] = self.render_content_block
        self.env.filters["render_markdown"] = self.render_markdown
        self.env.filters[
            "get_html_escaped_json_string_from_dict"
        ] = self.get_html_escaped_json_string_from_dict
        self.env.filters["generate_html_element_uuid"] = self.generate_html_element_uuid
        self.env.filters[
            "attributes_dict_to_html_string"
        ] = self.attributes_dict_to_html_string
        self.env.filters[
            "render_bootstrap_table_data"
        ] = self.render_bootstrap_table_data
        self.env.globals["ge_version"] = ge_version
        self.env.filters["add_data_context_id_to_url"] = self.add_data_context_id_to_url

    def render(self, document, template=None, **kwargs):
        self._validate_document(document)

        if template is None:
            template = self._template

        t = self._get_template(template)
        if isinstance(document, RenderedContent):
            document = document.to_json_dict()
        return t.render(document, **kwargs)

    def _get_template(self, template):
        if template is None:
            return NoOpTemplate

        template = self.env.get_template(template)
        template.globals["now"] = lambda: datetime.datetime.now(datetime.timezone.utc)

        return template

    @contextfilter
    def add_data_context_id_to_url(self, jinja_context, url, add_datetime=True):
        data_context_id = jinja_context.get("data_context_id")
        if add_datetime:
            datetime_iso_string = datetime.datetime.now(datetime.timezone.utc).strftime(
                "%Y%m%dT%H%M%S.%fZ"
            )
            url += "?d=" + datetime_iso_string
        if data_context_id:
            url = url + "&dataContextId=" if add_datetime else url + "?dataContextId="
            url += data_context_id
        return url

    @contextfilter
    def render_content_block(
        self,
        jinja_context,
        content_block,
        index=None,
        content_block_id=None,
        render_to_markdown: bool = False,
    ):
        """

        :param jinja_context:
        :param content_block:
        :param index:
        :param content_block_id:
        :param render_to_markdown: Whether this method should render the markdown version instead of HTML
        :return:
        """
        if isinstance(content_block, str):
            return content_block
        elif content_block is None:
            return ""
        elif isinstance(content_block, list):
            # If the content_block item here is actually a list of content blocks then we want to recursively render
            rendered_block = ""
            for idx, content_block_el in enumerate(content_block):
                if (
                    isinstance(content_block_el, RenderedComponentContent)
                    or isinstance(content_block_el, dict)
                    and "content_block_type" in content_block_el
                ):
                    new_content_block_id = None
                    if content_block_id:
                        new_content_block_id = content_block_id + "-" + str(idx)
                    rendered_block += self.render_content_block(
                        jinja_context,
                        content_block_el,
                        idx,
                        content_block_id=new_content_block_id,
                    )
                else:
                    if render_to_markdown:
                        rendered_block += str(content_block_el)
                    else:
                        rendered_block += "<span>" + str(content_block_el) + "</span>"
            return rendered_block
        elif not isinstance(content_block, dict):
            return content_block
        content_block_type = content_block.get("content_block_type")
        if content_block_type is None:
            return content_block

        if render_to_markdown:
            template_filename = f"markdown_{content_block_type}.j2"
        else:
            template_filename = f"{content_block_type}.j2"
        template = self._get_template(template=template_filename)
        if content_block_id:
            return template.render(
                jinja_context,
                content_block=content_block,
                index=index,
                content_block_id=content_block_id,
            )
        else:
            return template.render(
                jinja_context, content_block=content_block, index=index
            )

    def render_dict_values(self, context, dict_, index=None, content_block_id=None):
        for key, val in dict_.items():
            if key.startswith("_"):
                continue
            dict_[key] = self.render_content_block(
                context, val, index, content_block_id
            )

    @contextfilter
    def render_bootstrap_table_data(
        self, context, table_data, index=None, content_block_id=None
    ):
        for table_data_dict in table_data:
            self.render_dict_values(context, table_data_dict, index, content_block_id)
        return table_data

    def get_html_escaped_json_string_from_dict(self, source_dict):
        return json.dumps(source_dict).replace('"', '\\"').replace('"', "&quot;")

    def attributes_dict_to_html_string(self, attributes_dict, prefix=""):
        attributes_string = ""
        if prefix:
            prefix += "-"
        for attribute, value in attributes_dict.items():
            attributes_string += f'{prefix}{attribute}="{value}" '
        return attributes_string

    def render_styling(self, styling):

        """Adds styling information suitable for an html tag.

        Example styling block::

            styling = {
                "classes": ["alert", "alert-warning"],
                "attributes": {
                    "role": "alert",
                    "data-toggle": "popover",
                },
                "styles" : {
                    "padding" : "10px",
                    "border-radius" : "2px",
                }
            }

        The above block returns a string similar to::

            'class="alert alert-warning" role="alert" data-toggle="popover" style="padding: 10px; border-radius: 2px"'

        "classes", "attributes" and "styles" are all optional parameters.
        If they aren't present, they simply won't be rendered.

        Other dictionary keys are also allowed and ignored.
        """

        class_list = styling.get("classes", None)
        if class_list is None:
            class_str = ""
        else:
            if type(class_list) == str:
                raise TypeError("classes must be a list, not a string.")
            class_str = 'class="' + " ".join(class_list) + '" '

        attribute_dict = styling.get("attributes", None)
        if attribute_dict is None:
            attribute_str = ""
        else:
            attribute_str = ""
            for k, v in attribute_dict.items():
                attribute_str += k + '="' + v + '" '

        style_dict = styling.get("styles", None)
        if style_dict is None:
            style_str = ""
        else:
            style_str = 'style="'
            style_str += " ".join([k + ":" + v + ";" for k, v in style_dict.items()])
            style_str += '" '

        styling_string = pTemplate("$classes$attributes$style").substitute(
            {
                "classes": class_str,
                "attributes": attribute_str,
                "style": style_str,
            }
        )

        return styling_string

    def render_styling_from_string_template(self, template):
        # NOTE: We should add some kind of type-checking to template
        """This method is a thin wrapper use to call `render_styling` from within jinja templates."""
        if not isinstance(template, (dict, OrderedDict)):
            return template

        if "styling" in template:
            return self.render_styling(template["styling"])

        else:
            return ""

    def generate_html_element_uuid(self, prefix=None):
        if prefix:
            return prefix + str(uuid4())
        else:
            return str(uuid4())

    def render_markdown(self, markdown):
        try:
            return mistune.markdown(markdown)
        except OSError:
            return markdown

    def render_string_template(self, template):
        # NOTE: Using this line for debugging. This should probably be logged...?
        # print(template)

        # NOTE: We should add some kind of type-checking to template
        if not isinstance(template, (dict, OrderedDict)):
            return template

        # if there are any groupings of two or more $, we need to double the groupings to account
        # for template string substitution escaping
        template["template"] = re.sub(
            r"\${2,}", lambda m: m.group(0) * 2, template.get("template", "")
        )

        tag = template.get("tag", "span")
        template["template"] = template.get("template", "").replace(
            "$PARAMETER", "$$PARAMETER"
        )
        template["template"] = template.get("template", "").replace("\n", "<br>")

        if "tooltip" in template:
            if template.get("styling", {}).get("classes"):
                classes = template.get("styling", {}).get("classes")
                classes.append("cooltip")
                template["styling"]["classes"] = classes
            elif template.get("styling"):
                template["styling"]["classes"] = ["cooltip"]
            else:
                template["styling"] = {"classes": ["cooltip"]}

            tooltip_content = template["tooltip"]["content"]
            tooltip_content.replace("\n", "<br>")
            placement = template["tooltip"].get("placement", "top")
            base_template_string = """
                <{tag} $styling>
                    $template
                    <span class={placement}>
                        {tooltip_content}
                    </span>
                </{tag}>
            """.format(
                placement=placement, tooltip_content=tooltip_content, tag=tag
            )
        else:
            base_template_string = """
                <{tag} $styling>
                    $template
                </{tag}>
            """.format(
                tag=tag
            )

        if "styling" in template:
            params = template.get("params", {})

            # Apply default styling
            if "default" in template["styling"]:
                default_parameter_styling = template["styling"]["default"]
                default_param_tag = default_parameter_styling.get("tag", "span")
                base_param_template_string = (
                    "<{param_tag} $styling>$content</{param_tag}>".format(
                        param_tag=default_param_tag
                    )
                )

                for parameter in template["params"].keys():

                    # If this param has styling that over-rides the default, skip it here and get it in the next loop.
                    if "params" in template["styling"]:
                        if parameter in template["styling"]["params"]:
                            continue

                    params[parameter] = pTemplate(
                        base_param_template_string
                    ).safe_substitute(
                        {
                            "styling": self.render_styling(default_parameter_styling),
                            "content": params[parameter],
                        }
                    )

            # Apply param-specific styling
            if "params" in template["styling"]:
                # params = template["params"]
                for parameter, parameter_styling in template["styling"][
                    "params"
                ].items():
                    if parameter not in params:
                        continue
                    param_tag = parameter_styling.get("tag", "span")
                    param_template_string = (
                        "<{param_tag} $styling>$content</{param_tag}>".format(
                            param_tag=param_tag
                        )
                    )
                    params[parameter] = pTemplate(
                        param_template_string
                    ).safe_substitute(
                        {
                            "styling": self.render_styling(parameter_styling),
                            "content": params[parameter],
                        }
                    )

            string = pTemplate(
                pTemplate(base_template_string).safe_substitute(
                    {
                        "template": template["template"],
                        "styling": self.render_styling(template.get("styling", {})),
                    }
                )
            ).safe_substitute(params)
            return string

        return pTemplate(
            pTemplate(base_template_string).safe_substitute(
                {
                    "template": template.get("template", ""),
                    "styling": self.render_styling(template.get("styling", {})),
                }
            )
        ).safe_substitute(template.get("params", {}))

    def _validate_document(self, document):
        raise NotImplementedError


class DefaultJinjaPageView(DefaultJinjaView):
    _template = "page.j2"

    def _validate_document(self, document):
        assert isinstance(document, RenderedDocumentContent)


class DefaultJinjaIndexPageView(DefaultJinjaPageView):
    _template = "index_page.j2"


class DefaultJinjaSectionView(DefaultJinjaView):
    _template = "section.j2"

    def _validate_document(self, document):
        assert isinstance(
            document["section"], dict
        )  # For now low-level views take dicts


class DefaultJinjaComponentView(DefaultJinjaView):
    _template = "component.j2"

    def _validate_document(self, document):
        assert isinstance(
            document["content_block"], dict
        )  # For now low-level views take dicts


class DefaultMarkdownPageView(DefaultJinjaView):
    """
    Convert a document to markdown format.
    """

    def _validate_document(self, document: RenderedDocumentContent) -> bool:
        """
        Validate that the document is of the appropriate type at runtime.
        """
        assert isinstance(document, RenderedDocumentContent)

    _template = "markdown_validation_results_page.j2"

    def render(self, document, template=None, **kwargs):
        """
        Handle list as well as single document
        """
        if isinstance(document, list):
            # We need to keep this as super(DefaultMarkdownPageView, self); otherwise a wrong render will be called.
            return [
                super(DefaultMarkdownPageView, self).render(
                    document=d, template=template, **kwargs
                )
                for d in document
            ]

        else:
            return super().render(document=document, template=template, **kwargs)

    def render_string_template(self, template: pTemplate) -> pTemplate:
        """
        Render string for markdown rendering. Bold all parameters and perform substitution.
        Args:
            template: python Template object

        Returns:
            Template with substituted values and all parameters bolded

        """

        if not isinstance(template, (dict, OrderedDict)):
            return template

        # replace and render any horizontal lines using ***
        tag = template.get("tag", None)
        if tag and tag == "hr":
            template["template"] = "***"

        # if there are any groupings of two or more $, we need to double the groupings to account
        # for template string substitution escaping
        template["template"] = re.sub(
            r"\${2,}", lambda m: m.group(0) * 2, template.get("template", "")
        )

        # Bold all parameters:
        base_param_template_string = "**$content**"

        # Make sure template["params"] is a dict
        template["params"] = template.get("params", {})

        # TODO: Revisit handling of icons in markdown. E.g. inline rendered icons.
        if "markdown_status_icon" in template["params"]:
            return template["params"]["markdown_status_icon"]

        for parameter in template["params"].keys():
            if parameter == "html_success_icon":
                template["params"][parameter] = ""
                continue
            # to escape any values that are '*' which, when combined with bold ('**') in markdown,
            # does not give the output we want.
            elif template["params"][parameter] == "*":
                template["params"][parameter] = "\\*"
                continue

            template["params"][parameter] = pTemplate(
                base_param_template_string
            ).safe_substitute(
                {
                    "content": template["params"][parameter],
                }
            )

        template["template"] = template.get("template", "").replace(
            "$PARAMETER", "$$PARAMETER"
        )

        return pTemplate(template.get("template")).safe_substitute(
            template.get("params", {})
        )

    @contextfilter
    def render_content_block(
        self,
        jinja_context,
        content_block,
        index=None,
        content_block_id=None,
        render_to_markdown: bool = True,
    ):
        """
        Render a content block to markdown using jinja templates.
        Args:
            jinja_context:
            content_block:
            index:
            content_block_id:
            render_to_markdown: Default of True here instead of parent class default of False

        Returns:

        """

        return super().render_content_block(
            jinja_context=jinja_context,
            content_block=content_block,
            index=index,
            content_block_id=content_block_id,
            render_to_markdown=render_to_markdown,
        )
