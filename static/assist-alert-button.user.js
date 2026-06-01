// ==UserScript==
// @name         Torn Assist Button Lite
// @namespace    Fries91.Torn.AssistButton
// @version      3.7.0
// @description  Lightweight Assist button for TornPDA. Chat must be open. One tap sends one assist message.
// @author       Fries91
// @match        https://www.torn.com/*
// @match        https://www.torn.com/loader.php*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Fries91/Assist-alert-button/main/static/assist-alert-button.user.js
// @downloadURL  https://raw.githubusercontent.com/Fries91/Assist-alert-button/main/static/assist-alert-button.user.js
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '3.7.0';
  const BAR_ID = 'fries91-assist-lite-bar';
  const TOAST_ID = 'fries91-assist-lite-toast';
  const GLOBAL_LOCK_KEY = 'fries91_assist_lite_lock_v37';

  let installed = false;
  let sendLocked = false;

  function css(el, prop, value) {
    if (el) el.style.setProperty(prop, value, 'important');
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 8 && r.height > 8 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function isAttackPage() {
    const url = new URL(location.href);
    const txt = (document.body?.innerText || '').slice(0, 6000).toLowerCase();

    return (
      url.searchParams.get('sid') === 'attack' ||
      location.href.toLowerCase().includes('sid=attack') ||
      txt.includes('you do not have enough energy') ||
      txt.includes('start fight') ||
      txt.includes('attack again') ||
      (txt.includes('attacking') && txt.includes('fairfight')) ||
      (txt.includes('attacking') && txt.includes('unknown'))
    );
  }

  function getAttackTargetId() {
    const url = new URL(location.href);
    const keys = ['user2ID', 'userID', 'targetID', 'target_id', 'playerID', 'XID'];

    for (const key of keys) {
      const val = url.searchParams.get(key);
      if (val && /^\d+$/.test(val)) return val;
    }

    return '';
  }

  function randomAssistText() {
    const messages = [
      '⚔️ Tactical mistake detected. Backup required!',
      '🚨 I have made a poor life choice. Send help!',
      '🥴 I poked the wrong bear. Faction, assemble!',
      '📉 My confidence has left the chat. Backup needed!',
      '🧯 The plan is on fire. Please bring people.',
      '🐢 Tactical bravery has expired. Assist!',
      '🥊 I started it. They are finishing it. Help!',
      '🆘 Emergency tactical friendship request!',
      '🤡 Clown move detected. Backup appreciated.',
      '🚑 My face is filing a complaint. Send backup!',
      '🪓 I chose violence and violence chose me back.',
      '💀 This was supposed to be a quick hit. It is not.',
      '🎯 Target acquired. Regret also acquired.',
      '📞 Hello faction support? I broke myself.',
      '🧨 This escalated from fight to group project.',
      '🧯 Situation status: spicy. Assistance required.',
      '🪖 Operation Save My Face is now active.',
      '💣 Tiny tactical oopsie. Big backup needed.',
      '📉 My health bar is investing in failure.',
      '🦖 I have discovered a dinosaur with fists. Help!'
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  function buildAssistMessage() {
    const targetId = getAttackTargetId();
    const link = targetId
      ? `https://www.torn.com/loader.php?sid=attack&user2ID=${targetId}`
      : location.href;

    return `${randomAssistText()} Join/help fight here: ${link}`;
  }

  function toast(message, good = true) {
    let box = document.getElementById(TOAST_ID);

    if (!box) {
      box = document.createElement('div');
      box.id = TOAST_ID;
      document.body.appendChild(box);
    }

    css(box, 'position', 'fixed');
    css(box, 'left', '50%');
    css(box, 'top', '74px');
    css(box, 'transform', 'translateX(-50%)');
    css(box, 'z-index', '2147483647');
    css(box, 'max-width', '92vw');
    css(box, 'padding', '10px 14px');
    css(box, 'border-radius', '12px');
    css(box, 'font', '700 13px Arial,sans-serif');
    css(box, 'box-shadow', '0 8px 28px rgba(0,0,0,.45)');
    css(box, 'text-align', 'center');
    css(box, 'pointer-events', 'none');
    css(box, 'transition', 'opacity .15s ease');

    box.textContent = message;
    css(box, 'background', good ? '#12351f' : '#3a1111');
    css(box, 'color', good ? '#d7ffe1' : '#ffd6d6');
    css(box, 'border', good ? '1px solid #2ecc71' : '1px solid #ff5b5b');
    css(box, 'opacity', '1');

    clearTimeout(box._hideTimer);
    box._hideTimer = setTimeout(() => {
      css(box, 'opacity', '0');
    }, 2500);
  }

  function makeBar() {
    let bar = document.getElementById(BAR_ID);

    if (!bar) {
      bar = document.createElement('div');
      bar.id = BAR_ID;

      const text = document.createElement('span');
      text.textContent = 'Mistake detected.';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '⚔ ASSIST';

      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        sendAssistOnce();
      });

      bar.appendChild(text);
      bar.appendChild(btn);
    }

    css(bar, 'display', 'flex');
    css(bar, 'align-items', 'center');
    css(bar, 'justify-content', 'space-between');
    css(bar, 'gap', '5px');
    css(bar, 'box-sizing', 'border-box');
    css(bar, 'width', 'calc(100% - 24px)');
    css(bar, 'margin', '1px auto 2px auto');
    css(bar, 'padding', '2px 6px');
    css(bar, 'border', '1px solid #b78326');
    css(bar, 'border-radius', '6px');
    css(bar, 'background', 'linear-gradient(180deg, rgba(43,9,9,.96), rgba(11,5,5,.96))');
    css(bar, 'box-shadow', '0 1px 6px rgba(0,0,0,.45)');
    css(bar, 'color', '#ffd36a');
    css(bar, 'font', '900 11px Arial,sans-serif');
    css(bar, 'line-height', '1');
    css(bar, 'position', 'relative');
    css(bar, 'z-index', '20');
    css(bar, 'min-height', '22px');
    css(bar, 'max-height', '26px');
    css(bar, 'overflow', 'hidden');

    const btn = bar.querySelector('button');
    css(btn, 'padding', '2px 8px');
    css(btn, 'min-height', '20px');
    css(btn, 'border', '1px solid #ffcc55');
    css(btn, 'border-radius', '6px');
    css(btn, 'background', 'linear-gradient(180deg,#5a1414,#180606)');
    css(btn, 'color', '#fff0b0');
    css(btn, 'font', '900 10px Arial,sans-serif');
    css(btn, 'box-shadow', '0 1px 5px rgba(0,0,0,.55)');
    css(btn, 'touch-action', 'manipulation');
    css(btn, 'cursor', 'pointer');
    css(btn, 'white-space', 'nowrap');

    return bar;
  }

  function findAttackTitleAnchor() {
    const candidates = Array.from(document.querySelectorAll('div, h1, h2, h3, span'))
      .filter(visible)
      .filter(el => (el.textContent || '').trim() === 'Attacking')
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    return candidates.find(el => el.getBoundingClientRect().top > 170) || candidates[0] || null;
  }

  function installBar() {
    const oldBars = Array.from(document.querySelectorAll('[id^="fries91-assist-"]'))
      .filter(el => el.id !== BAR_ID && el.id !== TOAST_ID);

    // Remove old Assist bars from previous versions so they don't fight this one.
    for (const el of oldBars) el.remove();

    if (!isAttackPage()) {
      const bar = document.getElementById(BAR_ID);
      if (bar) bar.remove();
      installed = false;
      return;
    }

    const bar = makeBar();

    if (bar.parentElement) return;

    const anchor = findAttackTitleAnchor();

    if (anchor && anchor.parentElement) {
      anchor.parentElement.insertBefore(bar, anchor);
      installed = true;
      return;
    }

    document.body.prepend(bar);
    installed = true;
  }

  function findChatInput() {
    const inputs = Array.from(document.querySelectorAll('textarea, input[type="text"], input:not([type]), [contenteditable="true"], [role="textbox"]'))
      .filter(visible)
      .filter(el => {
        const tag = (el.tagName || '').toLowerCase();
        const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
        const role = (el.getAttribute('role') || '').toLowerCase();

        return (
          el.isContentEditable ||
          tag === 'textarea' ||
          tag === 'input' ||
          role === 'textbox' ||
          placeholder.includes('message') ||
          placeholder.includes('chat')
        );
      })
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);

    return inputs[0] || null;
  }

  function setInputText(input, text) {
    input.focus();

    if ('value' in input) {
      const proto = Object.getPrototypeOf(input);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc?.set) desc.set.call(input, text);
      else input.value = text;

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    input.textContent = text;
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text
    }));
  }

  function findSendButtonNearInput(input) {
    const r = input.getBoundingClientRect();

    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], svg, span, div'))
      .filter(visible)
      .filter(el => !el.closest('#' + BAR_ID))
      .map(el => {
        const er = el.getBoundingClientRect();
        const txt = (el.textContent || el.value || '').toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();
        const cls = (el.className || '').toString().toLowerCase();

        let score = 0;

        if (txt.includes('send')) score += 100;
        if (aria.includes('send')) score += 100;
        if (title.includes('send')) score += 100;
        if (cls.includes('send')) score += 80;

        // The TornPDA paper-plane is usually just to the right of the message box.
        const inputMid = r.top + r.height / 2;
        const elMid = er.top + er.height / 2;

        if (er.left > r.right - 10 && Math.abs(elMid - inputMid) < 60) score += 120;
        if (er.left > window.innerWidth * 0.82 && er.top > window.innerHeight * 0.35) score += 40;

        if (er.width > 140 || er.height > 100) score -= 80;

        return { el, score };
      })
      .filter(x => x.score > 70)
      .sort((a, b) => b.score - a.score);

    const found = buttons[0]?.el || null;
    return found?.closest?.('button, [role="button"], input[type="submit"], a') || found;
  }

  function clickEl(el) {
    if (!el) return;

    // If detector grabbed an icon/svg/path, click the real clickable parent once.
    const clickable =
      el.closest?.('button, [role="button"], input[type="submit"], a') ||
      el;

    // ONE action only. Do not dispatch mousedown/mouseup + click + .click(),
    // because TornPDA can treat that as multiple sends.
    try {
      clickable.click();
    } catch (_) {
      clickable.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      }));
    }
  }

  async function sendAssistOnce() {
    const now = Date.now();
    const last = Number(localStorage.getItem(GLOBAL_LOCK_KEY) || '0');

    // Hard lock: no second assist send for 10 seconds, no matter what.
    if (sendLocked || now - last < 10000) {
      toast('Already sent. Wait a few seconds.', false);
      return;
    }

    sendLocked = true;
    localStorage.setItem(GLOBAL_LOCK_KEY, String(now));

    const assistBtn = document.querySelector('#' + BAR_ID + ' button');
    if (assistBtn) {
      assistBtn.disabled = true;
      assistBtn.textContent = 'SENT';
      css(assistBtn, 'opacity', '.65');
    }

    try {
      const input = findChatInput();

      if (!input) {
        toast('Open faction chat first, then tap ASSIST.', false);
        return;
      }

      const message = buildAssistMessage();
      setInputText(input, message);

      await sleep(200);

      const sendBtn = findSendButtonNearInput(input);

      if (!sendBtn) {
        toast('Message ready. Tap send.', false);
        return;
      }

      // ONE click only.
      clickEl(sendBtn);
      toast('Assist sent once.');
    } finally {
      setTimeout(() => {
        sendLocked = false;
        if (assistBtn) {
          assistBtn.disabled = false;
          assistBtn.textContent = '⚔ ASSIST';
          css(assistBtn, 'opacity', '1');
        }
      }, 10000);
    }
  }

  function bootLite() {
    // No MutationObserver. No heavy scanning loop. PDA-safe.
    installBar();
    setInterval(installBar, 4000);
  }

  bootLite();
})();
