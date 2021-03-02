---
title:  "Calibrate CSS"
order: 100
modules:
    - "explorations/calibrate/js/modal-main.mjs"
styles:
    - "explorations/techniques/main.css"
    - "explorations/calibrate/style.css"
class: calibrated-css
---

# Calibration widget as a modal dialogue example

I keep the example around because it was the initial way to invoke the
widget and I want that modal model to keep working, while in [Calibrate CSS](./)
the widget is always visible.

<button class="ui-init-calibrate">click this button to calibrate</button>.

One real centimeter: <span style="display: inline-block; width: 1cm; height: 1cm; background: black"></span>

One real inch: <span style="display: inline-block; width: 1in; height: 1in; background: black"></span>

The result is stored in CSS on `:root` as `--unit-scale-physical` its value
is <code class="insert insert-unit-scale-physical"></code>.
