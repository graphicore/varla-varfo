---
title:  "Calibrate CSS"
order: 100
modules:
    - "explorations/calibrate/js/main.mjs"
styles:
    - "explorations/techniques/main.css"
    - "explorations/calibrate/style.css"
class: calibrate-css
---

*This is a draft.*

# Calibrate CSS

An important but often overlooked property of the CSS-unit system is that
its absolute length units don't describe what their names imply.The reasons
are historical and the current status quo allows authors to design without
thinking about the deeper nature of their target devices, which is a good
thing. However, the consequences are that a CSS-Pixel is likely not a
hardware pixel on the display and that a CSS-Inch is likely not a real
world physical Inch. Regarding the latter, two categories of use cases are
made infeasible or hard to implement:

 * measuring or proofing
 * accurate design, especially for [fixed media](#excursion-the-tale-of-fixed-media)

This article is about enabling CSS-authors to work with real world physical
units and to make it easier to do so.

## "A robust and minimal calibration scheme"

This is a demo of a simple widget that let's you, the user, calibrate your
screen, so that it can confidently display real world distance units.
Calibration is a big word, I hope the widget demonstrates sufficiently,
that it is *quickly done* and *not a big deal*.

<div class="insert_calibration_widget"></div>

If the widget was used correctly, we can now use real-world sizes.

One real centimeter: <span class="sample-physical" style="--sample-size: 1cm"></span>
One real inch: <span class="sample-physical" style="--sample-size: 1in"></span>

The result is set to a custom property in CSS on `:root` as `--unit-scale-physical` its value
is <code class="insert insert-unit-scale-physical"></code>.

There's a *caveat*: the example expects square pixels. Generally it is possible
to calibrate width and height separately. However, on the web reasonable
square pixels can be expected and if they aren't square it should be tackled
on a different layer, e.g. OS or device driver.

The calibration widget was inspired by [my own experiment](../techniques/absolute_units_evaluation.html)
and an [#614 issue comment](https://github.com/w3c/csswg-drafts/issues/614#issuecomment-611217635)
(now also [CSS-WG FAQ](https://wiki.csswg.org/faq#real-physical-lengths))
where @tabatkins describes a calibration page workaround:

> Notably, this would basically be:
>
> 1. Have a calibration page, where you ask the user to measure
>    the distance between two lines that are some CSS distance apart
>    (say, `10cm`), and input the value they get.
> 2. Use this to find the scaling factor necessary for that screen
>    (CSS length divided by user-provided length), and store it locally
>    (via localStorage, or a cookie, etc).
> 3. On the pages where you need the accurate length, fetch it from
>    local storage, and set a `--unit-scale: 1.07;` (subbing
>    in the real value) property on the `html` element.
> 4. Anywhere you use a length that needs to be accurate, instead of
>    `width: 5cm;`, write `width: calc(5cm * var(--unit-scale, 1));`.
>
> This is a robust and minimal calibration scheme that will
> "fail open" - if the user hasn't calibrated, or clears local data, or
> has JS turned off, it'll just use standard CSS units (due to the , 1
> default arg for the unit scale), rather than breaking.


## About this Document

This article is answering an "work order" in the form of a
[comment by @frivoal on w3c/csswg-drafts#614](https://github.com/w3c/csswg-drafts/issues/614">)
, a discussion on the Topic **"[css-values] Ability to address actual physical size #614"**:

> […]
> It is possible that most members of the CSSWG and most browser
> engineers are wrong, that there's a big flaw in the collective
> reasoning, and that one way or another, this is actually a good
> idea. If you think so, start by understanding the arguments against,
> then build a strong case debunking them, and explain why you're right.
>
> Merely stating that there's no downside isn't going to be convincing.

In the meantime, there's also an entry in the [CSS-WG FAQ](https://wiki.csswg.org/faq#real-physical-lengths),
describing  the history and status of the topic and a new
[issue #5986 \[css-env\] Device Pixel Ratio](https://github.com/w3c/csswg-drafts/issues/5986)
trying to move the discussion forward.

### Disclosure

As of beginning this, I don't know if a good case can be build, but
I'm instinctively biased towards having the ability to use real world
physical sizes in CSS. I found out about the bigger discussion right after
collecting my observations in [Real World Absolute Length Units Evaluation](../techniques/absolute_units_evaluation.html).

### Contribute

I understand this as an open document, meaning that contributions
are welcome via the [GitHub issue tracker](https://github.com/graphicore/varla-varfo/issues)
and [Pull Requests on the actual document](https://github.com/graphicore/varla-varfo/blob/main/explorations/calibrate/index.html).
But this openness also means it's possible, even likely, that the article
changes over time. The change history can be examined via git, but when
quoting, it may still be a good idea to keep the current git commit hash
of the repository HEAD commit:
[`{{ site.github.build_revision | slice: 0, 10 }}`]({{site.github.repository_url}}/commit/{{site.github.build_revision}}).


## Debunking

Sometimes arguments are made that are not adding value to the discussion.
There are similar badly shaped arguments on both sides and I hope to get
by without having to dispute each of the low quality ones in here.

### Critique of the CSS-Reference-Pixel

Examples where the CSS-Reference-Pixel model solves issues, that seem to
be harder to tackle in the physical-sizes model, are often used as
counterpoints to having access to physical sizes in CSS at all. Despite
that this kind of argumentation could be considered bad style, rather than
disputing these points, I'm going to explain where I see the shortcomings
of the CSS-Reference-Pixel. I hope this will show why **a complementary model**
with some sort of access to physical units is necessary. I do believe the
CSS-Reference-Pixel is in general a very good idea.

The way the CSS-Reference-Pixel *"just works"* is, irrespective of its fancy
definition via the visual angle and viewing distance, a simple *"just
scale everything”*.

While this has proven to work in many cases, it breaks down when it comes
to situations where **precision and fidelity are required**, either by the
the nature of the viewing situation or by the diligence of the author
who wants to create the best possible design.

#### Excursion: The Tale of Fixed Media

In spite of all the reasons, why physical sizes are said to fail or not,
we do already [have](https://www.w3.org/TR/css-values-3/#absolute-lengths)
the concept of *"anchoring"* especially for *"print media"* to physical
measurements:

> For a CSS device, these dimensions are anchored either
>
> 1. by relating the physical units to their physical measurements, or
> 2. by relating the pixel unit to the reference pixel.
>
> For print media at typical viewing distances, the anchor unit should be
> one of the standard physical units (inches, centimeters, etc). For screen
> media (including high-resolution devices), low-resolution devices, and
> devices with unusual viewing distances, it is recommended instead that
> the anchor unit be the pixel unit. For such devices it is recommended
> that the pixel unit refer to the whole number of device pixels that
> best approximates the reference pixel.

**Typical viewing distance** is tricky: it's not explicitly set anywhere in
the device, nor does the spec document it or explain how to determine it.
Instead, it is left to device manufacturers, operating systems and user
preferences to somehow come to a scaling factor that pleases. Usually
backwards from there, *if we know some real world measurement of the
screen like PPI, its measurements or the `--unit-scale-physical` factor*,
we can [calculate](#calculate-device-typical-viewing-distance) what the
typical viewing distance is i.e. **the viewing distance at which the device
matches the CSS-Reference-Pixel**. In the context of this article, this
is how the term is used. *Note:* calculation from PPI screen measurements
would require additional information like `window.devicePixelRatio` or from
`window.screen`.

The big question is: **If the CSS-Reference-Pixel is the golden hammer
that fixes all of our problems, why would anyone ever want to anchor to
physical units?**

Although I've seen claims that printers do not produce accurate output,
in my tests with my home printer the measurements are *highly accurate*.
The scale option in the print dialog is however an easy to trigger source
of error, always set it to 100 % and don't allow to "fit to page width" or
similar. (If that doesn't fix it, the calibration scheme described in here
works for print as well!)

The claim I made, that the CSS-Reference-Pixel is a simple
scheme of *"just scale everything”* can be illustrated well using
the print dialog. Consider the ISO 216 (DIN 476) A-paper-format, in this
example we designed a flyer for an A6 postcard format. The design is set
in absolute units and the printer (A) anchors to physical measurements.
We know that at `28 inches` distance, "nominal arm’s length", our flyer design
matches the CSS-Refernce-Pixel. A1 is `~ 5.65` (= <code>(√2)<sup>5</sup></code>)
times larger than A6, that (naively) puts its typical viewing distance
to match the CSS-Reference-Pixel at `158.2 inches` (`5.65 × 28`, `~ 4.02 meter`).
If we send our flyer to a printer (B) to print at A1, the printer in
this case anchors to the CSS-Refernce-Pixel and also has determined,
naively(!), that the typical viewing distance of a A1 Poster is at
`158.2 inches`, we get a perfectly scaled version of our flyer. However, in
fact, printers do not anchor to the CSS-Reference-Pixel. Hence, to get the
same result, in our print dialog we must chose the option "*Scale: Fit to
page width*" in other words *"just scale everything”*.

*Note:* if the typical viewing distance would be a different value in B,
the design would not fit the page exactly and end up either larger or smaller
than the page size, in such a case media-queries could rescue us, but that
applies regardless of the unit anchoring.

With the example in mind we can also rephrase the *big question* and ask:
**If it is that simple, why don't designers make one layout for print and
then *"just scale everything”?***

The answer is simple: design for print doesn't work that way. In fact it
is discredited to take a flyer and just print it as a poster or vice versa.
One would analyze the anticipated viewing conditions and then find a layout
that matches these conditions best. Classically, a poster doesn't
have a single typical viewing distance. Instead, since the size of the
poster is fixed and interaction is limited (no zoom, no scroll), viewing
distance becomes an *instrument of design* and *it is not fixed*. One could
say, viewing distance is the interaction model of a poster, and it could
work something like this:

 * **viewer is farther** (~ 20 – 10 meters) The poster must capture attention.
 * **viewer is far** (~ 8 – 5 meters) Most important information is revealed (who, what).
 * **viewer is close** (under ~ 3 meters) All required information e.g. to visit the event (when, where, how).
 * **viewer is closer** (under ~ 1 meter) Legal information, contact data etc.

On a smaller flyer the spread of font sizes from "farther" to "closer"
will be less than on a larger poster, the "closer" fonts must get larger,
and the font-size differences between steps must get smaller. The Poster
has more real estate to create visual tension. Put in other words: when
viewed next to each other, scaled to the same size, most apparently, the
large poster design has smaller fonts for the "closer" range, they would
become unreadable small when scaled down to flyer size. But also the
differences between font-sizes in the hierarchy overall will be lesser
in the design for the smaller flyer. It's not a linear scaling at all.

**Fixed Media**, defined for the purpose of this article, is a superset
of print media, it also includes other media when it has similar properties
to print. Fixed media is not primarily interactive, meaning that it can't
be zoomed, scrolled or clicked by the viewer, it may be paged or animated
though, it may even have interactive aspects, but those are secondary. An
example is digital signage or digital advertisement in public space etc.
The media is "fixed" because it does not appear on the device of the viewer,
rather, the viewer appears and the media is already there, as in fixed
to a wall.

Suppose we have a poster like fixed media advertisement, targeted at poster
like digital signage screens. The screen sizes may still differ across the
deployment. Of course, we design it using the CSS-Reference-Pixel model,
*because that's the golden hammer*, everything gets scaled to fit the
screens according to their typical viewing distance. Of course we want to
stick to our viewing distance based interaction model, *because that's best
practice*, after all, in relative terms "farther", "far", "close", "closer"
can still be expressed in CSS-sizes, just like `xx-large`, `large`, `small`
and `xx-small` can be expressed relative to the default `medium`  `font-size`.


In the fixed media example two differently sized screens are:

|                 | aspect ratio | device pixels   | PPI    | physical measurements                   | the width of … |
|---------------- | :----------: | --------------- | ------:| :-------------------------------------- |:--------------:|
|**small screen** | 9:16         | 2160:3840 (UHD) | 184.62 | 11.7:20.8&nbsp;in (29.7:52.8&nbsp;cm)   | A3             |
|**large screen** | 9:16         | 2160:3840 (UHD) |  65.26 | 33.1:58.8&nbsp;in (84.1:149.5&nbsp;cm ) | A0             |

We could set them up so that they are calibrated to physical units, this
would require setting the `device-pixel-ratio [browser zoom]` (**d-p-r**) for the
small screen to `1.92 [192%]` (`~1125:2000 CSS-px`) and for the large screen
to `0.68 [68%]` (`~3176:5647 CSS-px`). Now both screens would
have a default viewing distance of 28 inches and a print-media to screen-media
transformation would work seamlessly. But this would be an extreme
setup, it is also exactly like the calibration this article is trying to
establish.

More typical would be if the small screen had a d-p-r
of maybe `2 [200%]` (`1080:1920 CSS-px`), putting its typical viewing
distance at `29.11 inches` (`73.96 centimeters`), and the large screen had a
d-p-r of maybe `3 [300%]` (`720:1280 CSS-px`), putting
its typical viewing distance at `123.57 inches` (`313.86 centimeters`).

If the larger screen was set to `2 [200%]` as well, we would have no way
in CSS to distinguish it from the small screen, from the perspective of a
media query it would look in every aspect the same. Thus the resulting
image would have to be the same as on the small screen, just scaled.
Fortunately, we set it differently, that screen in media queries would
appear to be smaller in CSS-units and also have to receive the styles of
the larger design. **This is not only counter intuitive, it is also arbitrary**.
If we design like this, we are going to have the same result for an A0
sized screen, also when viewing on a mobile phone.

At this moment we can end this excursion. From looking at screen sizes
that are normalized with the CSS-Reference-Pixel model, we can't possibly
make conclusions about the physical sizes, that's by the way the whole
point of the model, and **therefore we can't optimize our design for
fixed media**. The results that are permissible must be oriented at
whatever works at a distance of an arm’s length. This is actively harmful
for general design quality. Like clipping in signals, it's limiting the
range of expression and the precision that good design offers, in German
we have a word for what is left: **"Einheitsbrei"** (like uniformity-mash/porridge).



---


CSS is becoming ubiquitous, no matter how little the ratio of a specialized
use case like fixed media is compared to traditional web site usage, in absolute
numbers it will still be vast.


Design for fixed media in CSS with physical units would be powerful, because
we could use the parametric power of CSS to target different output
media formats and still wouldn't have to sacrifice on precision. This of
course would ideally be supported by media queries.


> You mention low sighted readers as an example of why you need to know
> how large something physically is, but that wouldn't not work. Making
> each letter 2cm tall, which would seem gigantic if you're thinking of
> text on a phone, would result in small and unreadable text when seen
> on the projector of a large conference room. The CSS pixel already
> accounts for that.
> [… responding to a pizza analogy …] if you had all the parameters, you'd
> need to boil them down to the same result a we already gave you.
> [[source](https://github.com/w3c/csswg-drafts/issues/614#issuecomment-254403012)]

There are many ways to handle the intricacies of reality, in this case
a `font-size: max(calc(12pt * var(--unit-scale-physical), 12pt));` would
make sure we don't print text smaller than acceptable in a fixed media
situation.




> What is particularly useful about the angular definition of the pixel
> and other length units is that they enable robust designs. By that I
> mean that it enables authors to write a web page that works in environments
> they know about, **and be confident that it will do the right thing even
> in environments they haven't tested in or are not even aware of.**
> [[source](https://github.com/w3c/csswg-drafts/issues/614#issuecomment-254679777)]




Besides, nobody wants to display text in unreadable sizes and everybody
understands the size and distance implications of phones versus projectors.
The conference room is also a good example how the CSS-pixel does not
compensate viewing distances and display size very well: the first row
versus the last row will have tremendously different viewing angles and
witness different sizes of the screen. Good design choices based on environment
data, such as absolute screen size and also the general situation can improve
the presentation.

The idea that one would come up with the same result when given all the
parameters as when just scaling everything, despite of a more complicated
path, sounds to me like an overassessment. It boldly disregards the work
designers do, the decision making process. Engineers tend to simplify
issues, and that’s often required in their work, but when it comes to human
perception, visual language, written language and so on, this simplification
often tends to yield naive and wrong results.

### "Absolute Physical Measurements Would Mess with Zooming."

Where zooming is possible we must not take it away, it simply has higher
priority. If there's an important reason why something must be displayed
true to scale, the page or app should inform the user and if possible
detect zooming and warn. Moreover, Page-Zoom already invokes media-queries,
these will keep working and added support for the new model will improve
the situation further. Ways to handle the fact of zooming will evolve,
it's not a blocker.

There are however also [situations where zooming is not possible](#excursion-the-tale-of-fixed-media),
the UA may not be controllable by the viewer, in those cases, informed
design with physical sizes will likely help to improve the situation,
rather than having the CSS-Reference-Pixel dictate a solution.

#### TODO: critique of the CSS-Reference-Pixel approach

Yes and no: designers know that size and distance are important, but the
current approach is insufficient for some use cases.

We can also show the web platform/CSS traditionally is multi-conceptual.

Note: viewing distance is not well defined or specified it’s a joker in
the CSS-pixel visual angle argument, but the concept is sloppy, we can work with that!


### The CSS pixel is fundamentally designed so that if you know the size
of something in pixels, you know how big it looks.


Note: True, but what you think you know is very vague: rounding is rough,
there’s no fidelity at all. Not each device scales appropriately,
phones/tablets/closed systems probably better than laptops/desktops,
generally no one ever asks the user how far they are away from their screen,
it’s often just an assumption or educated guess. We can calculate the
nominal reading distance of devices, and it is generally somewhere in the
ballpark, but then again, heads move, nod and wiggle, if it’s to small
they will come closer etc.

### Browsers are bad at reliably and accurate knowing the actual size and resolution of your display.

*Paraphrased from the [CSS-WG FAQ](https://wiki.csswg.org/faq#real-physical-lengths).*

That's why [the proposal](#browser-support-roadmap) is to have a progressively
enhancing model. Some devices can be very reliable, like phones and tablets,
where the display is integrated, these devices could just work. In other
cases the best solution is to ask the user for calibration via a widget,
similar to the one that is demonstrated here. The calibration could happen
on the page directly, but it would be ideal if the user agent or the OS
could provide this service. In my opinion, the user agent would be the sweet
spot to implement this. The page or app would provide its own widget as
a polyfill.

If the hardware reports display sizes, it would in any case be necessary
that the user can control and, where required, override that information
with own measurements, using a calibration widget.

### Authors would misuse accurate real-world units and give users a bad experience.

*Paraphrased from the [CSS-WG FAQ](https://wiki.csswg.org/faq#real-physical-lengths).*

We should not protect authors from themselves, instead teach them how to
use these tools to achieve the best for their users. Also that the
CSS-Reference-Pixel should be their default choice.

The argument could also be turned around, identifying cases where the
automatism provided by the CSS-Reference-Pixel gives users a bad or
worse than ideal experience, and since CSS has no escape mechanism yet,
this could be identified as a form of violence, a good moment to think:
fuck the algorithm.

It's OK that working with real physical measurements would make some
things harder, the gist is that it would enable other things that are
impossible to achieve under the CSS-Reference-Pixel. Despite that, concepts
could be used side by side, there's no need to root for one model only.

## Use Cases

### Calculate Device Typical Viewing Distance

The viewing distance for which a screen is set up to, according to the
CSS-Reference-Pixel, is usually opaque to the user as well as to the CSS-author.
One result of that is, that it is hard to asses whether a device
displays contents too big or too small, or **how far away from a device one
should be to enjoy that standard.**

From the [spec](https://www.w3.org/TR/css-values-3/#absolute-lengths):

> The reference pixel is the visual angle of one pixel on a device with
> a pixel density of 96dpi and a distance from the reader of an arm’s
> length. For a nominal arm’s length of 28 inches [71,12 centimeters],
> the visual angle is therefore about 0.0213 degrees. For reading at
> arm’s length, 1px thus corresponds to about 0.26 mm (1/96 inch).

With a calibration as established above, it's simple to calculate the
implied viewing distance for this screen:

`let unitScalePhysical = `<code class="insert insert-unit-scale-physical"></code>`;`

JavaScript, calculating `normalReadingDistance` in inches:

```js

/* It's sufficient to just scale the nominal arm's length: */

let normalReadingDistance = 28 / unitScalePhysical;

/* Alternatively the same result can be calculated using the visual angle,
 * but this can be simplified to the above.
 */

let alpha = Math.atan2(1/96/2, 28),
    normalReadingDistance = 1/96/2/unitScalePhysical/Math.tan(alpha);
```

On your device the reading distance to have one CSS-pixel to appear at an visual angle of 0.0213 degrees is:

<strong class="insert insert-normal-reading-distance"></strong>

In other words at that distance, one inch would appear as big as one physical
inch appears when viewed from a distance of 28 inches.

#### Other Useful Calculations

TODO

### more


* print proofing/designer preview. We can help reducing paper
  wastage!
* Effective web proofing by correctly scaling to actual
  e.g. phone-screen sizes.
* optical size proofing for type design
* getting an impression what the default viewing distance is
  supposed to be on certain devices, as it is not easy to to
  do on the spot.

* touch device UI must be touched with physical fingers,
  hence controls designed with physical sizes are best practice.
* the web platform usage diversifies as it is becoming more ubiquitous.
* the web platform is becoming more ubiquitous, not all use cases
  fit well into the "reference pixel" approach. Sometimes
  target screen and viewing distance could be very well known
  and hence a direct way of designing for these target could be
  desirable. In web, the flexibility of the CSS-unit approach
  requires that there's a scroll somewhere. Paged media can't
  afford this. Where a user can't scroll, e.g. a digital poster
  on a screen, that is not interactive, pages become important
  and alse that the designer can control the viewing distance
  assumptions. <!-- Claims like this need backup! it's also just
  not a good argument yet and may have false statements, definitely
  not all strong points.
  -->
* We can control for different device sizes even when designing
  with real world units, though a support in media-queries would
  help a lot.
* hi-res screens are so good now, we can anchor to physical units
  and won't get blurry lines.
* what about e.g. font-sizes for legal print, are there absolute
  requirements? "legible" is one of them, but fonts becoming regularly
  smaller than e.g. 12 pt because the device defaults to 20 inches
  viewing distance instead of 28 inches may be unfortunate.

## Browser Support Roadmap

Conceiving a roadmap how progressive browser support could be established in four milestones.

### Level 0

Now.

### Level 1

### Level 2

### Level 3
