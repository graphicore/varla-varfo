{% comment %}
Very specific for articles.
{% endcomment %}
{%- assign prev = false -%}
{%- assign next = false -%}
{%- assign found_self = false -%}
{%- assign path_parts = page.path | split: "/" -%}
{%- assign dir = path_parts | pop | pop | join: "/" -%}
{%- assign dir_size = dir | size -%}
{%- assign pages = site.pages | sort_natural: "path" -%}
{%- for article in pages -%}
    {%- assign test_path = article.path | slice: 0, dir_size -%}
    {%- assign article_path_parts = article.path | split: "/" -%}
    {%- assign article_filename = article_path_parts[-1] -%}
    {%- if test_path != dir or article_filename != "Main-Article.md" -%}
        {%- continue -%}
    {%- endif -%}
    {%- if article.path == page.path -%}
        {%- assign found_self = true -%}
        {%- assign prev = last -%}
        {%- continue -%}
    {% elsif found_self == true %}
        {%- assign next = article -%}
        {%- break -%}
    {%- endif -%}
    {%- assign last = article -%}
{%- endfor -%}
{%- assign links = "" | split: "" -%}
{% assign links = links | push: prev %}
{% assign links = links | push: next %}
{%- for article in links -%}
    {%- unless article -%}
        {%- continue -%}
    {%- endunless  -%}
    {%- if article.url == prev.url -%}
        {%- assign label = "Previous" -%}
    {%- else -%}
        {%- assign label = "Next" -%}
    {%- endif -%}
    {%- assign _path_parts = article.path | split: "/" -%}
    {%- assign _volume_path_part = _path_parts[-3] -%}
    {%- capture _volume -%}{%- include get-number subject=_volume_path_part -%}{%- endcapture -%}
    {%- assign _issue_path_part = _path_parts[-2] -%}
    {%- capture _issue -%}{%- include get-number subject=_issue_path_part -%}{%- endcapture -%}
{% increment counter %}. {{label}}  [Volume&nbsp;{{_volume}}&nbsp;— Issue&nbsp;{{_issue}}: {{article.title}}]({{article.url | relative_url}})
{%- endfor -%}
