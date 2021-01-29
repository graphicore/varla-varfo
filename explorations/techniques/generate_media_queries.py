#! /usr/bin/env python3

"""
    usage:
        $ ./generate_media_queries.py > variations.generated.css
"""


def print_media_queries(minSize, maxSize, step):

    print(f"""\
:root {{
    --animation-position-mediaq: {minSize}
}}""")
    for pos in range(minSize + step, maxSize + step, step):
        # max-width means: equal or narrower
        # min-width means: equal or wider
        print(f"""\
@media (min-width: {pos}px) {{
    :root {{
        --animation-position-mediaq: {pos}
    }}
}}""")

if __name__ == '__main__':
    print_media_queries(400, 1400, 100)
