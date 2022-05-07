      // These _MIN... and _MAX... constants are used at different
      // positions in the actual COLUMN_CONFIG data.
const _MIN_LINE_LENGTH_EN = 33
    , _MAX_LINE_LENGTH_EN = 65
    ;
export const COLUMN_CONFIG = {
    en: {
        // at minimal line length === 1
        // at maximal line length === 1.2
        // otherwise inbetween.
        // never smaller than 1
        // As long as we don't adjust YTRA min should be 5% that's 1 + 0.05.
        //
        // used as default for now
        // as a factor of font-size, actual value relative positioned to line-length
        // as shorter lines require shorter line-height.
      minLineHeight: 1.1
    , maxLineHeight: 1.3
        // Kind of a duplicate, could be calculated from
        // the "columns" setting.
    , minLineLength: _MIN_LINE_LENGTH_EN
    , maxLineLength: _MAX_LINE_LENGTH_EN
    , columns:[
            /* This will likely be dependent on the locale!
            * index 0 == columns 1
            * [minLineLength, maxLineLength, columnGap] in en
            * NOTE: for columnGap, it could be just 1em (2en, default in CSS),
            * but also for wider columns it can (and probably should) be wider.
            * Since 2 columns are more likely to be wider, I added a bit.
            * Otherwise, it would be good to have a better informed rule for that
            * as well, but it will be hard to calculate within this algorithm as
            * it is.
            */
          [ 0, _MAX_LINE_LENGTH_EN, 0]  // 1
        , [_MIN_LINE_LENGTH_EN, _MAX_LINE_LENGTH_EN, 3] // 2
        , [_MIN_LINE_LENGTH_EN, 50, 2.5] // 3
        , [_MIN_LINE_LENGTH_EN, 40, 2] // 4
        ]
    }
};

const STOPS_GRADE_ALINIA = [
    /* [fontSize, --grad-400, --grad-700] */
    [10,   0,   0]
  , [11,  -6,  -6]
  , [12,  -9, -10]
  , [13, -12, -15]
  , [14, -14, -20]
  , [15, -16, -30]
  , [16, -18, -38]
  , [17, -22, -43]
  , [18, -24, -54]
];



// funcName, animationName, props, stops
const CSS_KEYFRAME_FIXES = [
    // synth-sub must be first, as grade depends on
    // font-size and this changes font-size.
    ['grade', 'RobotoFlex-grad-by-font-size', ['--grad-400', '--grad-700'], STOPS_GRADE_ALINIA]
];

// FIXME: This is Copied from Roboto Flex
// Alina won't have weight/width/opsz axes so  here we
// skip all but the defalt weight/width/opsz values
const JUSTIFICATION_SPEC_ALINIA= {
    // weight
        // width
            // opsz
    // 1000: {
    //     100: {
    //         144: {XTRA: [458, 468, 473], tracking: [-0.8, 0, 0.5], wordspace: [96/144 - 1, 1 - 1/*144/144*/, 150/144 - 1]}
    //        , 14: {XTRA: [458, 468, 472], tracking: [-0.2, 0, 0.13], wordspace: [10/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
    //         // FIXME: PDF is not clear regarding XTRA: also [462, 468, 475]
    //        ,  8: {XTRA: [444, 468, 475], tracking: [-0.06, 0, 0.2], wordspace: [6/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
    //     }
    // }
    //,
  400: {
      //  151: {
      //      144: {XTRA: [455, 468, 479], tracking: [-0.3, 0, 0.5], wordspace: [118/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]}
      //      // FIXME: PDF is not clear regarding XTRA: also [450, 468, 471]
      //     , 14: {XTRA: [458, 468, 475], tracking: [-0.1, 0, 0.13], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 19/14 - 1]}
      //     ,  8: {XTRA: [462, 468, 475], tracking: [-0.06, 0, 0.2], wordspace: [7/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
      //  }
      //  // default reading text spec:
      //,
      100: {
        //    144: {XTRA: [460, 468, 471], tracking:[-0.5, 0, 0.5],  wordspace: [114/144 - 1, 1 - 1/*144/144*/, 192/144 - 1]}
        // ,
             14: {XTRA: [460, 468, 471], tracking:[-0.1, 0, 0.13],  wordspace: [12/14 - 1, 1 - 1/*14/14*/, 19/14 - 1]}
        //   ,  8: {XTRA: [462, 468, 475], tracking:[-0.06, 0, 0.2], wordspace: [7/8 - 1, 1 - 1 /*8/8*/,   14/8 - 1]}
        }
      //, 25: {
      //      // FIXME: PDF is not clear regarding wordspace: also: [120/144 - 1, 1 - 1/*144/144*/, 192/144 - 1]}
      //      // FIXME: PDF is not clear regarding XTRA: also: [466, 468, 473]
      //      144: {XTRA: [468, 468, 473], tracking: [-0.07, 0, 0.15], wordspace: [120/144 - 1, 1 - 1/*144/144*/, 168/144 - 1]}
      //      // FIXME: PDF is not clear regarding wordspace: also: [12/14 - 1, 1 - 1/*14/14*/, 19/14 - 1]}
      //     , 14: {XTRA: [463, 468, 472], tracking: [-0.1, 0, 0.13], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 16/14 - 1]}
      //      // FIXME: PDF is not clear regarding tracking: also: [-0.06, 0, 0.2]
      //     ,  8: {XTRA: [464, 468, 475], tracking: [0, 0, 0.2], wordspace: [7/8 - 1, 1 - 1/*8/8*/, 10/8 - 1]}
      //  }
    }
  //, 100: {
  //      100: {
  //          144: {XTRA: [460, 468, 473], tracking: [-0.3, 0, 0.65], wordspace: [126/144 - 1, 1 - 1/*144/144*/, 216/144 - 1]}
  //         // FIXME: PDF is not clear regarding XTRA, also: [458, 468, 471]
  //         , 14: {XTRA: [458, 468, 472], tracking: [-0.1, 0, 0.13], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 20/14 - 1]}
  //         // FIXME: PDF is not clear regarding tracking, also: [-0.04, 0, 0.2]
  //         ,  8: {XTRA: [460, 468, 471], tracking: [-0.03, 0, 0.16], wordspace: [8/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
  //      }
  //  }
};

const JUSTIFICATION_SPECS = {
    Alinia: JUSTIFICATION_SPEC_ALINIA
};

// This is a stub, it's not taking into account e.g. font-size
// etc. because we just use it so far for main headlines.
// FIXME: for h1/type "main" we use only:
//          --line-handling-direction: "narrowing";
// Hence, widening with these values is not confirmed
// to be good.
const WDTH_JUSTIFICATION_SPECS = {
    // RobotFlex: axis goes down to 25 and up to 151
    Alinia: [35, 151 /* we don't use wdth widening so far*/]
};

export const typeSpec = {
      columnConfig: COLUMN_CONFIG
    , justificationSpecs: JUSTIFICATION_SPECS
    , wdthJustificationSpecs: WDTH_JUSTIFICATION_SPECS
    , cssKeyframeFixes: CSS_KEYFRAME_FIXES
};
