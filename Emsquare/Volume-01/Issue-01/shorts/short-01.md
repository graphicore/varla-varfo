---
title: "Variable fonts and space."
---

The Opentype 1.8 specification and its successors do not include  variations on the em square size, or on the location of the baseline.  Nevertheless, variable height and depth of glyphs, can change the relationship of glyphs to the height and depth of the em. 

Changing the height of uppercase, lowercase and the extenders of Latin all have the same basic utility of changing the heights without affecting the widths or horizontal spacing of text, a handy option in placing type in buttons, in shortening the descenders to reduce line space in headlines. These vertical  variations can also be used to change the height of Latin, to better compose with glyphs or text from other languages contained in a fallback font.

Letter spacing can be changed using a variable axis, and was brought up as a possibility several years ago. It should be useful eventually, but in Latin proportional typefaces, variable spacing is problematic as it brings along the need for variation of all the spacing exceptions, the kerning pairs. These exceptions as stored in the font format today, would increase the development, processing and file size of a font family, perhaps exponentially. 

There may also be other issues with a spacing axis, aside from file size and complexity, related to what I call “latent kerning” and wonder about, in the link provided. But one reason tracking and line spacing are useful to begin with, is they affect an isolated parameter. And though the effects of varying that parameter differ from glyph to glyph, (e.g. lowercase o is less susceptible to the effects of line spacing than lowercase p), as long as the type user knows it, they can react ahead of the reader and keep the line space or letter space from being too tight or loose. 

When the idea of independent control of line spacing and letter spacing is joined by the possibilities of a width axis, or an axis that just controls the contents (or both together in a variable font), several other classes of typographic refinements also become possible. One example is with headlines, sub-heads and other sizes above the body size, that are typically shorter in length, but often not short enough for the wide variety of portals the typography may be appearing in.

Whether because careful editorial is too costly, or using multiple widths of a typeface family was too expensive or time-consuming to download, the more common solution is adding lots of space for and around the headline along with an often draconian editorial limit on the character count. A variable font with a width axis can be automated to a great extent to alleviate this. But the weight axis of a typeface family typically changes more than one thing at once. 

In a weight axis the spacing is tightened and the weights lightened from those of regular, as the typeface is condensed. This maintains the same appearance of regular weight in narrower styles. The opposite happens when a typeface gets wider. So with an axis that just controls the counter, or the space inside the letters, what we label XTRA, changing the width, while maintaining the spacing weights and everything else, would not mix well with regular, as it would appear a different weight from the regular. This is especially true if the XTRA axis were used at the same range as the width axis.

But if XTRA is used in conjunction with control over the word space and letter spacing values, all used as little as possible to fit lines to a column, the typographer can improve hyphenation, prevent excessively large word spaces, and also justify less than absolutely. The latter meaning; I can choose a range of %, like 97% line length, within which to justify. 

Demonstrating this has involved research on how each browser calculates each line, both it’s length and where it breaks, a forward-looking algorithm that considers the next line and the last line of text, development of ranges of adjustability for word space, letter space and XTRA over the range of sizes from 8 to 144, and a UI for testing and output marking lines with color to indicate the change in width.

Future exploration into a variable hyphen feature, languages with different word-length tendencies, world scripts use, including styles with connecting glyphs...


