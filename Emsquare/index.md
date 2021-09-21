---
title: Emsquare — Main Articles
layout: default
class: content-page
modules:
    - "Emsquare/Volume-01/js/main.mjs"
styles:
    - "explorations/wikipedia/css/varla-varfo.css"
    - "explorations/wikipedia/css/widgets.css"
    - "Emsquare/Volume-01/main.css"
---
{% assign path_parts = page.path | split: "/" %}
{% assign dir = path_parts | pop | join: "/" %}
{% assign dir_size = dir | size %}

# {{page.title}}

{% assign pages = site.pages | sort_natural: "path"%}
{% for article in pages %}
    {%- assign test_path = article.path | slice: 0, dir_size -%}
    {%- assign article_path_parts = article.path | split: "/" -%}
    {%- assign article_filename = article_path_parts[-1] -%}
    {%- if article.path == page.path or test_path != dir or article_filename != "Main-Article.md" -%}
        {% continue -%}
    {%- endif -%}
{%- assign _volume_path_part = article_path_parts[-3] -%}
{%- capture volume -%}{%- include get-number subject=_volume_path_part -%}{%- endcapture -%}
{%- assign _issue_path_part = article_path_parts[-2] -%}
{%- capture issue -%}{%- include get-number subject=_issue_path_part -%}{%- endcapture -%}
* Volume {{volume}}, Issue {{issue}}: [{{article.title}}]({{article.url | relative_url }})
{% endfor -%}
* [Portal Testing Page](/varla-varfo/explorations/portals/)
