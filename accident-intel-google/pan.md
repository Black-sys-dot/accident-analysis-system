# Alert Bot Body + Eye Tracking Plan (No AI Logic Yet)

## Summary
Add a visual bot character to the UI using the provided assets and implement eye-follow behavior for mouse and touch movement.  
The bot body should be visible and stable on both desktop and mobile, while both eyes (one mirrored) move smoothly inside constrained elliptical areas on the bot screen.

## Asset Inputs
- `assets/alert_bot.png` as the bot body.
- `assets/eye.png` as the base eye sprite for left eye.
- `assets/eye.png` mirrored horizontally for the right eye.
- `assets/arrow.png` reserved as a decorative indicator (optional in v1 layout, but wired in structure so it can be toggled on later).

## Implementation Changes
1. Add a dedicated bot overlay/container component:
- Insert bot markup in the shared visible UI layer (map page first, optionally home page later).
- Keep bot container independent from control panel scrolling so it never gets clipped.
- Add responsive size/position rules for desktop and mobile breakpoints.

2. Build bot face composition:
- Place two eye sockets as invisible elliptical movement bounds over the screen area of `alert_bot.png`.
- Render two eye elements inside sockets:
  - left eye uses original `eye.png`
  - right eye uses CSS `transform: scaleX(-1)` (or equivalent mirror wrapper)
- Set z-index/layering so eyes always appear above bot screen and below any global modal.

3. Add pointer tracking engine:
- Listen to `pointermove` for mouse and touch with unified logic.
- Compute direction vector from each eye socket center to current pointer position.
- Clamp movement to ellipse limits per eye (separate X/Y radii), then apply transform translate.
- On pointer exit/cancel/inactivity, animate eyes back to neutral center.

4. Motion behavior tuning:
- Use smooth interpolation (short easing) to avoid jitter.
- Cap maximum eye displacement to keep motion believable.
- Add lightweight throttling via `requestAnimationFrame` to prevent performance drops on mobile.

5. Mobile interaction handling:
- Ensure touch movement updates eyes while finger moves over screen.
- Maintain stable behavior when panel opens/closes or layout resizes.
- Recalculate socket centers/radii after resize/orientation change.

6. Public hooks for future AI demo wiring (visual only):
- Expose simple non-AI methods like:
  - `window.alertBot.show()`
  - `window.alertBot.hide()`
  - `window.alertBot.lookAt(x, y)`
  - `window.alertBot.resetEyes()`
- These hooks are for choreography only and do not include agent/NLP logic.

## Test Plan
1. Desktop:
- Move mouse across screen and verify both eyes follow correctly.
- Confirm right eye is mirrored but motion remains symmetric.
- Verify eyes never leave defined socket ellipse.

2. Mobile:
- Drag finger across screen and confirm live eye tracking.
- Lift finger and confirm eyes return to neutral.
- Test with panel open/closed and while switching map modes.

3. Responsiveness:
- Test common widths (phone portrait, phone landscape, tablet, desktop).
- Verify bot placement does not overlap critical inputs/buttons.
- Verify recalculation works after resize/orientation change.

4. Performance/stability:
- Confirm no visible lag or stutter during rapid pointer movement.
- Confirm no console errors when pointer leaves viewport or when map rerenders.

## Assumptions
- This phase is visual-only; no AI command parsing or action execution is included.
- Bot is added primarily to map experience first; landing-page extension can be phase 2.
- `arrow.png` is prepared in structure but optional to display immediately.
