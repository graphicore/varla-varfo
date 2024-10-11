      // These _MIN... and _MAX... constants are used at different
      // positions in the actual COLUMN_CONFIG data.


export const DFLT = Symbol('DFLT')

// keys order COLUMN_CONFIG.{script}.{language}.{teritorry}
// where each level should have a DFLT key,
// The children of a DFLT key should not have a none DFLT key
// as it's e.g. strange to not know the script but define a specific
// language, but that could change when we do more internationalization.
export const COLUMN_CONFIG_I18N = {};

/**
 * sanity checks that under a DFLT tag no not DFLT tag is located
 * always returns an array of three items.
 */
function normalizeLocale(script, language, territory) {
    if(!territory)
        territory = DFLT;
    if(!language)
        language = DFLT;
    if(!script) {
        // NOTE we could use CLDR data to figure out a script for the
        // language! But we do this in parseLocale already...
        script = DFLT
    }
    return [script, language, territory];
}

function validateLocale(script, language, territory) {
    if(script === DFLT && language !== DFLT)
        throw new Error(`LOCALE ERROR a language is defined but script is DFLT, language: `
            + `"${language.toString()}" (territory: "${territory.toString()}")`);

     if(language === DFLT && territory !== DFLT)
        throw new Error(`LOCALE ERROR a territory is defined but language is DFLT, territory: `
            + `"${territory.toString()}" (script: "${script.toString()}")`);

    return [script, language, territory];
}

// Using a helper function so we can have flatter data definitions and
// some sanity control.
function addToI18NConfig(config, locale, data) {
    let [script, language, territory] = validateLocale(...normalizeLocale(...locale));
    [script, language].reduce((cfg, key)=>{
        if(!(key in cfg))
            cfg[key] = {};
        return cfg[key];
    }, config)[territory] = data;
}

/**
 * returns [actuallyUsedLocale, data]
 * actuallyUsedLocale = [Script, Language, Territory]
 * if e.g. Language in ['Latn', 'fr'] was not defined it would return
 * ['Latn', DFLT, DFLT]; or if Script was also not defined [DFTL, DFLT, DFLT]
 */
export function getFromI18NConfigFull(configI18N, locale) {
    const [configLocale, resultConfig] = normalizeLocale(...locale)
    .reduce(([path, cfg], key)=>{
        if(!(key in cfg)){
            if(!(DFLT in cfg))
                throw new Error(`KEY ERROR Can't find ${key.toString()} in ${path.map(p=>p.toString()).join('-')}`);
            path.push(DFLT);
            return [path, cfg[DFLT]];
        }
        path.push(key);
        return [path, cfg[key]];
    }, [[], configI18N]);
    // console.log('getFromI18NConfigFull configLocale:',configLocale
    //     , '\nresultConfig:', resultConfig
    //     , '\nrequestLocale:', locale
    //     , '\nnormalized locale:', normalizeLocale(...locale)
    //     , '\ni18nConfig:', configI18N
    // );
    return [configLocale, resultConfig];
}

/**
 * Return only `resultConfig`.
 * Unlike getFromI18NConfigFull which returns `[configLocale, resultConfig]`.
 **/
export function getFromI18NConfig(configI18N, locale) {
    return getFromI18NConfigFull(configI18N, locale)[1];
}

{
    const _MIN_LINE_LENGTH_EN = 33
      , _MAX_LINE_LENGTH_EN = 65
      ;
    //COLUMN_CONFIG[DFLT][DFLT][DFLT]
    addToI18NConfig(COLUMN_CONFIG_I18N, ['Latn', 'en'], { // fallback for all
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
    });
}

// We use 'Latn-en' as 'Latn-DFLT-DFLT' and as 'DFLT-DFLT-DFLT' as we
// don't have anything else so far.

//COLUMN_CONFIG[DFLT][DFLT][DFLT]
addToI18NConfig(COLUMN_CONFIG_I18N, [], getFromI18NConfig(COLUMN_CONFIG_I18N, ['Latn', 'en']));
//COLUMN_CONFIG['latn'][DFLT][DFLT]
addToI18NConfig(COLUMN_CONFIG_I18N, ['Latn'], getFromI18NConfig(COLUMN_CONFIG_I18N, ['Latn', 'en']));


// addToI18NConfig(COLUMN_CONFIG, ['Latn'], {...});
// COLUMN_CONFIG['Latn']['de'][DFLT]

{
    // Because German has longer words, we make the _MIN_LINE_LENGTH_DE
    // wider than in default Latn/en
    // TODO: Note how the 4 column setup comes very close together [42, 45]
    // in English it's [33, 40], we may consider the overall spread of
    // columns, needs verification if this is a good treatment.
    const enColumnConfig = getFromI18NConfig(COLUMN_CONFIG_I18N, ['Latn', 'en'])
      , _MIN_LINE_LENGTH_DE = 42
      , _MAX_LINE_LENGTH_DE = 65
       // base on a (caution: shallow!) copy of Latn-en
      , deColumnConfig = Object.assign({}, enColumnConfig, {
            minLineLength: _MIN_LINE_LENGTH_DE
          , maxLineLength: _MAX_LINE_LENGTH_DE
          , columns:[
                [ 0, _MAX_LINE_LENGTH_DE, 0]  // 1
              , [_MIN_LINE_LENGTH_DE, _MAX_LINE_LENGTH_DE, 3] // 2
              , [_MIN_LINE_LENGTH_DE, 50, 2.5] // 3
              , [_MIN_LINE_LENGTH_DE, 45, 2] // 4
            ]
        })
      ;
    // COLUMN_CONFIG['Latn']['de'][DFLT]
    addToI18NConfig(COLUMN_CONFIG_I18N, ['Latn', 'de'], deColumnConfig);
}


const STOPS_GRADE_ROBOTO_FLEX = [
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

const STOPS_GRADE_AMSTEL_VAR = [
    /* [fontSize, --grad-400, --grad-700] */
    [10,  -3,  -80]
  , [11,  -6,  -90]
  , [12, -10,  -95]
  , [13, -12, -100]
  , [14, -14, -105]
  , [15, -16, -110]
  , [16, -18, -115]
  , [17, -22, -120]
  , [18, -24, -125]
];

const STOPS_SYNTH_SUP = [
    /* [fontSize, --sup-scale] */
    [  8, 0.65]
  , [ 14, 0.57]
  , [144, 0.25]
];

const STOPS_SYNTH_BLOCKQUOTE_MARGINS = [
    /* [fontSize, --sup-scale] */
    [ 30, 0]
  , [ 65, 1]
];

// funcName, animationName, props, stops
const CSS_KEYFRAME_FIXES = [
    // synth-sub must be first, as grade depends on
    // font-size and this changes font-size.
    ['byFontSize', 'synth-sub-and-super-script', ['--sup-scale'], STOPS_SYNTH_SUP]
  , ['grade', 'RobotoFlex-grad-by-font-size', ['--grad-400', '--grad-700'], STOPS_GRADE_ROBOTO_FLEX]
  , ['grade', 'AmstelVar-grad-by-font-size',  ['--grad-400', '--grad-700'], STOPS_GRADE_AMSTEL_VAR]
  , ['byColumnWidth', 'blockquote-margins', ['--variable-margin'], STOPS_SYNTH_BLOCKQUOTE_MARGINS]
];

const JUSTIFICATION_SPEC_AMSTEL_VAR = {
    // weight
        // width
            // opsz
    900: {
        100: {

            144: {XTRA: [540, 562, 569], tracking: [-0.4 , 0, 0.9], wordspace: [120/144 - 1, 1 - 1/*144/144*/, 171/144 - 1]}
           , 14: {XTRA: [500, 562, 580], tracking: [-0.3 , 0, 0.15], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 22/14 - 1]}
           ,  8: {XTRA: [540, 562, 570], tracking: [-0.05 , 0, 0.15], wordspace: [6/8 - 1, 1 - 1/*8/8*/, 12/8 - 1]}
        }
    }
  , 400: {
        125: {
            // FIXME: PDF is not clear regarding tracking: also [-1, 0, 1]
            //          also suggest -1 instead of -0.1!
            //          Google Sheets "Amstelvar Justification saved" sugests [-1, 0, 0.8]
            144: {XTRA: [550, 562, 570], tracking: [-0.1, 0, 0.8], wordspace: [96/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]}
            // FIXME: PDF is not clear regarding tracking: also [-0.3, 0, 0.2]
            //          Google Sheets "Amstelvar Justification saved" sugests [-.3, 0, 0.3]
            // FIXME: PDF is not clear regarding XTRA: also [540, 562, 575]
            //          Google Sheets "Amstelvar Justification saved" sugests [540, ?, 580]
           , 14: {XTRA: [540, 562, 580], tracking: [-0.3, 0, 0.3], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
           ,  8: {XTRA: [510, 562 ,571], tracking: [-0.1, 0, 0.2], wordspace: [7/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
        }
        // default reading text spec:
      , 100: {
            144: {XTRA: [545, 562, 570], tracking:[-0.3, 0, 0.7],  wordspace: [120/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]}
           , 14: {XTRA: [515, 562, 575], tracking:[-0.4, 0, 0.2],  wordspace: [8/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
            // FIXME: PDF is not clear regarding tracking: also [-0.1, 0, 0.2]
            //          Google Sheets "Amstelvar Justification saved" sugests [-0.1, 0, 0.25]
           ,  8: {XTRA: [545, 562, 580], tracking:[-0.1, 0, 0.25], wordspace: [6/8 - 1, 1 - 1 /*8/8*/, 12/8 - 1]}
        }
      , 50: {
            144: {XTRA: [550, 562, 568], tracking: [-0.3, 0, 0.5], wordspace: [120/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]}
            // FIXME: PDF is not clear regarding XTRA: also [562, 562, 575]
            //          Google Sheets "Amstelvar Justification saved" sugests: [540, ?, 575]
           , 14: {XTRA: [540, 562, 575], tracking: [0, 0, 0.2], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
           ,  8: {XTRA: [540, 562, 568], tracking: [-0.1, 0, 0.15], wordspace: [6/8 - 1, 1 - 1/*8/8*/, 12/8 - 1]}
        }
    }
  , 100: {
        100: {
            // FIXME: PDF is not clear regarding wordspace: also [126/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]
            //          Google Sheets "Amstelvar Justification saved" sugests: [126/144 - 1, 1 - 1/*144/144*/, 192/144 - 1]
            144: {XTRA: [552, 562, 568], tracking: [-0.2, 0, 0.7], wordspace: [126/144 - 1, 1 - 1/*144/144*/, 192/144 - 1]}
            // FIXME: PDF is not clear regarding XTRA: also [515, 562, 575]
            //          Google Sheets "Amstelvar Justification saved" sugests: [535, ?, 575]
           , 14: {XTRA: [535, 562, 575], tracking: [-0.2 , 0, 0.2], wordspace: [8/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
           ,  8: {XTRA: [545, 562, 570], tracking: [-0.01 , 0, 0.27], wordspace: [8/8 - 1, 1 - 1/*8/8*/, 12/8 - 1]}
        }
    }
};

const JUSTIFICATION_SPEC_ROBOTO_FLEX = {
    // weight
        // width
            // opsz
    1000: {
        100: {
            144: {XTRA: [458, 468, 473], tracking: [-0.8, 0, 0.5], wordspace: [96/144 - 1, 1 - 1/*144/144*/, 150/144 - 1]}
           , 14: {XTRA: [458, 468, 472], tracking: [-0.2, 0, 0.13], wordspace: [10/14 - 1, 1 - 1/*14/14*/, 18/14 - 1]}
            // FIXME: PDF is not clear regarding XTRA: also [462, 468, 475]
           ,  8: {XTRA: [444, 468, 475], tracking: [-0.06, 0, 0.2], wordspace: [6/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
        }
    }
  , 400: {
        151: {
            144: {XTRA: [455, 468, 479], tracking: [-0.3, 0, 0.5], wordspace: [118/144 - 1, 1 - 1/*144/144*/, 180/144 - 1]}
            // FIXME: PDF is not clear regarding XTRA: also [450, 468, 471]
           , 14: {XTRA: [458, 468, 475], tracking: [-0.1, 0, 0.13], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 19/14 - 1]}
           ,  8: {XTRA: [462, 468, 475], tracking: [-0.06, 0, 0.2], wordspace: [7/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
        }
        // default reading text spec:
      , 100: {
            144: {XTRA: [460, 468, 471], tracking:[-0.5, 0, 0.5],  wordspace: [114/144 - 1, 1 - 1/*144/144*/, 192/144 - 1]}
           , 14: {XTRA: [460, 468, 471], tracking:[-0.1, 0, 0.13],  wordspace: [12/14 - 1, 1 - 1/*14/14*/, 19/14 - 1]}
           ,  8: {XTRA: [462, 468, 475], tracking:[-0.06, 0, 0.2], wordspace: [7/8 - 1, 1 - 1 /*8/8*/,   14/8 - 1]}
        }
      , 25: {
            // FIXME: PDF is not clear regarding wordspace: also: [120/144 - 1, 1 - 1/*144/144*/, 192/144 - 1]}
            // FIXME: PDF is not clear regarding XTRA: also: [466, 468, 473]
            144: {XTRA: [468, 468, 473], tracking: [-0.07, 0, 0.15], wordspace: [120/144 - 1, 1 - 1/*144/144*/, 168/144 - 1]}
            // FIXME: PDF is not clear regarding wordspace: also: [12/14 - 1, 1 - 1/*14/14*/, 19/14 - 1]}
           , 14: {XTRA: [463, 468, 472], tracking: [-0.1, 0, 0.13], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 16/14 - 1]}
            // FIXME: PDF is not clear regarding tracking: also: [-0.06, 0, 0.2]
           ,  8: {XTRA: [464, 468, 475], tracking: [0, 0, 0.2], wordspace: [7/8 - 1, 1 - 1/*8/8*/, 10/8 - 1]}
        }
    }
  , 100: {
        100: {
            144: {XTRA: [460, 468, 473], tracking: [-0.3, 0, 0.65], wordspace: [126/144 - 1, 1 - 1/*144/144*/, 216/144 - 1]}
           // FIXME: PDF is not clear regarding XTRA, also: [458, 468, 471]
           , 14: {XTRA: [458, 468, 472], tracking: [-0.1, 0, 0.13], wordspace: [12/14 - 1, 1 - 1/*14/14*/, 20/14 - 1]}
           // FIXME: PDF is not clear regarding tracking, also: [-0.04, 0, 0.2]
           ,  8: {XTRA: [460, 468, 471], tracking: [-0.03, 0, 0.16], wordspace: [8/8 - 1, 1 - 1/*8/8*/, 14/8 - 1]}
        }
    }
};

const JUSTIFICATION_SPECS = {
    AmstelVar: JUSTIFICATION_SPEC_AMSTEL_VAR,
    RobotoFlex: JUSTIFICATION_SPEC_ROBOTO_FLEX
};

// This is a stub, it's not taking into account e.g. font-size
// etc. because we just use it so far for main headlines.
// FIXME: for h1/type "main" we use only:
//          --line-handling-direction: "narrowing";
// Hence, widening with these values is not confirmed
// to be good.
const WDTH_JUSTIFICATION_SPECS = {
    // RobotFlex: axis goes down to 25 and up to 151
    RobotoFlex: [35, 151 /* we don't use wdth widening so far*/]
    // AmstelVar: axis goes down to 50 and up to 125
  , AmstelVar: [50 , 125  /* we don't use wdth widening so far*/]
};

export const typeSpec = {
      columnConfigI18N: COLUMN_CONFIG_I18N
    , justificationSpecs: JUSTIFICATION_SPECS
    , wdthJustificationSpecs: WDTH_JUSTIFICATION_SPECS
    , cssKeyframeFixes: CSS_KEYFRAME_FIXES
};
