/*
 * Nori, the salmon-nigiri mascot: pose choreography + Canvas 2D drawing.
 * A straight port of Sushiesta/Models/MascotPose.swift and Sushiesta/Views/MascotView.swift.
 *
 * Coordinates are the reference artwork's pixels: the mascot canvas is the region
 * (100,100)–(924,900), i.e. 824×800. Angles are degrees, clockwise-positive (same as
 * SwiftUI's rotationEffect and Canvas 2D's rotate in a y-down space).
 * Classic script: defines window.Nori.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Palette (Theme.swift)

  const C = {
    rice: '#FFFEFA',
    riceShade: '#EEE6D9',
    nori: '#2E4A35',
    noriLight: '#4B6B51',
    ink: '#4A2C24',
    eye: '#33201B',
    cheek: '#F7A0A8',
    pink: '#FF9DB4',
    butter: '#FFD36E',
  };

  const LINE = 6;
  const CANVAS = { width: 824, height: 800 };
  const ORIGIN = { x: 100, y: 100 };
  const PIVOT = { x: 512, y: 862 };  // between the feet (canvas 412,762)
  const NECK = { x: 507, y: 490 };   // under the nori band (canvas 407,390)
  const REST_ARM = 38;
  const DEG = Math.PI / 180;

  // ---------------------------------------------------------------------------
  // Helpers

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const smooth = (x) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
  const mix = (a, b, k) => a + (b - a) * k;
  /** Eased 0→1 between times a and b. */
  const ramp = (t, a, b) => smooth((t - a) / (b - a));
  /** 0→1→0 hump between a and b. */
  const bell = (t, a, b) => Math.sin(Math.PI * clamp01((t - a) / (b - a)));
  /** Smooth 0…1 breathing cycle. */
  const cycle = (t, period) => (1 - Math.cos(2 * Math.PI * t / period)) / 2;
  /** Side-to-side value that eases in, holds near ±1, then switches sides. */
  const sides = (t, period) => Math.max(-1, Math.min(1, Math.sin(2 * Math.PI * t / period) * 1.8));
  function blink(t, period = 3.4) {
    const ph = t % period;  // same as Swift's truncatingRemainder
    return ph < 0.16 ? Math.max(0.08, Math.abs(ph - 0.08) / 0.08) : 1;
  }

  // ---------------------------------------------------------------------------
  // Pose

  const ANIMATABLE = [
    'bodyRotation', 'bodyScaleX', 'bodyScaleY', 'bodyOffsetY',
    'toppingOffsetX', 'toppingOffsetY', 'toppingRotation',
    'leftArm', 'rightArm', 'leftHand', 'rightHand', 'leftReach', 'rightReach', 'shoulderLift',
    'leftLeg', 'rightLeg', 'leftLegLength', 'rightLegLength',
    'faceOffsetX', 'faceOffsetY', 'faceTurn', 'eyeOpen', 'mouthCurve', 'mouthOpen', 'blush',
    'sparkles', 'shadowScale',
  ];

  function basePose() {
    return {
      bodyRotation: 0, bodyScaleX: 1, bodyScaleY: 1, bodyOffsetY: 0,
      toppingOffsetX: 0, toppingOffsetY: 0, toppingRotation: 0,
      leftArm: REST_ARM,          // viewer's left
      rightArm: -REST_ARM,        // viewer's right
      leftHand: 0, rightHand: 0,  // wrist bend relative to the arm
      leftReach: 1, rightReach: 1, // arm length multiplier
      shoulderLift: 0,            // negative = shoulders up
      leftArmFront: false, rightArmFront: false,
      leftLeg: 0, rightLeg: 0, leftLegLength: 1, rightLegLength: 1,
      faceOffsetX: 0, faceOffsetY: 0,
      faceTurn: 0,                // -1…1: face slides & compresses as the body twists
      eyeOpen: 1,
      mouthCurve: 1,              // 1 smile … -1 frown
      mouthOpen: 0,
      blush: 1,
      expression: 'happy',        // happy | calm | focused | joy | sad | sleepy
      sparkles: 0,
      shadowScale: 1,
    };
  }

  function lerpPose(a, b, k) {
    const r = Object.assign({}, b);
    for (const key of ANIMATABLE) r[key] = a[key] + (b[key] - a[key]) * k;
    const early = k < 0.5;
    r.expression = early ? a.expression : b.expression;
    r.leftArmFront = early ? a.leftArmFront : b.leftArmFront;
    r.rightArmFront = early ? a.rightArmFront : b.rightArmFront;
    return r;
  }

  /** Mood tint for resting poses: droopy after skipped breaks, bouncy on a streak. */
  function applyMood(pose, mood, t, resting) {
    const p = Object.assign({}, pose);
    if (mood === 'droopy') {
      p.expression = 'sleepy';
      p.eyeOpen = Math.min(p.eyeOpen, 0.62);
      p.mouthCurve = 0.15;
      p.blush *= 0.6;
      p.toppingOffsetY += 7;
      p.faceOffsetY += 3;
      if (resting) { p.leftArm -= 10; p.rightArm += 10; }
    } else if (mood === 'thriving') {
      p.blush *= 1.25;
      if (resting) {
        p.bodyOffsetY -= 7 * Math.abs(Math.sin(t * 3.2));
        p.expression = 'joy';
        p.mouthOpen = 0.45;
      }
    }
    return p;
  }

  // ---------------------------------------------------------------------------
  // Choreography

  function idle(t) {
    const p = basePose();
    const b = Math.sin(t * 2.2);
    p.bodyScaleY = 1 + 0.012 * b;
    p.bodyScaleX = 1 - 0.006 * b;
    p.leftArm = REST_ARM + 3 * b;
    p.rightArm = -REST_ARM - 3 * b;
    p.eyeOpen = blink(t);
    return p;
  }

  /** Matches the reference artwork: right hand up, waving. */
  function waving(t) {
    const p = idle(t);
    p.rightArm = -140 + 12 * Math.sin(t * 9);
    p.rightHand = 18 * Math.sin(t * 9 + 0.6);
    p.leftArm = 40;
    p.bodyRotation = -1.5 * Math.sin(t * 4.5);
    return p;
  }

  /** Both arms sweep up tall, Nori rises onto tiptoes and lengthens, swaying gently. */
  function overheadReach(t) {
    const p = basePose();
    const up = ramp(t, 0, 1.0);
    const breath = cycle(t, 4.5) * up;
    const reach = up * (0.75 + 0.25 * breath);

    p.leftArm = mix(REST_ARM, 146, up) + 6 * breath;
    p.rightArm = mix(-REST_ARM, -146, up) - 6 * breath;
    p.leftReach = 1 + 1.1 * reach;
    p.rightReach = 1 + 1.1 * reach;
    p.leftHand = 14 * up;
    p.rightHand = -14 * up;

    p.bodyScaleY = 1 + 0.07 * reach;
    p.bodyScaleX = 1 - 0.035 * reach;
    p.leftLegLength = 1 + 0.14 * reach;   // up on tiptoes
    p.rightLegLength = 1 + 0.14 * reach;
    p.bodyOffsetY = -14 * reach;
    p.toppingOffsetY = -18 * reach;
    p.faceOffsetY = -8 * reach;
    p.bodyRotation = 3 * Math.sin(2 * Math.PI * t / 6) * up;
    p.shadowScale = 1 - 0.08 * reach;

    p.expression = reach > 0.75 ? 'calm' : 'happy';
    p.eyeOpen = reach > 0.75 ? 1 : blink(t);
    p.mouthCurve = 0.8;
    return p;
  }

  /** One arm reaches up and over while the body leans the other way; hold, then switch. */
  function sideBend(t) {
    const p = basePose();
    const s = sides(t + 1.0, 12);
    const a = Math.max(0, s), b = Math.max(0, -s);   // a: leaning toward viewer's right
    const breath = 0.88 + 0.12 * cycle(t, 4);

    p.bodyRotation = 15 * s * breath;
    p.toppingRotation = 4 * s;
    p.faceOffsetX = 8 * s;
    p.bodyScaleX = 1 - 0.02 * Math.abs(s);

    // Top arm: up beside the head, arcing over toward the lean.
    p.leftArm = mix(REST_ARM, 168, a);
    p.leftReach = 1 + 1.1 * a;
    p.leftHand = 55 * a;
    p.leftArmFront = a > 0.3;

    p.rightArm = mix(-REST_ARM, -168, b);
    p.rightReach = 1 + 1.1 * b;
    p.rightHand = -55 * b;
    p.rightArmFront = b > 0.3;

    // Bottom arm: hand slides down the side of the leg.
    if (a > 0) { p.rightArm = mix(-REST_ARM, -12, a); p.rightReach = 1 + 0.2 * a; }
    if (b > 0) { p.leftArm = mix(REST_ARM, 12, b); p.leftReach = 1 + 0.2 * b; }

    p.expression = Math.abs(s) > 0.45 ? 'calm' : 'happy';
    p.eyeOpen = Math.abs(s) > 0.45 ? 1 : blink(t);
    p.mouthCurve = 0.7;
    return p;
  }

  /** A hand on the head draws the ear toward the opposite shoulder; hold, then switch. */
  function neckRelease(t) {
    const p = basePose();
    const s = sides(t + 1.2, 14);
    const a = Math.max(0, s), b = Math.max(0, -s);
    const breath = 0.9 + 0.1 * cycle(t, 4);

    p.toppingRotation = 17 * s * breath;
    p.toppingOffsetX = 14 * s;
    p.faceOffsetX = 22 * s * breath;
    p.faceOffsetY = 8 * Math.abs(s);
    p.bodyRotation = 4 * s;

    p.leftArm = mix(REST_ARM, 200, a);
    p.leftReach = 1 + 0.85 * a;
    p.leftHand = 75 * a;
    p.leftArmFront = a > 0.2;

    p.rightArm = mix(-REST_ARM, -200, b);
    p.rightReach = 1 + 0.85 * b;
    p.rightHand = -75 * b;
    p.rightArmFront = b > 0.2;

    if (a > 0) p.rightArm = mix(-REST_ARM, -18, a);
    if (b > 0) p.leftArm = mix(REST_ARM, 18, b);
    p.shoulderLift = 8 * Math.abs(s);

    p.expression = Math.abs(s) > 0.45 ? 'calm' : 'happy';
    p.eyeOpen = Math.abs(s) > 0.45 ? 1 : blink(t);
    p.mouthCurve = 0.6;
    return p;
  }

  /** Slow circles: shoulders lift up toward the ears, roll back, and drop down. */
  function shoulderRolls(t) {
    const p = basePose();
    const ease = ramp(t, 0, 0.6);
    const phase = 2 * Math.PI * t / 2.6;
    const up = (0.5 + 0.5 * Math.sin(phase)) * ease;  // 1 = shoulders at the ears
    const back = Math.cos(phase) * ease;               // fore/aft part of the circle

    p.shoulderLift = -42 * up + 6;
    p.leftArm = REST_ARM - 14 * up + 10 * back;
    p.rightArm = -REST_ARM + 14 * up - 10 * back;
    p.leftHand = -10 * back;
    p.rightHand = 10 * back;
    p.toppingOffsetY = 10 * up;   // head sinks as the shoulders rise
    p.faceOffsetY = 5 * up;
    p.bodyScaleY = 1 - 0.03 * up;
    p.bodyScaleX = 1 + 0.025 * up + 0.015 * back;

    p.expression = up > 0.7 ? 'calm' : 'happy';
    p.eyeOpen = up > 0.7 ? 1 : blink(t);
    p.mouthCurve = 0.9;
    return p;
  }

  /** Arms open wide and press back, chest swells and the chin lifts with each breath. */
  function chestOpener(t) {
    const p = basePose();
    const open = ramp(t, 0, 1.0);
    const breath = cycle(t, 4.5) * open;

    p.leftArm = mix(REST_ARM, 98, open) + 14 * breath;
    p.rightArm = mix(-REST_ARM, -98, open) - 14 * breath;
    p.leftReach = 1 + 0.3 * open;
    p.rightReach = 1 + 0.3 * open;
    p.leftHand = -35 * open;   // palms open
    p.rightHand = 35 * open;
    p.shoulderLift = 6 * open;

    p.bodyScaleX = 1 + 0.03 * open + 0.04 * breath;
    p.bodyScaleY = 1 + 0.03 * breath;
    p.toppingOffsetY = -22 * breath;
    p.faceOffsetY = -12 * breath;

    p.expression = breath > 0.5 ? 'calm' : 'happy';
    p.eyeOpen = breath > 0.5 ? 1 : blink(t);
    p.mouthCurve = 0.8;
    return p;
  }

  /** Fixed timeline for the walk: out across the screen, a turn-around wave, then back home. */
  const Walk = {
    out: 5.0,
    turn: 1.2,
    back: 5.0,
    get total() { return this.out + this.turn + this.back; },

    /** 0 = home (the popup), 1 = far end of the screen. */
    distance(t) {
      const { out, turn, back } = Walk;
      if (t < out) return smooth(t / out) * 0.98 + 0.02 * clamp01(t / out);
      if (t < out + turn) return 1;
      const u = (t - out - turn) / back;
      return 1 - (smooth(u) * 0.98 + 0.02 * clamp01(u));
    },

    /** -1 walking away (to the left), +1 walking home (to the right), 0 standing. */
    direction(t) {
      if (t < Walk.out) return -1;
      if (t < Walk.out + Walk.turn) return 0;
      if (t < Walk.total) return 1;
      return 0;
    },
  };

  /** A bouncy little walk with swinging arms; at the far end Nori turns and waves. */
  function walkAround(t) {
    const total = Walk.total;
    if (t >= total) {
      // Home again: happy bounce in place.
      const p = idle(t);
      const hop = ramp(t, total, total + 0.4) * (1 - ramp(t, total + 0.8, total + 1.2));
      p.bodyOffsetY = -18 * Math.sin(Math.PI * clamp01((t - total) / 0.8)) * hop;
      p.expression = 'joy';
      p.mouthOpen = hop;
      return p;
    }
    const dir = Walk.direction(t);
    if (dir === 0) {
      const p = waving(t);
      p.rightArm = -150 + 14 * Math.sin(t * 10);
      p.expression = 'joy';
      p.mouthOpen = 0.8;
      return p;
    }

    const p = basePose();
    const sw = Math.sin(2 * Math.PI * t / 0.56);
    p.leftLeg = 20 * sw;
    p.rightLeg = 20 * sw;
    p.leftLegLength = 1 - 0.14 * Math.max(0, sw);
    p.rightLegLength = 1 - 0.14 * Math.max(0, -sw);
    p.bodyOffsetY = -12 * Math.abs(sw);
    p.bodyRotation = 4 * dir + 2 * sw;
    p.leftArm = REST_ARM - 20 * sw;
    p.rightArm = -REST_ARM - 20 * sw;
    p.leftHand = -10 * sw;
    p.rightHand = -10 * sw;
    p.faceOffsetX = 16 * dir;
    p.toppingOffsetX = 6 * dir;
    p.toppingRotation = 2 * sw;
    p.shadowScale = 1 - 0.06 * Math.abs(sw);
    p.eyeOpen = blink(t);
    return p;
  }

  /** 20-20-20: a hand shades the eyes like a salute while Nori scans the horizon. */
  function eyeBreak(t) {
    const p = basePose();
    const up = ramp(t, 0, 0.9);
    const scan = Math.sin(2 * Math.PI * t / 7);

    // Hand flat across the brow (above the eyes), like a lookout's salute.
    p.rightArm = mix(-REST_ARM, -215, up);
    p.rightReach = 1 + 0.75 * up;
    p.rightHand = -55 * up;
    p.rightArmFront = up > 0.35;
    p.leftArm = REST_ARM + 3 * Math.sin(t * 2);

    p.faceOffsetX = (16 * scan - 8) * up;
    p.faceOffsetY = 6 * up;
    p.toppingRotation = 2.5 * scan * up;
    p.bodyRotation = 1.5 * scan * up;
    p.expression = 'focused';
    p.eyeOpen = blink(t, 4.5);
    p.mouthCurve = 0.6;
    return p;
  }

  /** Reach up tall, fold forward until the hands touch the toes, bounce gently, roll back up. */
  function toeTouch(t) {
    const p = basePose();
    const c = t % 6;
    const up = ramp(c, 0, 1.0) * (1 - ramp(c, 1.4, 2.0));
    const fold = ramp(c, 1.6, 2.6) * (1 - ramp(c, 4.6, 5.6));
    const holding = c > 2.6 && c < 4.6 ? 1 : 0;
    const bounce = fold * holding * 0.5 * (1 - Math.cos(2 * Math.PI * (c - 2.6) / 0.9));

    // Arms sweep up overhead, then down in front of the body to the toes.
    p.leftArm = mix(mix(REST_ARM, 150, up), -22, fold);
    p.rightArm = mix(mix(-REST_ARM, -150, up), 22, fold);
    p.leftReach = 1 + 0.9 * up + 1.05 * fold + 0.12 * bounce;
    p.rightReach = 1 + 0.9 * up + 1.05 * fold + 0.12 * bounce;
    p.leftHand = 18 * fold;
    p.rightHand = -18 * fold;
    p.leftArmFront = fold > 0.35;
    p.rightArmFront = fold > 0.35;

    // Fold: the top tips toward us, so the topping and face drop and the body squashes.
    p.bodyScaleY = 1 + 0.05 * up - 0.18 * fold - 0.02 * bounce;
    p.bodyScaleX = 1 - 0.02 * up + 0.05 * fold;
    p.toppingOffsetY = -14 * up + 50 * fold + 5 * bounce;
    p.faceOffsetY = -6 * up + 36 * fold + 4 * bounce;
    p.leftLegLength = 1 + 0.08 * up;
    p.rightLegLength = 1 + 0.08 * up;
    p.shadowScale = 1 + 0.06 * fold;

    p.expression = (up > 0.5 || fold > 0.5) ? 'calm' : 'happy';
    p.eyeOpen = blink(t);
    p.mouthCurve = fold > 0.5 ? 0.3 : 0.8;
    return p;
  }

  /** Points straight up (at the menu bar / tray) with little emphatic jabs, looking up. */
  function pointingUp(t) {
    const p = basePose();
    const up = ramp(t, 0, 0.6);
    const jab = 0.5 + 0.5 * Math.sin(t * 7);
    // Up and out beside the head so the hand rises clear of the salmon.
    p.rightArm = mix(-REST_ARM, -158, up);
    p.rightReach = 1 + (1.55 + 0.2 * jab) * up;
    p.rightHand = -22 * up;
    p.leftArm = mix(REST_ARM, 22, up);   // other hand on the hip
    p.leftHand = -60 * up;
    p.bodyOffsetY = -6 * jab * up;
    p.bodyRotation = -2 * up;
    p.toppingOffsetY = -6 * up;
    p.faceOffsetX = 6 * up;
    p.faceOffsetY = -10 * up;            // eyes up
    p.expression = 'happy';
    p.eyeOpen = blink(t);
    p.mouthOpen = 0.35 * up;
    return p;
  }

  /** Big breath in, slumping sigh out, shoulder shrug with palms up, then the head drops. */
  function disappointed(t) {
    const p = basePose();
    p.expression = 'sad';
    p.blush = 0.5;

    const inhale = ramp(t, 0, 0.7);
    const exhale = ramp(t, 0.7, 1.4);
    const shrug = ramp(t, 1.25, 1.6) - ramp(t, 1.8, 2.15);
    const droop = ramp(t, 1.95, 2.7);

    p.bodyScaleY = 1 + 0.05 * inhale - 0.09 * exhale;
    p.bodyScaleX = 1 - 0.01 * inhale + 0.035 * exhale;

    p.shoulderLift = -16 * inhale + 16 * exhale - 44 * shrug;
    p.leftArm = REST_ARM + 55 * shrug - 18 * droop;
    p.rightArm = -REST_ARM - 55 * shrug + 18 * droop;
    p.leftHand = -45 * shrug;
    p.rightHand = 45 * shrug;

    p.toppingOffsetY = 30 * droop;
    p.toppingRotation = 6 * droop;
    p.faceOffsetY = 24 * droop;
    p.bodyOffsetY = 8 * droop;
    p.bodyRotation = 3 * droop;
    p.eyeOpen = 0.78 - 0.38 * droop;
    p.mouthCurve = 0.2 - 1.2 * ramp(t, 0.3, 0.9);
    return p;
  }

  function celebrating(t) {
    const p = basePose();
    const j = Math.abs(Math.sin(Math.PI * t / 0.55));
    p.bodyOffsetY = -64 * j;
    p.bodyScaleY = 1 - 0.06 * (1 - j);
    p.bodyScaleX = 1 + 0.04 * (1 - j);
    p.leftArm = 158 + 14 * Math.sin(t * 12);
    p.rightArm = -158 - 14 * Math.sin(t * 12 + 1);
    p.leftHand = 20 * Math.sin(t * 12);
    p.rightHand = -20 * Math.sin(t * 12 + 1);
    p.leftLeg = 8 * j;
    p.rightLeg = -8 * j;
    p.expression = 'joy';
    p.mouthOpen = 1;
    p.sparkles = ramp(t, 0, 0.3);
    p.shadowScale = 1 - 0.35 * j;
    return p;
  }

  const STRETCH_FNS = {
    overheadReach, sideBend, eyeBreak, neckRelease, shoulderRolls, toeTouch, chestOpener, walkAround,
  };
  const STRETCHES = Object.keys(STRETCH_FNS);

  function normState(state) {
    return typeof state === 'string' ? { kind: state } : state;
  }

  function makePose(state, t) {
    const s = normState(state);
    switch (s.kind) {
      case 'idle': return idle(t);
      case 'waving': return waving(t);
      case 'stretching': return (STRETCH_FNS[s.stretch] || overheadReach)(t);
      case 'disappointed': return disappointed(t);
      case 'celebrating': return celebrating(t);
      case 'pointingUp': return pointingUp(t);
      default: return idle(t);
    }
  }

  // ---------------------------------------------------------------------------
  // Path helpers

  /**
   * Rounded rect with per-corner radii [topLeft, topRight, bottomRight, bottomLeft].
   * `continuous` approximates SwiftUI's squircle corners (longer, softer transition).
   */
  function roundRectPath(x, y, w, h, radii, continuous) {
    const p = new Path2D();
    const lim = Math.min(w, h) / 2;
    const corner = radii.map((r) => {
      r = Math.min(r, lim);
      // A continuous corner leaves the edge earlier (~1.28r) but passes the same 45° point as
      // a circle; like SwiftUI, fall back to a circular corner when that doesn't fit.
      if (continuous && r * 1.28 <= lim) return { d: r * 1.28, c: r * 0.355 };
      return { d: r, c: r * (1 - 0.5523) };
    });
    const [tl, tr, br, bl] = corner;
    p.moveTo(x + tl.d, y);
    p.lineTo(x + w - tr.d, y);
    p.bezierCurveTo(x + w - tr.c, y, x + w, y + tr.c, x + w, y + tr.d);
    p.lineTo(x + w, y + h - br.d);
    p.bezierCurveTo(x + w, y + h - br.c, x + w - br.c, y + h, x + w - br.d, y + h);
    p.lineTo(x + bl.d, y + h);
    p.bezierCurveTo(x + bl.c, y + h, x, y + h - bl.c, x, y + h - bl.d);
    p.lineTo(x, y + tl.d);
    p.bezierCurveTo(x, y + tl.c, x + tl.c, y, x + tl.d, y);
    p.closePath();
    return p;
  }

  function capsulePath(x, y, w, h) {
    const r = Math.min(w, h) / 2;
    return roundRectPath(x, y, w, h, [r, r, r, r], false);
  }

  function ellipsePath(cx, cy, w, h) {
    const p = new Path2D();
    p.ellipse(cx, cy, w / 2, h / 2, 0, 0, 2 * Math.PI);
    return p;
  }

  function vGradient(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
  }

  function fillStroke(ctx, path, fill, lineWidth = LINE, join = 'miter') {
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = join;
    ctx.stroke(path);
  }

  // Canvas spans ref y 100…900; SwiftUI gradients on full-canvas shapes use that span.
  const CANVAS_TOP = ORIGIN.y, CANVAS_BOTTOM = ORIGIN.y + CANVAS.height;

  // ---------------------------------------------------------------------------
  // Static shapes (reference-artwork coordinates)

  /** Rice body: soft rounded square, flat top under the nori, grainy sides, scalloped bottom. */
  const RICE = (() => {
    const cx = 508, cy = 600, a = 262, bTop = 200, bBottom = 196;
    const p = new Path2D();
    const n = 520;
    for (let i = 0; i <= n; i++) {
      const th = i / n * 2 * Math.PI;
      const c = Math.cos(th), s = Math.sin(th);
      const lower = s > 0;
      const ex = lower ? 2.25 : 7.0;
      const px = a * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 2 / ex);
      const py = (lower ? bBottom : -bTop) * Math.pow(Math.abs(s), 2 / ex);
      // Bumps: none on the hidden top, fine grains on the sides, big scallops on the bottom.
      const sideWeight = lower ? 1 : Math.pow(Math.abs(c), 6);
      const depth = (0.011 + 0.017 * Math.max(0, s)) * sideWeight;
      const bumps = lower ? 38 : 52;
      const k = (1 - depth) + depth * Math.abs(Math.sin(th * bumps / 2));
      const x = cx + px * k, y = cy + py * k;
      if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    p.closePath();
    return p;
  })();

  /** Little cloud-like grain bumps on the rice, clustered toward the bottom. */
  const RICE_CURLS = (() => {
    const spots = [
      [282, 560, 12], [276, 640, 14], [292, 715, 13], [735, 565, 12], [742, 650, 14],
      [722, 725, 13], [390, 720, 15], [420, 750, 13], [455, 715, 12], [520, 755, 14],
      [565, 722, 12], [615, 752, 15], [345, 760, 14], [670, 768, 13], [480, 778, 12],
      [300, 505, 10], [720, 505, 10],
    ];
    const p = new Path2D();
    for (const [x, y, r] of spots) {
      p.moveTo(x - r, y);
      p.arc(x, y, r, Math.PI, 330 * DEG, false);
    }
    return p;
  })();

  /** Nori band: sides follow the body, bottom edge curves around the front of the head. */
  const NORI = (() => {
    const p = new Path2D();
    p.moveTo(246, 350);
    p.lineTo(768, 350);
    p.quadraticCurveTo(770, 420, 762, 470);
    p.quadraticCurveTo(760, 484, 744, 486);
    p.quadraticCurveTo(507, 512, 270, 484);
    p.quadraticCurveTo(254, 482, 252, 468);
    p.quadraticCurveTo(244, 420, 246, 350);
    p.closePath();
    return p;
  })();

  const NORI_SPECKLES = (() => {
    const marks = [
      [300, 400, 7, 30], [360, 420, 6, 18], [430, 395, 7, 34], [505, 425, 6, 20],
      [565, 400, 7, 30], [630, 428, 6, 18], [690, 398, 7, 32], [735, 430, 6, 16],
      [280, 450, 12, 8], [470, 462, 14, 8], [610, 460, 12, 7],
    ];
    const p = new Path2D();
    for (const [x, y, w, h] of marks) {
      const r = Math.min(w, h) / 2;
      p.addPath(roundRectPath(x - w / 2, y - h / 2, w, h, [r, r, r, r], true));
    }
    return p;
  })();

  /** Salmon slice: a plump, slightly asymmetric loaf with rounded ends draping past the nori. */
  const SALMON = (() => {
    const p = new Path2D();
    p.moveTo(214, 404);
    p.bezierCurveTo(184, 236, 352, 160, 478, 160);
    p.bezierCurveTo(608, 160, 834, 250, 802, 404);
    p.quadraticCurveTo(808, 430, 774, 428);
    p.bezierCurveTo(660, 358, 330, 356, 236, 420);
    p.quadraticCurveTo(204, 424, 214, 404);
    p.closePath();
    return p;
  })();

  /** The darker lower band of the salmon, divided from the lighter top by a gentle wave. */
  const SALMON_LOWER = (() => {
    const p = new Path2D();
    p.moveTo(180, 330);
    p.bezierCurveTo(420, 280, 600, 350, 840, 300);
    p.lineTo(840, 460);
    p.lineTo(180, 460);
    p.closePath();
    return p;
  })();

  /** Fat lines: thin, softly wavy, sweeping from lower-left to upper-right. */
  const SALMON_STRIPES = (() => {
    const p = new Path2D();
    for (let i = 0; i < 6; i++) {
      const x0 = 236 + 98 * i;
      p.moveTo(x0, 440);
      p.bezierCurveTo(x0 + 90, 360, x0 + 30, 250, x0 + 150, 150);
    }
    return p;
  })();

  // ---------------------------------------------------------------------------
  // Body parts

  function drawShadow(ctx, pose) {
    ctx.fillStyle = 'rgba(107, 90, 85, 0.16)';
    ctx.fill(ellipsePath(512, 864, 440 * pose.shadowScale, 40));
  }

  /** Leg hangs from the hip (top centre) and rotates about it. */
  function drawLeg(ctx, angle, length, hipX) {
    const h = 100 * length;
    ctx.save();
    ctx.translate(hipX, 764);
    ctx.rotate(angle * DEG);
    const shape = roundRectPath(-43, 0, 86, h, [16, 16, 40, 40], true);
    ctx.fillStyle = vGradient(ctx, 0, h, [[0, C.rice], [1, C.riceShade]]);
    ctx.fill(shape);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = LINE;
    ctx.lineJoin = 'miter';
    ctx.stroke(shape);
    ctx.restore();
  }

  /** Mitten in its 110×110 frame, drawn with the origin at the frame's top centre (the wrist). */
  function drawMitten(ctx, thumbSide) {
    // Thumb
    ctx.save();
    ctx.translate(36 * thumbSide, 58);
    ctx.rotate(-24 * thumbSide * DEG);
    fillStroke(ctx, ellipsePath(0, 0, 38, 50), C.rice);
    ctx.restore();
    // Palm
    fillStroke(ctx, ellipsePath(0, 68, 84, 80), C.rice);
    // Nori cuff
    const cuff = roundRectPath(-45, 1, 90, 44, [12, 12, 12, 12], true);
    fillStroke(ctx, cuff, vGradient(ctx, 1, 45, [[0, C.noriLight], [1, C.nori]]));
  }

  /** Arm hangs from the shoulder: capsule + mitten bent at the wrist, all rotated about the shoulder. */
  function drawArm(ctx, pose, angle, hand, reach, thumb, sx, sy) {
    const upper = 84 * reach;
    ctx.save();
    ctx.translate(sx, sy + pose.shoulderLift);
    ctx.rotate(angle * DEG);
    fillStroke(ctx, capsulePath(-38, 0, 76, upper + 36), C.rice);
    ctx.translate(0, upper);
    ctx.rotate(hand * DEG);
    drawMitten(ctx, thumb);
    ctx.restore();
  }

  const drawLeftArm = (ctx, p) => drawArm(ctx, p, p.leftArm, p.leftHand, p.leftReach, 1, 290, 612);
  const drawRightArm = (ctx, p) => drawArm(ctx, p, p.rightArm, p.rightHand, p.rightReach, -1, 736, 606);

  function drawRice(ctx) {
    ctx.save();
    ctx.clip(RICE);
    ctx.fillStyle = vGradient(ctx, CANVAS_TOP, CANVAS_BOTTOM, [[0.45, C.rice], [0.9, '#F3ECE2']]);
    ctx.fill(RICE);
    ctx.strokeStyle = '#E4DACB';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke(RICE_CURLS);
    ctx.restore();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = LINE;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    ctx.stroke(RICE);
  }

  function drawNoriBand(ctx) {
    ctx.save();
    ctx.clip(NORI);
    ctx.fillStyle = vGradient(ctx, CANVAS_TOP, CANVAS_BOTTOM, [[0.33, '#41613E'], [0.48, '#2B4428']]);
    ctx.fill(NORI);
    ctx.fillStyle = 'rgba(110, 144, 101, 0.3)';
    ctx.fill(NORI_SPECKLES);
    ctx.restore();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = LINE;
    ctx.lineJoin = 'round';
    ctx.stroke(NORI);
  }

  function drawSalmon(ctx) {
    ctx.save();
    ctx.clip(SALMON);
    ctx.fillStyle = '#F9925C';
    ctx.fill(SALMON);
    ctx.fillStyle = '#EF7A45';
    ctx.fill(SALMON_LOWER);
    ctx.strokeStyle = 'rgba(255, 217, 196, 0.85)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke(SALMON_STRIPES);
    // Glossy highlights
    const highlight = (x, y, w, h, deg, alpha) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(deg * DEG);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill(capsulePath(-w / 2, -h / 2, w, h));
      ctx.restore();
    };
    highlight(292, 232, 64, 13, -32, 0.45);
    highlight(250, 282, 22, 11, -50, 0.35);
    ctx.restore();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = LINE;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    ctx.stroke(SALMON);
  }

  /** Nori band + salmon, shifted then rotated about the neck. */
  function drawTopping(ctx, pose) {
    ctx.save();
    ctx.translate(NECK.x, NECK.y);
    ctx.rotate(pose.toppingRotation * DEG);
    ctx.translate(-NECK.x, -NECK.y);
    ctx.translate(pose.toppingOffsetX, pose.toppingOffsetY);
    drawNoriBand(ctx);
    drawSalmon(ctx);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Face

  /** Quadratic arc across a w×h box centred on the origin; positive bulge curves downward. */
  function arcStroke(ctx, w, h, bulge) {
    const y = bulge > 0 ? -h / 2 + 2 : h / 2 - 2;
    ctx.beginPath();
    ctx.moveTo(-w / 2, y);
    ctx.quadraticCurveTo(0, y + bulge * 1.6, w / 2, y);
    ctx.strokeStyle = C.eye;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  /** One eye, centred on the origin. */
  function drawEye(ctx, pose, mirrored) {
    switch (pose.expression) {
      case 'happy':
      case 'focused':
        ctx.save();
        ctx.scale(1, pose.eyeOpen);
        ctx.fillStyle = C.eye;
        ctx.fill(ellipsePath(0, 0, 74, 74));
        ctx.fillStyle = '#FFFFFF';
        ctx.fill(ellipsePath(-11, -12, 27, 27));
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill(ellipsePath(15, 14, 11, 11));
        ctx.restore();
        break;
      case 'calm':
        arcStroke(ctx, 60, 26, 16);
        break;
      case 'joy':
        arcStroke(ctx, 60, 30, -18);
        break;
      case 'sad':
      case 'sleepy': {
        const lid = 74 * (1 - pose.eyeOpen);
        const tilt = (pose.expression === 'sleepy' ? 0 : (mirrored ? 18 : -18)) * DEG;
        // Top-aligned ZStack; it grows past 74 only if the lid rect does (then it re-centres).
        const top = -Math.max(74, lid + 14) / 2;
        ctx.save();
        ctx.clip(ellipsePath(0, 0, 74, 74));
        ctx.fillStyle = C.eye;
        ctx.fill(ellipsePath(0, top + 37, 74, 74));
        ctx.fillStyle = '#FFFFFF';
        ctx.fill(ellipsePath(-12, top + 46, 20, 20));
        // Lid (rice-coloured) and its dark edge, each rotated about its own un-offset frame centre.
        const rotatedRect = (frameH, dy, color) => {
          const cy = top + frameH / 2;
          ctx.save();
          ctx.translate(0, cy);
          ctx.rotate(tilt);
          ctx.translate(0, -cy + dy);
          ctx.fillStyle = color;
          ctx.fillRect(-60, top, 120, frameH);
          ctx.restore();
        };
        rotatedRect(lid + 14, -14, C.rice);
        rotatedRect(9, lid - 5, C.eye);
        ctx.restore();
        break;
      }
    }
  }

  function drawMouth(ctx, pose) {
    if (pose.mouthOpen > 0.05) {
      const w = 70, h = 42 * pose.mouthOpen;
      const openMouth = (bw, bh) => {
        const p = new Path2D();
        p.moveTo(-bw / 2, -bh / 2);
        p.lineTo(bw / 2, -bh / 2);
        p.quadraticCurveTo(0, -bh / 2 + bh * 1.6, -bw / 2, -bh / 2);
        p.closePath();
        return p;
      };
      const mouth = openMouth(w, h);
      ctx.fillStyle = '#9A3B3B';
      ctx.fill(mouth);
      // Tongue: an offset ellipse clipped to a small mouth shape in its own (un-offset) frame.
      ctx.save();
      ctx.clip(openMouth(34, 18));
      ctx.fillStyle = C.cheek;
      ctx.fill(ellipsePath(0, 12, 34, 18));
      ctx.restore();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 6;
      ctx.lineJoin = 'miter';
      ctx.stroke(mouth);
    } else {
      const w = pose.expression === 'focused' ? 44 : 66;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.quadraticCurveTo(0, pose.mouthCurve * 34 * 0.8, w / 2, 0);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  function drawFace(ctx, pose) {
    const turn = pose.faceTurn;
    const spread = 105 * (1 - 0.28 * Math.abs(turn));
    const cx = 510 + 82 * turn + pose.faceOffsetX;
    const ey = 540 + pose.faceOffsetY;

    const eyeAt = (x, squash, mirrored) => {
      ctx.save();
      ctx.translate(x, ey);
      ctx.scale(squash ? 1 - 0.22 * Math.abs(turn) : 1, 1);
      drawEye(ctx, pose, mirrored);
      ctx.restore();
    };
    eyeAt(cx - spread, turn < 0, false);
    eyeAt(cx + spread, turn > 0, true);

    ctx.fillStyle = C.cheek;
    ctx.globalAlpha = clamp01(0.8 * pose.blush);
    ctx.fill(ellipsePath(cx - spread * 1.26, ey + 63, 58, 34));
    ctx.fill(ellipsePath(cx + spread * 1.26, ey + 63, 58, 34));
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(cx, ey + 40);
    drawMouth(ctx, pose);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Effects (stand-ins for the SF Symbols "sparkle" and "heart.fill")

  function sparklePath(size) {
    const R = size * 0.45, k = R * 0.16;
    const p = new Path2D();
    p.moveTo(0, -R);
    p.quadraticCurveTo(k, -k, R, 0);
    p.quadraticCurveTo(k, k, 0, R);
    p.quadraticCurveTo(-k, k, -R, 0);
    p.quadraticCurveTo(-k, -k, 0, -R);
    p.closePath();
    return p;
  }

  function heartPath(size) {
    const w = size * 0.92, h = size * 0.82;
    const p = new Path2D();
    const top = -h / 2, bottom = h / 2;
    p.moveTo(0, bottom);
    p.bezierCurveTo(-w * 0.18, bottom - h * 0.16, -w / 2, top + h * 0.52, -w / 2, top + h * 0.27);
    p.bezierCurveTo(-w / 2, top + h * 0.08, -w * 0.36, top, -w * 0.25, top);
    p.bezierCurveTo(-w * 0.11, top, -w * 0.03, top + h * 0.08, 0, top + h * 0.2);
    p.bezierCurveTo(w * 0.03, top + h * 0.08, w * 0.11, top, w * 0.25, top);
    p.bezierCurveTo(w * 0.36, top, w / 2, top + h * 0.08, w / 2, top + h * 0.27);
    p.bezierCurveTo(w / 2, top + h * 0.52, w * 0.18, bottom - h * 0.16, 0, bottom);
    p.closePath();
    return p;
  }

  function drawEffects(ctx, pose, time) {
    if (pose.sparkles <= 0.01) return;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * 2 * Math.PI + time * 0.8;
      const r = 360 + 24 * Math.sin(time * 3 + i);
      const isSparkle = i % 2 === 0;
      ctx.save();
      ctx.translate(512 + Math.cos(a) * r, 520 + pose.bodyOffsetY + Math.sin(a) * r * 0.85);
      const s = 0.7 + 0.35 * Math.sin(time * 5 + i);
      ctx.scale(s, s);
      ctx.globalAlpha = clamp01(pose.sparkles);
      ctx.fillStyle = i % 3 === 0 ? C.butter : C.pink;
      ctx.fill(isSparkle ? sparklePath(64) : heartPath(46));
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // Whole figure

  function drawCharacter(ctx, pose) {
    drawLeg(ctx, 4 + pose.leftLeg, pose.leftLegLength, 420);
    drawLeg(ctx, -4 + pose.rightLeg, pose.rightLegLength, 594);
    if (!pose.leftArmFront) drawLeftArm(ctx, pose);
    if (!pose.rightArmFront) drawRightArm(ctx, pose);
    drawRice(ctx);
    drawTopping(ctx, pose);
    drawFace(ctx, pose);
    if (pose.leftArmFront) drawLeftArm(ctx, pose);
    if (pose.rightArmFront) drawRightArm(ctx, pose);
  }

  /**
   * Draw Nori fitted (uniform scale, centred) into the box (x, y, w, h).
   * `time` (seconds) only drives the celebration sparkles' orbit.
   */
  function draw(ctx, pose, time, x, y, w, h) {
    const s = Math.min(w / CANVAS.width, h / CANVAS.height);
    ctx.save();
    ctx.translate(x + (w - CANVAS.width * s) / 2, y + (h - CANVAS.height * s) / 2);
    ctx.scale(s, s);
    ctx.translate(-ORIGIN.x, -ORIGIN.y);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    drawShadow(ctx, pose);

    // scaleEffect then rotationEffect (both about the pivot between the feet), then offset.
    ctx.save();
    ctx.translate(0, pose.bodyOffsetY);
    ctx.translate(PIVOT.x, PIVOT.y);
    ctx.rotate(pose.bodyRotation * DEG);
    ctx.scale(pose.bodyScaleX, pose.bodyScaleY);
    ctx.translate(-PIVOT.x, -PIVOT.y);
    drawCharacter(ctx, pose);
    ctx.restore();

    drawEffects(ctx, pose, time);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Animator (AnimationViewModel's pose blending)

  const nowSeconds = () => performance.now() / 1000;
  const BLEND_DURATION = 0.35;

  class Animator {
    constructor(initialState = { kind: 'idle' }, mood = 'normal', now = nowSeconds()) {
      this.state = normState(initialState);
      this.mood = mood;
      this.stateStartedAt = now;
      this.blendFrom = null;
      this.blendStartedAt = now;
    }

    /** Switch state, cross-fading from the current pose. */
    transition(state, now = nowSeconds()) {
      this.blendFrom = this.pose(now);
      this.blendStartedAt = now;
      this.state = normState(state);
      this.stateStartedAt = now;
    }

    pose(now = nowSeconds()) {
      const t = now - this.stateStartedAt;
      let target = makePose(this.state, t);
      const kind = this.state.kind;
      if (kind === 'idle' || kind === 'waving') {
        target = applyMood(target, this.mood, t, kind === 'idle');
      }
      if (!this.blendFrom) return target;
      const k = (now - this.blendStartedAt) / BLEND_DURATION;
      return k >= 1 ? target : lerpPose(this.blendFrom, target, smooth(k));
    }
  }

  global.Nori = {
    CANVAS,
    STRETCHES,
    REST_ARM,
    COLORS: C,
    makePose,
    applyMood,
    lerpPose,
    Walk,
    ramp,
    smooth,
    bell,
    clamp01,
    mix,
    draw,
    Animator,
  };
})(typeof window !== 'undefined' ? window : globalThis);
