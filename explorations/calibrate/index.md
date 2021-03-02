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
thinking about the deeper nature of their target devices. However, the
consequences are that a CSS-Pixel is likely not a hardware pixel on the
display and that a CSS-Inch is likely not a real world physical inch Inch.

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

The result is stored in CSS on `:root` as `--unit-scale-physical` its value
is <code class="insert insert-unit-scale-physical"></code>.

There a *caveat*: the example expects square pixels. Generally it is possible
to calibrate width and height separately.

The calibration widget was inspired by [my own experiment](../techniques/absolute_units_evaluation.html)
and an [#614 issue comment](https://github.com/w3c/csswg-drafts/issues/614#issuecomment-611217635)
where @tabatkins describes a calibration page:

> Notably, this would basically be:
>
> 1. Have a calibration page, where you ask the user to measure
>   the distance between two lines that are some CSS distance apart
>   (say, `10cm`), and input the value they get.
> * Use this to find the scaling factor necessary for that screen
>   (CSS length divided by user-provided length), and store it locally
>   (via localStorage, or a cookie, etc).
> * On the pages where you need the accurate length, fetch it from
>   local storage, and set a `--unit-scale: 1.07;` (subbing
>   in the real value) property on the `html` element.
> * Anywhere you use a length that needs to be accurate, instead of
>   `width: 5cm;`, write `width: calc(5cm * var(--unit-scale, 1));`.
>
> This is a robust and minimal calibration scheme that will
> "fail open" - if the user hasn't calibrated, or clears local data, or
> has JS turned off, it'll just use standard CSS units (due to the , 1
> default arg for the unit scale), rather than breaking.


## About this Document

This article is inspired by a
[comment by @frivoal on w3c/csswg-drafts#614](https://github.com/w3c/csswg-drafts/issues/614">)
, a discussion on the Topic "**[css-values] Ability to address actual physical size #614**":


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
physical sizes in CSS. I found out about the discussion right after
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


## Calibration of Browser Length-Units

> The reference pixel is the visual angle of one pixel on a device with
> a pixel density of 96dpi and a distance from the reader of an arm’s
> length. For a nominal arm’s length of 28 inches [71,12 centimeters], the visual angle
> is therefore about 0.0213 degrees. For reading at arm’s length,
> 1px thus corresponds to about 0.26 mm (1/96 inch).


Therefore, on your device the reading distance to have one
CSS-inch to appear at an visual angle of 0.0213 degrees is: <span class="insert insert-normal-reading-distance"></span>



## Use Cases:

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

