// ==UserScript==
// @name         Torn Fight Assist Bar Under News Ticker
// @namespace    Fries91.Torn.AssistButton
// @version      3.3.0
// @description  Slim Assist bar under Torn's news ticker. Opens faction chat, fills the fight link, and tries to send. Auto-updates from GitHub.
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

  const VERSION = '3.3.0';
  const BAR_ID = 'fries91-assist-news-bar';
  const TOAST_ID = 'fries91-assist-toast';
  const ASSIST_COMMAND = '/assist';
  let assistSendLocked = false;
  let lastAssistTapAt = 0;
  const GLOBAL_LOCK_KEY = 'fries91_assist_global_send_lock_v33';

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
    return r.width > 6 && r.height > 6 && s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      rect: r
    };
  }

  function trustedClickish(el) {
    if (!el) return false;

    const { x, y } = centerOf(el);
    const base = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x,
      screenY: y
    };

    try { el.dispatchEvent(new PointerEvent('pointerover', base)); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mouseover', base)); } catch (_) {}
    try { el.dispatchEvent(new PointerEvent('pointerdown', base)); } catch (_) {}
    try { el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true })); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mousedown', base)); } catch (_) {}
    try { el.focus?.(); } catch (_) {}
    try { el.dispatchEvent(new PointerEvent('pointerup', base)); } catch (_) {}
    try { el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true })); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('mouseup', base)); } catch (_) {}
    try { el.click?.(); } catch (_) {}
    try { el.dispatchEvent(new MouseEvent('click', base)); } catch (_) {}

    return true;
  }

  function clickAt(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    trustedClickish(el);
    return true;
  }

  function getAttackTargetId() {
    const url = new URL(location.href);
    const keys = ['user2ID', 'userID', 'targetID', 'target_id', 'playerID', 'XID'];

    for (const key of keys) {
      const val = url.searchParams.get(key);
      if (val && /^\d+$/.test(val)) return val;
    }

    const links = Array.from(document.querySelectorAll('a[href*="sid=attack"], a[href*="user2ID="]'));
    for (const a of links) {
      try {
        const u = new URL(a.href, location.origin);
        const val =
          u.searchParams.get('user2ID') ||
          u.searchParams.get('userID') ||
          u.searchParams.get('targetID') ||
          u.searchParams.get('XID');

        if (val && /^\d+$/.test(val)) return val;
      } catch (_) {}
    }

    return '';
  }

  function isAttackPage() {
    const url = new URL(location.href);
    const href = location.href.toLowerCase();
    const text = (document.body?.innerText || '').slice(0, 14000).toLowerCase();

    return (
      url.searchParams.get('sid') === 'attack' ||
      href.includes('sid=attack') ||
      (
        text.includes('attacking') &&
        (
          text.includes('you do not have enough energy') ||
          text.includes('attack again') ||
          text.includes('start fight') ||
          text.includes('leave fight') ||
          text.includes('hospitalize') ||
          text.includes('mug') ||
          text.includes('run away') ||
          text.includes('fairfight') ||
          text.includes('est. stats')
        )
      )
    );
  }

  function randomAssistText() {
    const messages = [
      '⚔️ Tactical mistake detected. Backup required!',
      '🚨 I have made a poor life choice. Send help!',
      '🫡 This was absolutely part of the plan. Assist please!',
      '🥴 I poked the wrong bear. Faction, assemble!',
      '📉 My confidence has left the chat. Backup needed!',
      '🧯 The plan is on fire. Please bring people.',
      '🐢 Tactical bravery has expired. Assist!',
      '⚰️ If I die, delete my browser history. Assist!',
      '🥊 I started it. They are finishing it. Help!',
      '🆘 Emergency tactical friendship request!',
      '🏃 This fight went from “easy” to “oh no” real fast.',
      '🔔 Ding ding! I found a problem with fists. Assist!',
      '🤡 Clown move detected. Backup appreciated.',
      '🪦 Please prevent my name from becoming a cautionary tale.',
      '🚑 My face is filing a complaint. Send backup!',
      '📣 Backup required and maybe a motivational speech.',
      '🫠 Confidence is not a defensive stat. Help!',
      '🍿 Come watch me make questionable choices in real time.',
      '🚩 I ignored the red flags. Now I am the red flag. Assist!',
      '🧠 My strategy has been reviewed and rejected. Backup!',
      '🦆 Wrong pond. Wrong duck. Send help.',
      '🪓 I chose violence and violence chose me back.',
      '💀 This was supposed to be a quick hit. It is not.',
      '🛟 Throw me a faction-shaped life raft.',
      '🥲 I am not losing. I am providing content. Assist!',
      '📦 Special delivery: one bad decision. Backup requested!',
      '🧃 My courage ran out of juice. Assist needed!',
      '🚕 I would like to leave this fight now. Backup!',
      '🎯 Target acquired. Regret also acquired.',
      '🧍 I am once again asking for violent friendship.',
      '🔧 Minor issue: enemy still has hands. Help!',
      '📞 Hello faction support? I broke myself.',
      '🧱 I found a wall and punched it. The wall is winning.',
      '🎪 Welcome to my circus. Please bring damage.',
      '🥷 I attempted stealth. They noticed my face.',
      '🧨 This escalated from fight to group project.',
      '💌 Sending a formal invitation to save me.',
      '🪤 I have activated the enemy. This is unfortunate.',
      '🥔 My battle plan has the structural integrity of a potato.',
      '🧻 I am getting folded. Send reinforcements.',
      '🛎️ Room service? One order of backup, please.',
      '🪦 Please stop my funeral playlist from starting.',
      '🧯 Situation status: spicy. Assistance required.',
      '🎲 Rolled the dice. Dice said “lol no.” Assist!',
      '🫥 I am rapidly becoming a cautionary example.',
      '🧙 I cast “Help Me” at maximum volume.',
      '🐌 Backup requested before I become floor decoration.',
      '🚧 Fight confidence under construction. Send help.',
      '🪖 Operation Save My Face is now active.',
      '🦺 Safety inspector says I need backup immediately.',
      '💣 Tiny tactical oopsie. Big backup needed.',
      '🫡 Tell my faction I bravely pressed the wrong button.',
      '🧀 I have entered the danger cheese. Assist!',
      '📉 My health bar is investing in failure.',
      '🏳️ I am not surrendering. I am requesting teamwork.',
      '🧃 Juice box empty. Enemy still full. Help!',
      '🧍‍♂️ Standing here like a free respect donation. Assist!',
      '🛠️ Fight is broken. Please send mechanics with weapons.',
      '🧲 Somehow I attracted problems. Backup needed.',
      '🧊 Cool plan. Terrible execution. Assist!',
      '📦 I ordered backup with express shipping.',
      '🪙 Heads I win, tails I need assist. It was tails.',
      '🦖 I have discovered a dinosaur with fists. Help!',
      '🧯 Fire extinguisher not enough. Send faction.'
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  function buildAssistMessage() {
    const targetId = getAttackTargetId();
    const intro = randomAssistText();

    if (targetId) {
      return `${intro} Join/help fight here: https://www.torn.com/loader.php?sid=attack&user2ID=${targetId}`;
    }

    return `${intro} Join/help fight here: ${location.href}`;
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
    }, 3000);
  }

  function isChatEditable(el) {
    if (!el) return false;

    const tag = (el.tagName || '').toLowerCase();
    const role = (el.getAttribute('role') || '').toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const cls = (el.className || '').toString().toLowerCase();

    if (el.isContentEditable) return true;
    if (tag === 'textarea') return true;
    if (tag === 'input' && ['text', 'search', ''].includes((el.type || '').toLowerCase())) return true;

    return (
      role === 'textbox' ||
      aria.includes('chat') ||
      placeholder.includes('chat') ||
      placeholder.includes('message') ||
      cls.includes('chat') ||
      cls.includes('message')
    );
  }

  function getEditableText(el) {
    if (!el) return '';
    if ('value' in el) return String(el.value || '');
    return String(el.textContent || '');
  }

  function setEditableText(el, text) {
    if (!el) return false;

    trustedClickish(el);
    try { el.focus?.(); } catch (_) {}

    if ('value' in el) {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc?.set) desc.set.call(el, text);
      else el.value = text;

      el.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: text
      }));

      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: text
      }));

      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // contenteditable
    try {
      el.textContent = '';
      document.execCommand?.('insertText', false, text);
    } catch (_) {}

    if ((el.textContent || '').trim() !== text.trim()) {
      el.textContent = text;
    }

    el.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    }));

    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text
    }));

    return true;
  }

  function pressEnter(el) {
    const opts = {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13
    };

    el.dispatchEvent(new KeyboardEvent('keydown', opts));
    el.dispatchEvent(new KeyboardEvent('keypress', opts));
    el.dispatchEvent(new KeyboardEvent('keyup', opts));
  }

  function findVisibleChatInputs() {
    const selectors = [
      'textarea',
      'input[type="text"]',
      'input:not([type])',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[class*="chat"] textarea',
      '[class*="chat"] input',
      '[class*="chat"] [contenteditable="true"]',
      '[class*="Chat"] textarea',
      '[class*="Chat"] input',
      '[class*="Chat"] [contenteditable="true"]',
      '[class*="message"] textarea',
      '[class*="message"] input',
      '[class*="message"] [contenteditable="true"]'
    ];

    return [...new Set(Array.from(document.querySelectorAll(selectors.join(',')))
      .filter(isChatEditable)
      .filter(visible))];
  }

  function findVisibleFactionPanel() {
    const panels = Array.from(document.querySelectorAll('div, section, aside, [role="dialog"], [class*="chat"], [class*="Chat"]'))
      .filter(visible)
      .map(el => {
        const r = el.getBoundingClientRect();
        const txt = (el.textContent || '').toLowerCase();
        const cls = (el.className || '').toString().toLowerCase();

        let score = 0;
        if (txt.includes('faction')) score += 120;
        if (cls.includes('chat')) score += 80;
        if (cls.includes('message')) score += 40;
        if (r.left > window.innerWidth * 0.25 && r.top > window.innerHeight * 0.2) score += 40;
        if (r.width > window.innerWidth * 0.4 && r.height > window.innerHeight * 0.25) score += 45;

        return { el, score };
      })
      .filter(x => x.score > 120)
      .sort((a, b) => b.score - a.score);

    return panels[0]?.el || null;
  }

  function findFactionChatInput() {
    const panel = findVisibleFactionPanel();
    const inputs = findVisibleChatInputs();

    if (!inputs.length) return null;

    if (panel) {
      const panelInput = inputs
        .filter(el => panel.contains(el))
        .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];

      if (panelInput) return panelInput;
    }

    // Fallback: lowest visible textbox.
    return inputs.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top)[0];
  }

  function findChatOpenButton() {
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], div, span, svg'))
      .filter(visible)
      .map(el => {
        const txt = (el.textContent || '').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();
        const cls = (el.className || '').toString().toLowerCase();
        const r = el.getBoundingClientRect();

        let score = 0;
        if (txt.includes('chat')) score += 30;
        if (aria.includes('chat')) score += 70;
        if (title.includes('chat')) score += 70;
        if (cls.includes('chat')) score += 60;
        if (cls.includes('message')) score += 35;
        if (cls.includes('bubble')) score += 20;

        // The TornPDA chat icon is top-right around the speech bubble.
        if (r.top < 180 && r.left > window.innerWidth * 0.68) score += 80;

        if (el.closest(`#${BAR_ID}`)) score -= 500;

        return { el, score };
      })
      .filter(x => x.score > 60)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.el || null;
  }

  async function openFactionChat() {
    if (findFactionChatInput()) return true;

    const btn = findChatOpenButton();
    if (btn) {
      trustedClickish(btn);
      await sleep(900);
    }

    if (!findFactionChatInput()) {
      // Direct TornPDA top-right chat bubble tap based on the screenshot.
      clickAt(Math.round(window.innerWidth * 0.835), 122);
      await sleep(900);
    }

    // If a channel selector exists, tap Faction.
    const factionTab = Array.from(document.querySelectorAll('button, a, [role="button"], div, span'))
      .filter(visible)
      .find(el => {
        if (el.closest(`#${BAR_ID}`)) return false;
        const txt = (el.textContent || '').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();
        return txt === 'faction' || aria === 'faction' || title === 'faction';
      });

    if (factionTab) {
      trustedClickish(factionTab);
      await sleep(450);
    }

    return !!findFactionChatInput();
  }

  function findSendButton() {
    const panel = findVisibleFactionPanel();
    const root = panel || document;

    const input = findFactionChatInput();
    const inputRect = input?.getBoundingClientRect();

    const candidates = Array.from(root.querySelectorAll('button, [role="button"], input[type="submit"], div, span, svg, path'))
      .filter(visible)
      .filter(el => !el.closest(`#${BAR_ID}`))
      .map(el => {
        const txt = (el.textContent || el.value || '').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();
        const cls = (el.className || '').toString().toLowerCase();
        const r = el.getBoundingClientRect();

        let score = 0;

        if (txt === 'send' || txt.includes('send')) score += 110;
        if (aria.includes('send')) score += 110;
        if (title.includes('send')) score += 110;
        if (cls.includes('send')) score += 90;
        if (cls.includes('submit')) score += 50;

        // Paper-plane button in TornPDA is to the right of the input.
        if (inputRect) {
          const inputMid = inputRect.top + inputRect.height / 2;
          if (r.left > inputRect.right - 10 && Math.abs((r.top + r.height / 2) - inputMid) < 80) score += 100;
          if (r.left > inputRect.left && r.top > inputRect.top - 40 && r.top < inputRect.bottom + 40) score += 30;
        }

        if (r.left > window.innerWidth * 0.82 && r.top > window.innerHeight * 0.35) score += 50;

        // Avoid big containers.
        if (r.width > 150 || r.height > 120) score -= 60;

        return { el, score };
      })
      .filter(x => x.score > 60)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.el || null;
  }

  async function sendMessageThroughChat(message) {
    const opened = await openFactionChat();

    if (!opened) {
      navigator.clipboard?.writeText(message).catch(() => {});
      toast('Could not open faction chat. Link copied instead.', false);
      return false;
    }

    let input = findFactionChatInput();

    if (!input) {
      navigator.clipboard?.writeText(message).catch(() => {});
      toast('Could not find faction chat box. Link copied instead.', false);
      return false;
    }

    // Tap input box first. This is important in TornPDA.
    trustedClickish(input);
    await sleep(150);

    input = findFactionChatInput() || input;

    setEditableText(input, message);
    await sleep(250);

    if (!getEditableText(input).trim()) {
      setEditableText(input, message);
      await sleep(200);
    }

    const sendBtn = findSendButton();

    if (!sendBtn) {
      navigator.clipboard?.writeText(message).catch(() => {});
      toast('Chat is open and link is ready. Tap send.', false);
      return false;
    }

    // One send action only. No Enter fallback. No coordinate fallback.
    trustedClickish(sendBtn);
    await sleep(700);

    toast('Assist link sent to faction chat.');
    return true;
  }

  async function sendAssist() {
    const now = Date.now();
    const lastGlobal = Number(localStorage.getItem(GLOBAL_LOCK_KEY) || '0');

    // Global lock prevents duplicate sends from double-clicks or duplicate handlers.
    if (assistSendLocked || now - lastAssistTapAt < 5000 || now - lastGlobal < 5000) {
      console.log('[Fries91 Assist] Ignored duplicate tap/send.');
      return;
    }

    assistSendLocked = true;
    lastAssistTapAt = now;
    localStorage.setItem(GLOBAL_LOCK_KEY, String(now));

    try {
      const msg = buildAssistMessage();
      const ok = await sendMessageThroughChat(msg);
      console.log('[Fries91 Assist]', ok ? 'Sent assist:' : 'Assist fallback/manual send:', msg);
    } finally {
      setTimeout(() => {
        assistSendLocked = false;
      }, 5000);
    }
  }

  function makeBar() {
    let bar = document.getElementById(BAR_ID);

    // Rebuild the bar every time if it came from an older version.
    // This removes old touchend/click handlers that can cause duplicate posts.
    if (bar && bar.dataset.assistVersion !== VERSION) {
      bar.remove();
      bar = null;
    }

    if (!bar) {
      bar = document.createElement('div');
      bar.id = BAR_ID;
      bar.dataset.assistVersion = VERSION;
      document.body.appendChild(bar);
    }

    // Rebuild children using onclick only. No touchend listener.
    bar.replaceChildren();

    const text = document.createElement('div');
    text.className = 'fries-assist-text';
    text.textContent = 'Tactical mistake detected.';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fries-assist-btn';
    btn.textContent = '⚔️ ASSIST';
    btn.title = 'Send fight assist link to open faction chat';

    btn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      sendAssist();
    };

    bar.appendChild(text);
    bar.appendChild(btn);

    css(bar, 'display', 'flex');
    css(bar, 'align-items', 'center');
    css(bar, 'justify-content', 'space-between');
    css(bar, 'gap', '8px');
    css(bar, 'box-sizing', 'border-box');
    css(bar, 'width', 'calc(100% - 12px)');
    css(bar, 'max-width', '680px');
    css(bar, 'margin', '2px auto 4px auto');
    css(bar, 'padding', '4px 8px');
    css(bar, 'border', '1px solid #b78326');
    css(bar, 'border-radius', '8px');
    css(bar, 'background', 'linear-gradient(180deg, rgba(43,9,9,.96), rgba(11,5,5,.96))');
    css(bar, 'box-shadow', '0 1px 6px rgba(0,0,0,.45)');
    css(bar, 'color', '#ffe6a3');
    css(bar, 'font', '800 12px Arial,sans-serif');
    css(bar, 'line-height', '1.1');
    css(bar, 'position', 'relative');
    css(bar, 'z-index', '20');

    css(text, 'color', '#ffd36a');
    css(text, 'font', '900 12px Arial,sans-serif');
    css(text, 'white-space', 'nowrap');
    css(text, 'overflow', 'hidden');
    css(text, 'text-overflow', 'ellipsis');

    css(btn, 'padding', '4px 10px');
    css(btn, 'min-height', '24px');
    css(btn, 'border', '1px solid #ffcc55');
    css(btn, 'border-radius', '7px');
    css(btn, 'background', 'linear-gradient(180deg,#5a1414,#180606)');
    css(btn, 'color', '#fff0b0');
    css(btn, 'font', '900 11px Arial,sans-serif');
    css(btn, 'letter-spacing', '.25px');
    css(btn, 'box-shadow', '0 1px 5px rgba(0,0,0,.55)');
    css(btn, 'touch-action', 'manipulation');
    css(btn, 'cursor', 'pointer');
    css(btn, 'white-space', 'nowrap');
    css(btn, 'flex', '0 0 auto');

    return bar;
  }

  function scoreNewsCandidate(el) {
    const r = el.getBoundingClientRect();
    const txt = (el.textContent || '').trim().toLowerCase();
    const cls = (el.className || '').toString().toLowerCase();

    if (r.width < 220 || r.height < 14 || r.height > 80) return -999;
    if (r.top < 110 || r.top > 420) return -999;

    let score = 0;

    if (txt.includes('share price')) score += 150;
    if (txt.includes('has increased')) score += 80;
    if (txt.includes('has decreased')) score += 80;
    if (txt.includes('news')) score += 50;
    if (txt.includes('completed a chain')) score += 40;

    if (cls.includes('news')) score += 80;
    if (cls.includes('ticker')) score += 100;
    if (cls.includes('marquee')) score += 70;
    if (cls.includes('announcement')) score += 40;
    if (cls.includes('msg')) score += 20;

    return score;
  }

  function findNewsTickerAnchor() {
    const all = Array.from(document.querySelectorAll('div, li, ul, section, article, [class]'));
    const candidates = all
      .map(el => ({ el, score: scoreNewsCandidate(el) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.el || null;
  }

  function injectBarUnderNewsTicker() {
    const existing = document.getElementById(BAR_ID);

    if (!isAttackPage()) {
      if (existing) existing.remove();
      return;
    }

    const bar = makeBar();
    const anchor = findNewsTickerAnchor();

    if (!anchor || !anchor.parentElement) {
      if (!bar.parentElement) document.body.prepend(bar);
      return;
    }

    if (bar.parentElement !== anchor.parentElement || bar.previousElementSibling !== anchor) {
      anchor.parentElement.insertBefore(bar, anchor.nextSibling);
      console.log('[Fries91 Assist] Injected under news ticker v' + VERSION);
    }
  }

  function handleAssistCommand(e) {
    const el = e.target;
    if (!isChatEditable(el)) return;

    if (getEditableText(el).trim().toLowerCase() !== ASSIST_COMMAND) return;
    if (e.key !== 'Enter') return;
    if (e.repeat) return;

    e.preventDefault();
    e.stopPropagation();

    sendAssist();
  }

  function boot() {
    document.addEventListener('keydown', handleAssistCommand, true);

    setInterval(injectBarUnderNewsTicker, 900);
    window.addEventListener('resize', injectBarUnderNewsTicker, true);
    window.addEventListener('orientationchange', injectBarUnderNewsTicker, true);

    const obs = new MutationObserver(() => injectBarUnderNewsTicker());
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    injectBarUnderNewsTicker();
    console.log('[Fries91 Assist] Loaded v' + VERSION);
  }

  boot();
})();
