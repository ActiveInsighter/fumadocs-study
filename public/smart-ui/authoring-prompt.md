# Fumadocs 文档写作约定（官方组件版）

这份文件是站点 Markdown 接入说明；组件及属性直接来自官方 @json-render/shadcn。官方原始 JSONL 提示词另见 /smart-ui/upstream-prompt.md。

1. 输出中文 Markdown；交互块使用 ```json-render 围栏，里面放完整的 JSON spec（不是 JSONL patches），不输出 import、JSX 或 JavaScript。

2. 目录提供官方 @json-render/shadcn 的 36 个组件；按学习内容选用必要组件，不要求每篇或每块全部展示。使用原始属性。每个 spec 包含 root、elements、state；每个元素包含 type、props、children。可空属性使用 null，不能改用旧版 Choice、MemoryAddress 或 Progress.values。

3. 使用官方 $state 读取状态、$bindState 双向绑定、$template 拼接文字、$cond/$then/$else 选择属性值，以及元素级 visible 条件。状态路径使用 JSON Pointer。每块状态独立，刷新或重置会恢复。

4. 交互使用官方内置 setState、pushState、removeState、validateForm 动作，放在元素级 on 中，并使用官方组件声明的事件；不调用网络或自定义动作。文档模式不使用 repeat、watch、$computed 或自定义脚本。

5. Tabs 绑定 value 后，通过各子元素的 visible 条件选择内容；Dialog/Drawer 的 openPath 指向布尔状态，再用 Button 的 setState 打开。不要生成不存在的 TabsContent 组件。

6. 使用官方内置 variant；布局类只用于 Card/Stack/Grid 的 className，例如 grid-cols-1 sm:grid-cols-2。颜色、字体、圆角沿用站点主题，不写固定颜色。Input/Checkbox/Radio 等 name 在整篇文档内唯一。

7. 交互块默认用纵向 Stack（align: stretch）作为根；标题放在正文中，避免重复标题和卡片套卡片。Table 使用短表头，长字段用换行分开；不要把表格横向滚动当成手机适配。Progress 统计实际完成度，不用专注时长冒充完成进度。

8. 每块最多 100 个元素，深度不超过 20，JSON 不超过 100 KB。正文保留题目、答案和解释。图片和链接只使用站内路径或 HTTPS 地址。

## 官方组件目录

{
  "Card": {
    "description": "Container card for content sections. Use for forms/content boxes, NOT for page headers.",
    "children": true,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "description": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "maxWidth": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "sm",
                "md",
                "lg",
                "full"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "centered": {
          "anyOf": [
            {
              "type": "boolean"
            },
            {
              "type": "null"
            }
          ]
        },
        "className": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "description": "Additional CSS classes"
        }
      },
      "required": [
        "title",
        "description",
        "maxWidth",
        "centered",
        "className"
      ],
      "additionalProperties": false
    }
  },
  "Stack": {
    "description": "Flex container for layouts",
    "children": true,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "direction": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "horizontal",
                "vertical"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "gap": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "none",
                "sm",
                "md",
                "lg",
                "xl"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "align": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "start",
                "center",
                "end",
                "stretch"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "justify": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "start",
                "center",
                "end",
                "between",
                "around"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "className": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "description": "Additional CSS classes"
        }
      },
      "required": [
        "direction",
        "gap",
        "align",
        "justify",
        "className"
      ],
      "additionalProperties": false
    }
  },
  "Grid": {
    "description": "Grid layout (1-6 columns)",
    "children": true,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "columns": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "null"
            }
          ]
        },
        "gap": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "sm",
                "md",
                "lg",
                "xl"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "className": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "description": "Additional CSS classes"
        }
      },
      "required": [
        "columns",
        "gap",
        "className"
      ],
      "additionalProperties": false
    }
  },
  "Separator": {
    "description": "Visual separator line",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "orientation": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "horizontal",
                "vertical"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "orientation"
      ],
      "additionalProperties": false
    }
  },
  "Tabs": {
    "description": "Tab navigation. Use { $bindState } on value for active tab binding.",
    "children": true,
    "events": [
      "change"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "tabs": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "label": {
                "type": "string"
              },
              "value": {
                "type": "string"
              }
            },
            "required": [
              "label",
              "value"
            ],
            "additionalProperties": false
          }
        },
        "defaultValue": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "value": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "tabs",
        "defaultValue",
        "value"
      ],
      "additionalProperties": false
    }
  },
  "Accordion": {
    "description": "Collapsible sections. Items as [{title, content}]. Type 'single' (default) or 'multiple'.",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": {
                "type": "string"
              },
              "content": {
                "type": "string"
              }
            },
            "required": [
              "title",
              "content"
            ],
            "additionalProperties": false
          }
        },
        "type": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "single",
                "multiple"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "items",
        "type"
      ],
      "additionalProperties": false
    }
  },
  "Collapsible": {
    "description": "Collapsible section with trigger. Children render inside.",
    "children": true,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string"
        },
        "defaultOpen": {
          "anyOf": [
            {
              "type": "boolean"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "title",
        "defaultOpen"
      ],
      "additionalProperties": false
    }
  },
  "Dialog": {
    "description": "Modal dialog. Set openPath to a boolean state path. Use setState to toggle.",
    "children": true,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string"
        },
        "description": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "openPath": {
          "type": "string"
        }
      },
      "required": [
        "title",
        "description",
        "openPath"
      ],
      "additionalProperties": false
    }
  },
  "Drawer": {
    "description": "Bottom sheet drawer. Set openPath to a boolean state path. Use setState to toggle.",
    "children": true,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string"
        },
        "description": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "openPath": {
          "type": "string"
        }
      },
      "required": [
        "title",
        "description",
        "openPath"
      ],
      "additionalProperties": false
    }
  },
  "Carousel": {
    "description": "Horizontally scrollable carousel of cards.",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "title": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "description": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "title",
              "description"
            ],
            "additionalProperties": false
          }
        }
      },
      "required": [
        "items"
      ],
      "additionalProperties": false
    }
  },
  "Table": {
    "description": "Data table. columns: header labels. rows: 2D array of cell strings, e.g. [[\"Alice\",\"admin\"],[\"Bob\",\"user\"]].",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "columns": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "rows": {
          "type": "array",
          "items": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "caption": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "columns",
        "rows",
        "caption"
      ],
      "additionalProperties": false
    }
  },
  "Heading": {
    "description": "Heading text (h1-h4)",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "text": {
          "type": "string"
        },
        "level": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "h1",
                "h2",
                "h3",
                "h4"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "text",
        "level"
      ],
      "additionalProperties": false
    }
  },
  "Text": {
    "description": "Paragraph text",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "text": {
          "type": "string"
        },
        "variant": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "body",
                "caption",
                "muted",
                "lead",
                "code"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "text",
        "variant"
      ],
      "additionalProperties": false
    }
  },
  "Image": {
    "description": "Image component. Renders an img tag when src is provided, otherwise a placeholder.",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "src": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "alt": {
          "type": "string"
        },
        "width": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "null"
            }
          ]
        },
        "height": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "src",
        "alt",
        "width",
        "height"
      ],
      "additionalProperties": false
    }
  },
  "Avatar": {
    "description": "User avatar with fallback initials",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "src": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "name": {
          "type": "string"
        },
        "size": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "sm",
                "md",
                "lg"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "src",
        "name",
        "size"
      ],
      "additionalProperties": false
    }
  },
  "Badge": {
    "description": "Status badge",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "text": {
          "type": "string"
        },
        "variant": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "default",
                "secondary",
                "destructive",
                "outline"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "text",
        "variant"
      ],
      "additionalProperties": false
    }
  },
  "Alert": {
    "description": "Alert banner",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "title": {
          "type": "string"
        },
        "message": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "type": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "info",
                "success",
                "warning",
                "error"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "title",
        "message",
        "type"
      ],
      "additionalProperties": false
    }
  },
  "Progress": {
    "description": "Progress bar (value 0-100)",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "value": {
          "type": "number"
        },
        "max": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "null"
            }
          ]
        },
        "label": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "value",
        "max",
        "label"
      ],
      "additionalProperties": false
    }
  },
  "Skeleton": {
    "description": "Loading placeholder skeleton",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "width": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "height": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "rounded": {
          "anyOf": [
            {
              "type": "boolean"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "width",
        "height",
        "rounded"
      ],
      "additionalProperties": false
    }
  },
  "Spinner": {
    "description": "Loading spinner indicator",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "size": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "sm",
                "md",
                "lg"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "label": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "size",
        "label"
      ],
      "additionalProperties": false
    }
  },
  "Tooltip": {
    "description": "Hover tooltip. Shows content on hover over text.",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "content": {
          "type": "string"
        },
        "text": {
          "type": "string"
        }
      },
      "required": [
        "content",
        "text"
      ],
      "additionalProperties": false
    }
  },
  "Popover": {
    "description": "Popover that appears on click of trigger.",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "trigger": {
          "type": "string"
        },
        "content": {
          "type": "string"
        }
      },
      "required": [
        "trigger",
        "content"
      ],
      "additionalProperties": false
    }
  },
  "Input": {
    "description": "Text input field. Use { $bindState } on value for two-way binding. Use checks for validation (e.g. required, email, minLength). validateOn controls timing (default: blur).",
    "children": false,
    "events": [
      "submit",
      "focus",
      "blur"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "type": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "text",
                "email",
                "password",
                "number"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "placeholder": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "value": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "checks": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string"
                  },
                  "message": {
                    "type": "string"
                  },
                  "args": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "message"
                ],
                "additionalProperties": false
              }
            },
            {
              "type": "null"
            }
          ]
        },
        "validateOn": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "change",
                "blur",
                "submit"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "name",
        "type",
        "placeholder",
        "value",
        "checks",
        "validateOn"
      ],
      "additionalProperties": false
    }
  },
  "Textarea": {
    "description": "Multi-line text input. Use { $bindState } on value for binding. Use checks for validation. validateOn controls timing (default: blur).",
    "children": false,
    "events": [],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "placeholder": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "rows": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "null"
            }
          ]
        },
        "value": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "checks": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string"
                  },
                  "message": {
                    "type": "string"
                  },
                  "args": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "message"
                ],
                "additionalProperties": false
              }
            },
            {
              "type": "null"
            }
          ]
        },
        "validateOn": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "change",
                "blur",
                "submit"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "name",
        "placeholder",
        "rows",
        "value",
        "checks",
        "validateOn"
      ],
      "additionalProperties": false
    }
  },
  "Select": {
    "description": "Dropdown select input. Use { $bindState } on value for binding. Use checks for validation. validateOn controls timing (default: change).",
    "children": false,
    "events": [
      "change"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "options": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "placeholder": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "value": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "checks": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string"
                  },
                  "message": {
                    "type": "string"
                  },
                  "args": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "message"
                ],
                "additionalProperties": false
              }
            },
            {
              "type": "null"
            }
          ]
        },
        "validateOn": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "change",
                "blur",
                "submit"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "name",
        "options",
        "placeholder",
        "value",
        "checks",
        "validateOn"
      ],
      "additionalProperties": false
    }
  },
  "Checkbox": {
    "description": "Checkbox input. Use { $bindState } on checked for binding. Use checks for validation. validateOn controls timing (default: change).",
    "children": false,
    "events": [
      "change"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "checked": {
          "anyOf": [
            {
              "type": "boolean"
            },
            {
              "type": "null"
            }
          ]
        },
        "checks": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string"
                  },
                  "message": {
                    "type": "string"
                  },
                  "args": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "message"
                ],
                "additionalProperties": false
              }
            },
            {
              "type": "null"
            }
          ]
        },
        "validateOn": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "change",
                "blur",
                "submit"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "name",
        "checked",
        "checks",
        "validateOn"
      ],
      "additionalProperties": false
    }
  },
  "Radio": {
    "description": "Radio button group. Use { $bindState } on value for binding. Use checks for validation. validateOn controls timing (default: change).",
    "children": false,
    "events": [
      "change"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "options": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "value": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "checks": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string"
                  },
                  "message": {
                    "type": "string"
                  },
                  "args": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "message"
                ],
                "additionalProperties": false
              }
            },
            {
              "type": "null"
            }
          ]
        },
        "validateOn": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "change",
                "blur",
                "submit"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "name",
        "options",
        "value",
        "checks",
        "validateOn"
      ],
      "additionalProperties": false
    }
  },
  "Switch": {
    "description": "Toggle switch. Use { $bindState } on checked for binding. Use checks for validation. validateOn controls timing (default: change).",
    "children": false,
    "events": [
      "change"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "checked": {
          "anyOf": [
            {
              "type": "boolean"
            },
            {
              "type": "null"
            }
          ]
        },
        "checks": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": {
                    "type": "string"
                  },
                  "message": {
                    "type": "string"
                  },
                  "args": {
                    "type": "object",
                    "propertyNames": {
                      "type": "string"
                    },
                    "additionalProperties": {}
                  }
                },
                "required": [
                  "type",
                  "message"
                ],
                "additionalProperties": false
              }
            },
            {
              "type": "null"
            }
          ]
        },
        "validateOn": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "change",
                "blur",
                "submit"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "name",
        "checked",
        "checks",
        "validateOn"
      ],
      "additionalProperties": false
    }
  },
  "Slider": {
    "description": "Range slider input. Use { $bindState } on value for binding.",
    "children": false,
    "events": [
      "change"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        },
        "min": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "null"
            }
          ]
        },
        "max": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "null"
            }
          ]
        },
        "step": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "null"
            }
          ]
        },
        "value": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "min",
        "max",
        "step",
        "value"
      ],
      "additionalProperties": false
    }
  },
  "Button": {
    "description": "Clickable button. Bind on.press for handler.",
    "children": false,
    "events": [
      "press"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "type": "string"
        },
        "variant": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "primary",
                "secondary",
                "danger"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "disabled": {
          "anyOf": [
            {
              "type": "boolean"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "variant",
        "disabled"
      ],
      "additionalProperties": false
    }
  },
  "Link": {
    "description": "Anchor link. Bind on.press for click handler.",
    "children": false,
    "events": [
      "press"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "type": "string"
        },
        "href": {
          "type": "string"
        }
      },
      "required": [
        "label",
        "href"
      ],
      "additionalProperties": false
    }
  },
  "DropdownMenu": {
    "description": "Dropdown menu with trigger button and selectable items. Use { $bindState } on value for selected item binding.",
    "children": false,
    "events": [
      "select"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "type": "string"
        },
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "label": {
                "type": "string"
              },
              "value": {
                "type": "string"
              }
            },
            "required": [
              "label",
              "value"
            ],
            "additionalProperties": false
          }
        },
        "value": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "items",
        "value"
      ],
      "additionalProperties": false
    }
  },
  "Toggle": {
    "description": "Toggle button. Use { $bindState } on pressed for state binding.",
    "children": false,
    "events": [
      "change"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "label": {
          "type": "string"
        },
        "pressed": {
          "anyOf": [
            {
              "type": "boolean"
            },
            {
              "type": "null"
            }
          ]
        },
        "variant": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "default",
                "outline"
              ]
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "label",
        "pressed",
        "variant"
      ],
      "additionalProperties": false
    }
  },
  "ToggleGroup": {
    "description": "Group of toggle buttons. Type 'single' (default) or 'multiple'. Use { $bindState } on value.",
    "children": false,
    "events": [
      "change"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "label": {
                "type": "string"
              },
              "value": {
                "type": "string"
              }
            },
            "required": [
              "label",
              "value"
            ],
            "additionalProperties": false
          }
        },
        "type": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "single",
                "multiple"
              ]
            },
            {
              "type": "null"
            }
          ]
        },
        "value": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "items",
        "type",
        "value"
      ],
      "additionalProperties": false
    }
  },
  "ButtonGroup": {
    "description": "Segmented button group. Use { $bindState } on selected for selected value.",
    "children": false,
    "events": [
      "change"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "buttons": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "label": {
                "type": "string"
              },
              "value": {
                "type": "string"
              }
            },
            "required": [
              "label",
              "value"
            ],
            "additionalProperties": false
          }
        },
        "selected": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "buttons",
        "selected"
      ],
      "additionalProperties": false
    }
  },
  "Pagination": {
    "description": "Page navigation. Use { $bindState } on page for current page number.",
    "children": false,
    "events": [
      "change"
    ],
    "props": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "properties": {
        "totalPages": {
          "type": "number"
        },
        "page": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [
        "totalPages",
        "page"
      ],
      "additionalProperties": false
    }
  }
}

## 可运行例子

```json-render
{
  "root": "root",
  "elements": {
    "root": {
      "type": "Stack",
      "props": {
        "direction": "vertical",
        "gap": "lg",
        "align": "stretch",
        "justify": null,
        "className": null
      },
      "children": [
        "context",
        "question",
        "actions",
        "correct",
        "wrong",
        "explanation"
      ]
    },
    "context": {
      "type": "Text",
      "props": {
        "variant": "body",
        "text": "直接映射 Cache：每块 16 B，共 8 行。比较字节地址 52 和 180。"
      },
      "children": []
    },
    "question": {
      "type": "Radio",
      "props": {
        "value": {
          "$bindState": "/answer"
        },
        "checks": null,
        "validateOn": null,
        "label": "这两个地址的内存块会映射到哪里？",
        "name": "cache-quiz-answer",
        "options": [
          "同一行，属于冲突块",
          "不同行，互不影响"
        ]
      },
      "children": [],
      "on": {
        "change": {
          "action": "setState",
          "params": {
            "statePath": "/submitted",
            "value": false
          }
        }
      }
    },
    "actions": {
      "type": "Stack",
      "props": {
        "direction": "horizontal",
        "gap": "sm",
        "align": "center",
        "justify": null,
        "className": null
      },
      "children": [
        "submit",
        "open-explanation"
      ]
    },
    "submit": {
      "type": "Button",
      "props": {
        "variant": "primary",
        "disabled": {
          "$cond": {
            "$state": "/answer",
            "eq": ""
          },
          "$then": true,
          "$else": false
        },
        "label": "检查答案"
      },
      "children": [],
      "on": {
        "press": {
          "action": "setState",
          "params": {
            "statePath": "/submitted",
            "value": true
          }
        }
      }
    },
    "open-explanation": {
      "type": "Button",
      "props": {
        "variant": "secondary",
        "disabled": null,
        "label": "查看推导"
      },
      "children": [],
      "on": {
        "press": {
          "action": "setState",
          "params": {
            "statePath": "/explanation",
            "value": true
          }
        }
      }
    },
    "correct": {
      "type": "Alert",
      "props": {
        "message": "52 的块号是 3，180 的块号是 11；3 mod 8 与 11 mod 8 都等于 3。它们的标记不同，所以会发生冲突。",
        "type": "success",
        "title": "判断正确：都映射到第 3 行"
      },
      "children": [],
      "visible": [
        {
          "$state": "/submitted",
          "eq": true
        },
        {
          "$state": "/answer",
          "eq": "同一行，属于冲突块"
        }
      ]
    },
    "wrong": {
      "type": "Alert",
      "props": {
        "message": "先用地址除以块大小取整，得到内存块号；再对 Cache 行数取模。不能直接拿地址对行数取模来判断块的映射。",
        "type": "warning",
        "title": "再检查一次“行号”的计算"
      },
      "children": [],
      "visible": [
        {
          "$state": "/submitted",
          "eq": true
        },
        {
          "$state": "/answer",
          "eq": "不同行，互不影响"
        }
      ]
    },
    "explanation": {
      "type": "Dialog",
      "props": {
        "description": "字节地址 → 内存块号 → Cache 行号",
        "title": "从地址推到 Cache 行号",
        "openPath": "/explanation"
      },
      "children": [
        "formula",
        "calculation",
        "conclusion"
      ]
    },
    "formula": {
      "type": "Text",
      "props": {
        "variant": "code",
        "text": "内存块号 = ⌊地址 / 16⌋\n行号 = 内存块号 mod 8"
      },
      "children": []
    },
    "calculation": {
      "type": "Text",
      "props": {
        "variant": null,
        "text": "地址 52：块号 3，行号 3，块内偏移 4 B。\n地址 180：块号 11，行号 3，块内偏移 4 B。"
      },
      "children": []
    },
    "conclusion": {
      "type": "Text",
      "props": {
        "variant": null,
        "text": "结论：偏移相同、行号相同，但不是同一个内存块。"
      },
      "children": []
    }
  },
  "state": {
    "answer": "",
    "submitted": false,
    "explanation": false
  }
}
```

随后根据用户主题和材料输出完整文档。
