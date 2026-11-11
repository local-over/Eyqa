/**
 * Eyqa Multi-Frame Living Mascot Animator
 * Controls the character frames (far, close, wink, blink)
 * for splash screen, brand header, and interactive events.
 */

export class MascotAnimator {
  constructor() {
    this.frames = {
      far: 'assets/frames/eyqa_far.png',
      close: 'assets/frames/eyqa_close.png',
      wink: 'assets/frames/eyqa_wink.png',
      blink: 'assets/frames/eyqa_blink.png'
    };
    this.preloaded = {};
    this._preload();
  }

  _preload() {
    Object.entries(this.frames).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      this.preloaded[key] = img;
    });
  }

  /**
   * Plays the multi-frame cinematic startup sequence:
   * 1. Distance frame (eyqa_far.png) - mascot in distance
   * 2. Smooth zoom closer (eyqa_close.png) - direct gaze
   * 3. Playful wink (eyqa_wink.png)
   * 4. Happy blink (eyqa_blink.png)
   * 5. Settle into crisp portrait with typography reveal
   */
  async playSplashSequence(imgEl, stageEl, onComplete) {
    if (!imgEl) {
      if (onComplete) onComplete();
      return;
    }

    try {
      // Step 1: Distance frame
      imgEl.src = this.frames.far;
      imgEl.className = 'splash-frame-img frame-far';
      await new Promise(r => setTimeout(r, 650));

      // Step 2: Smooth transition to closer frame
      imgEl.src = this.frames.close;
      imgEl.className = 'splash-frame-img frame-close';
      await new Promise(r => setTimeout(r, 700));

      // Step 3: Playful wink frame
      imgEl.src = this.frames.wink;
      imgEl.className = 'splash-frame-img frame-wink';
      await new Promise(r => setTimeout(r, 380));

      // Step 4: Warm smile blink frame
      imgEl.src = this.frames.blink;
      imgEl.className = 'splash-frame-img frame-blink';
      await new Promise(r => setTimeout(r, 260));

      // Step 5: Settle back to close portrait with brand lockup reveal
      imgEl.src = this.frames.close;
      imgEl.className = 'splash-frame-img frame-settled';
      if (stageEl) {
        stageEl.classList.add('splash-ready');
      }

      await new Promise(r => setTimeout(r, 700));
      if (onComplete) onComplete();
    } catch (err) {
      console.error('[MascotAnimator] Splash sequence error:', err);
      if (onComplete) onComplete();
    }
  }

  /**
   * Triggers an interactive blink or wink on any mascot element
   */
  async triggerReaction(imgEl, type = 'wink', duration = 300) {
    if (!imgEl) return;
    const originalSrc = imgEl.src;
    imgEl.src = this.frames[type] || this.frames.wink;
    await new Promise(r => setTimeout(r, duration));
    imgEl.src = originalSrc;
  }

  /**
   * Attaches interactive hover / click reactions to brand and hero mascots
   */
  attachInteractivity() {
    // Sidebar brand hover: playful wink
    const sidebarMascot = document.getElementById('sidebarBrandMascot');
    const brandLink = document.getElementById('brandHomeLink');
    if (brandLink && sidebarMascot) {
      brandLink.addEventListener('mouseenter', () => {
        this.triggerReaction(sidebarMascot, 'wink', 350);
      });
    }

    // Hero mascot click: friendly blink
    document.addEventListener('click', (e) => {
      const hero = e.target.closest('#heroMascotImg') || e.target.closest('.welcome-mascot-img');
      if (hero) {
        this.triggerReaction(hero, 'wink', 350);
      }
    });

    // Periodic gentle idle blink on sidebar mascot
    setInterval(() => {
      const el = document.getElementById('sidebarBrandMascot');
      if (el && Math.random() > 0.4) {
        this.triggerReaction(el, 'blink', 220);
      }
    }, 6000);
  }

  /**
   * Smooth, natural frame-by-frame loop for live indexer/generation states
   * Cycles character frames organically (far -> close -> wink -> close)
   */
  startWidgetLoop(imgEl) {
    if (!imgEl) return null;
    const loopFrames = [this.frames.far, this.frames.close, this.frames.wink, this.frames.close];
    let idx = 0;
    imgEl.src = loopFrames[0];
    const interval = setInterval(() => {
      if (!imgEl.isConnected) {
        clearInterval(interval);
        return;
      }
      idx = (idx + 1) % loopFrames.length;
      imgEl.src = loopFrames[idx];
    }, 320);
    imgEl._mascotLoopInterval = interval;
    return interval;
  }

  stopWidgetLoop(imgEl) {
    if (imgEl && imgEl._mascotLoopInterval) {
      clearInterval(imgEl._mascotLoopInterval);
      imgEl._mascotLoopInterval = null;
    }
  }
}

export const mascotAnimator = new MascotAnimator();
