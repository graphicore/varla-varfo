#! /usr/bin/env python3

"""
Explore the behavior of the original varla-varfo runion_01
"""

      # These _MIN... and _MAX... constants are used at different
      # positions in the actual COLUMN_CONFIG data.
_MIN_LINE_LENGTH_EN = 33
_MAX_LINE_LENGTH_EN = 65
COLUMN_CONFIG = {
    "en": {
        # at minimal line length === 1
        # at maximal line length === 1.2
        # otherwise inbetween.
        # never smaller than 1
        # As long as we don't adjust YTRA min should be 5% that's 1 + 0.05.
        #
        # used as default for now
        # as a factor of font-size, actual value relative positioned to line-length
        # as shorter lines require shorter line-height.
      "minLineHeight": 1.1
    , "maxLineHeight": 1.3
        # Kind of a duplicate, could be calculated from
        # the "columns" setting.
    , "minLineLength": _MIN_LINE_LENGTH_EN
    , "maxLineLength": _MAX_LINE_LENGTH_EN
    , "columns":[
            # This will likely be dependent on the locale!
            # index 0 == columns 1
            # [minLineLength, maxLineLength, columnGap] in en
            # NOTE: for columnGap, it could be just 1em (2en, default in CSS),
            # but also for wider columns it can (and probably should) be wider.
            # Since 2 columns are more likely to be wider, I added a bit.
            # Otherwise, it would be good to have a better informed rule for that
            # as well, but it will be hard to calculate within this algorithm as
            # it is.
          [ 0, _MAX_LINE_LENGTH_EN, 0]  # 1
        , [_MIN_LINE_LENGTH_EN, _MAX_LINE_LENGTH_EN, 3] # 2
        , [_MIN_LINE_LENGTH_EN, 50, 2.5] # 3
        , [_MIN_LINE_LENGTH_EN, 40, 2] # 4
        ]
    }
}

def _runion_01_columns(columnConfig, availableWidthEn):
    # TODO: Could be cool to configure the unknowns via the testing rig.
    # Would need to reach into the window, could, for that matter, also
    # be done by the user-settings dialogue however, this is not meant
    # to be an end-user-facing setting, just a tool to get the algorithm
    # dialed in.

    for columns in range(1, len(columnConfig) + 1):
        [minLineLength, maxLineLength, columnGapEn] = columnConfig[columns-1]
        # NOTE: there's (yet?) no default left/right padding, but the
        # compose function expects these. If there's such a thing in
        # the future, also look at the padding case below!
        paddingLeftEn = 0
        paddingRightEn = 0
        gaps = columns - 1
        lineLengthEn = (availableWidthEn - (gaps * columnGapEn)) / columns

        if lineLengthEn > minLineLength and lineLengthEn <= maxLineLength:
            # compose
            return [columns, lineLengthEn, columnGapEn, paddingLeftEn, paddingRightEn]

    # Add padding, we don’t use more than the configured columns.
    for columns in range(len(columnConfig), 0, -1):
        [minLineLength, maxLineLength, columnGapEn] = columnConfig[columns-1]
        gaps = columns - 1
        lineLengthEn = (availableWidthEn - (gaps * columnGapEn)) / columns

        if lineLengthEn <= minLineLength:
            continue # use less columns
        # line length is > maxLineLength because we already figured in
        # the first run that it is *NOT*: lineLengthEn > minLineLength && lineLengthEn <= maxLineLength
        lineLengthEn = maxLineLength

        # CAUTION, if at some point there's a default left/right padding for a column
        # setup, it must be included in the respective paddingLeftEn/paddingRightEn
        # value before distributing the rest.
        paddingEn = availableWidthEn - (lineLengthEn * columns) - (gaps * columnGapEn)
            # Another strategy could be e.g. to distribute the padding to the right only.
        paddingLeftEn = paddingEn * 3/5
        paddingRightEn = paddingEn * 2/5

        # compose
        return [columns, lineLengthEn, columnGapEn, paddingLeftEn, paddingRightEn]

    # With a proper config this should not be possible (1 column min-width = 0),
    # thus, if this happens we must look at the case and figure out what to do.
    raise Exception(f'Can\'t compose column setup for availableWidthEn: {availableWidthEn}!')


def _runion_01_lineHeight (colConfig, lineLengthEn):
    [minLineHeight, maxLineHeight, minLineLength, maxLineLength
        ] = [colConfig["minLineHeight"], colConfig["maxLineHeight"],
             colConfig["minLineLength"], colConfig["maxLineLength"]]

    lineLengthPos = lineLengthEn - minLineLength
    lineLengthRange = maxLineLength - minLineLength
    ratio = lineLengthPos / lineLengthRange
    raw = minLineHeight + ((maxLineHeight-minLineHeight) * ratio)

    return min(maxLineHeight, max(minLineHeight, raw))


# Characters per line runion
def runion_01 (columnConfig, widthPx, emInPx):
        # NOTE: rounding errors made e.g. 4-column layouts appear as
        # 3-columns. The CSS-columns property can't be forced to a definite
        # column-count, it's rather a recommendation for a max-column-count.
        # This creates "room for error", 5px was determined by trying out.
        # A fail is when _runion_01_columns returns e.g. a 4 columns setting
        # but the browser shows 3 columns.
        # FIXME: I can't reproduce this anymore, hence no compensation
        # anymore. It could be that element.clientWidth returns a rounded
        # value and I switched it to element.getBoundingClientRect() which
        # does not round. It's also better when this is precise, because
        # then it is better suited to estimate actual line-length.
    enInPx = emInPx / 2
    compensateForError = 0
    availableWidthEn = (widthPx - compensateForError) / enInPx
    [columns, lineLengthEn, columnGapEn, paddingLeftEn,
                paddingRightEn] = _runion_01_columns(columnConfig["columns"], availableWidthEn)
    lineHeight = _runion_01_lineHeight(columnConfig, lineLengthEn)

    return [columns, lineLengthEn, columnGapEn, paddingLeftEn, paddingRightEn
          , lineHeight]

if __name__ == '__main__':
    emPx = 16

    x = []
    ys = []

    for widthPx in range(0, 2400):
        widthEm = widthPx/emPx
        widthEn = widthEm * 2
        x.append(widthEn)
        try:
            result = runion_01 (COLUMN_CONFIG["en"], widthPx, emPx)
            print(f'{widthPx}px ({widthEm}em, {widthEn}en):', result)
        except Exception as e:
            print(f'{widthPx}px: (Exception)', e)
            result = [0] * 6
        ys.append(result)

    import matplotlib.pyplot as plt
    import numpy as np

    plt.style.use('_mpl-gallery')


    [columns, lineLengthEn, columnGapEn, paddingLeftEn, paddingRightEn
                                , lineHeight] = zip(*ys)

    #    plot
    fig, ax = plt.subplots(1, 1)
    ax.plot(x, lineLengthEn, linewidth=2.0, label="lineLengthEn")
    ax.plot(x, columnGapEn, linewidth=2.0, label="columnGapEn")
    ax.plot(x, paddingLeftEn, linewidth=2.0, label="paddingLeftEn")
    ax.plot(x, paddingRightEn, linewidth=2.0, label="paddingRightEn")

    plt.legend()
    plt.show()


