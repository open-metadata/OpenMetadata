/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { Button } from "antd";
import classNames from "classnames";
import { FC, useEffect, useMemo, useState } from "react";
import { PreviewerProp } from "./RichTextEditor.interface";
import "./rich-text-editor-previewerV1.less";

const RichTextEditorPreviewerV1: FC<PreviewerProp> = ({
  markdown = "",
  className = "",
  enableSeeMoreVariant = true,
  textVariant = "black",
  showReadMoreBtn = true,
  maxLength = 150,
  isDescriptionExpanded = false,
  reducePreviewLineClass,
  i18n,
}) => {
  const [content, setContent] = useState<string>("");
  const [isExpanded, setIsExpanded] = useState<boolean>(isDescriptionExpanded);

  // Default translation function if none provided
  const translate = (
    key: string,
    options?: Record<string, unknown>
  ): string => {
    if (i18n) {
      return i18n(key, options);
    }
    // Fallback to English defaults
    const defaults: Record<string, string> = {
      "label.no-description": "No description",
      "label.less-lowercase": "less",
      "label.more-lowercase": "more",
    };
    return defaults[key] || key;
  };

  useEffect(() => {
    setContent(markdown);
  }, [markdown]);

  const { contentToRender, isReadMoreBtnVisible } = useMemo(() => {
    if (!enableSeeMoreVariant) {
      return {
        contentToRender: content,
        isReadMoreBtnVisible: false,
      };
    }

    if (content.length <= maxLength) {
      return {
        contentToRender: content,
        isReadMoreBtnVisible: false,
      };
    }

    if (isExpanded) {
      return {
        contentToRender: content,
        isReadMoreBtnVisible: true,
      };
    }

    return {
      contentToRender: content.substring(0, maxLength),
      isReadMoreBtnVisible: true,
    };
  }, [content, maxLength, isExpanded, enableSeeMoreVariant]);

  const handleReadMoreClick = () => {
    setIsExpanded(!isExpanded);
  };

  if (!content) {
    return (
      <div className={classNames("rich-text-editor-previewer", className)}>
        <span className="text-grey-muted">
          {translate("label.no-description")}
        </span>
      </div>
    );
  }

  return (
    <div className={classNames("rich-text-editor-previewer", className)}>
      <div
        className={classNames("content", {
          "content-expanded": isExpanded,
          "content-collapsed": !isExpanded,
          "reduce-preview-lines": reducePreviewLineClass,
        })}
        data-testid="rich-text-editor-previewer"
      >
        <div
          className={classNames("markdown-parser", textVariant)}
          dangerouslySetInnerHTML={{ __html: contentToRender }}
        />
      </div>
      {showReadMoreBtn && isReadMoreBtnVisible && (
        <Button
          className="read-more-button"
          data-testid="read-more-button"
          type="link"
          onClick={handleReadMoreClick}
        >
          {isExpanded
            ? translate("label.less-lowercase")
            : translate("label.more-lowercase")}
        </Button>
      )}
    </div>
  );
};

export default RichTextEditorPreviewerV1;
