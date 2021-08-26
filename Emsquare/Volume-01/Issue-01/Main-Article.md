---
title: "Space the initial frontier"
modules:
    - "Emsquare/Volume-01/js/main.mjs"
styles:
    - "explorations/wikipedia/css/varla-varfo.css"
    - "explorations/wikipedia/css/widgets.css"
    - "Emsquare/Volume-01/main.css"
---

The biggest key on the keyboard is the space key. Typography starts with its parent space, the “imaginary” em square, into rectangles of the same height as the em square representing the default widths of each glyph in a font, including the space. These rectangles are only "defaults", as the space between lines,  between glyphs, and the word space, can be changed by the user, and then by the final display of font in print or screen.

## Square one.

This is a rectangle of equal sides and angles, making it a square.

The em square.

{% include emsquare-figure
        src="./images/Figure 1.png"
        fig=1
        caption="The em square."
%}

In type, this square represents to the type designer two things that are important links to the reader. Vertically, the space represents the intersection between lines of text when the font is composed without additional space between lines.

{% include emsquare-figure
        src="./images/Figure 2.png"
        fig=2
        caption="The vertical dimensions of a font’s main glyph groups."
%}

Second, chosing where the baseline is in the em square, is how the font line up with every other font of any size or style. This gives the type designer  the extents that can be allotted above and below the baseline, for the typeface family.

And so the type designer plans the vertical metrics and horizonatal of all the characters of a typeface, based on how the designer wants collections of glyphs to be glimpsed, seen, viewed, skimmed, read, or read for a long time.

{% include emsquare-figure
        src="./images/Figure 3.png"
        fig=3
        caption="Length of text / various ways to \"see\" it."
        alt="Length of text / various ways to 'see' it."
%}

Horizontally, the height is the same as the em in each glyph and except when the script and design are monospaced, each glyph has an appropriate width. In such fonts, the horizontal dimension represents the default spacing of as the glyphs space best with all the other characters in the font.

{% include emsquare-figure
        src="./images/Figure 4.png"
        fig=4
        caption="Glyphs of different widths. Monospaced all one width."
%}

(So far, this is true of all scripts, and all designs)


Add direction of reading, at the behest of whichever direction, or directions, a language allows, and the square has direction. For example, and to zero in on one language at a time, all the types of Latin are designed for all the languages that use Latin, to be read in lines from top to bottom, with each line being read from left to right. So the square has a beginning on the top and left sides, and has ends at the bottom and the right side.

{% include emsquare-figure
        src="./images/Figure 5.png"
        fig=5
        caption="Beginnings and ends of transparencies."
%}

The em square (called an em quad in metal type), can be seen typographically as a space with beginnings and ends, and nothing in the midst of that, at the size of the type with no additional spacing around it. The other spaces affecting the appearance of our square between the lines, is line spacing, and/or between the letters is letter spacing. Besides reading following from the beginning to end of each glyph, when programs responding to type specifications are told to add line spacing or letterspacing, they do so to the end, i.e. the bottom and right sides of glyphs. 

{% assign figures6 = "" | split: "" %}
{% assign figure6a = "./images/Figure 6.png,6,Em square w/w-out additional line spacing." | split: "," %}
{% assign figure6b = "./images/Figure 6b.png,6b,Default letters w/w-out letter spacing." | split: "," %}
{% assign figures6 = figures6 | push: figure6a %}
{% assign figures6 = figures6 | push: figure6b %}

{% include emsquare-multi-figure
        figures=figures6
        caption="Em square w/w-out additional line spacing and<br />**Figure 6b**: Default letters w/w-out letter spacing."
%}

Between the lines is called line spacing, and is valued either by the size of the space or as a percentage of the size of the type. Between the letters are default letter spacing and kerning, with tracking being a function for changes to both, also usually expressed as a percentage of size. Both are typically added end of the typographic object, i.e. the linespacing is added to the bottom of a line and letter spacing added to the right of Latin glyphs.

## Word Space

The largest key on most keyboards and the most important character to spacing in a font is the space, or word space. In Latin use, its width is derived from a formula, or simply chosen visually by the type designer. It is often adjusted by applications, but its fundamental job is to make certain it’s the largest horizontal space in any given piece of text of a single size.

{% include emsquare-figure
        src="./images/Figure 7 & 8 one third.png"
        fig=7
        caption="Word space and its adjustment."
%}

And its second most critical task is to remain around the same as or smaller than the line space, i.e. the space between lines. Obviously the word space is less important and sometimes absent entirely from type that’s glimpsed, seen, or viewed, and is increasingly important as the text is to be skimmed, read, or read for a long time.

The type designer’s task, then, is to create a default word space, and default letter spacing that work. And then the often long and arduous task of making Kerning pairs, creating list of exceptions to the default letter spacing that need to be prevented from touching, like /f/?, which we’ll get to later, or competing with the size of the word space, like /T/o, which we’ve gotten through now.



{% assign figures8 = "" | split: "" %}
{% assign figure8a = "./images/Figure 7 & 8 two thirds.png,7 & 8,Default letter spacing and Kerning vs word space." | split: "," %}
{% assign figure8b = "./images/Figure 7 & 8.png,7 & 8,Default letter spacing and Kerning vs word space." | split: "," %}
{% assign figures8 = figures8 | push: figure8a %}
{% assign figures8 = figures8 | push: figure8b %}

{% include emsquare-multi-figure
        figures=figures8
        caption="Default letter spacing and Kerning vs word space."
%}

There’s only one other kind of space left in type and it’s inside the letters. This may be fully enclosed, like /o’s interior, trapped along the baseline and cap height, like /K, or swirling amidst the stem of the /S, but it’s what gives a typeface the start on all the other spaces we’ve covered.

{% include emsquare-figure
        src="./images/Figure 9.png"
        fig=9
        caption="Counters."
%}

The user has three kinds of control over this space. Type size, applied to a single style of type, makes them grow and shrink linearly to the change of size. Changing to the use of different styles within a regular font family alters the internal white spaces according to the style change from one to the next. Variation font technology, which can provide both of the above, can also provide optical sizes that adjust the internal white spaces over a range of sizes, as well as adding fluid ranges of weight and width axes.

{% include emsquare-figure
        src="./images/Figure10.png"
        fig=10
        caption="Counter changes via size, style and opsz."
%}

And while typefaces overwhelmingly end with well defined spaces, between words, letters and exceptional pairs, and many typeface families include a blizzard of styles, each with unique spacing, the way the font format, composition software, like design applications and web browsers, Latin typography faces challenges to the type user. And where there is a challenge in Latin, there’s likely to be more elsewhere in the world of scripts.

## Takeaways:

* ???
