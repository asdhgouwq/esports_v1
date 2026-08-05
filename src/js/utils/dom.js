/**
 * RIFT.GG - DOM Utilities
 * DOM 조작 헬퍼 함수
 */

export function $(selector) {
  return document.querySelector(selector);
}

export function $$(selector) {
  return document.querySelectorAll(selector);
}

export function addClass(el, className) {
  if (!el) return;
  el.classList.add(className);
}

export function removeClass(el, className) {
  if (!el) return;
  el.classList.remove(className);
}

export function toggleClass(el, className) {
  if (!el) return;
  el.classList.toggle(className);
}

export function hasClass(el, className) {
  if (!el) return false;
  return el.classList.contains(className);
}

export function setAttr(el, attr, value) {
  if (!el) return;
  el.setAttribute(attr, value);
}

export function getAttr(el, attr) {
  if (!el) return null;
  return el.getAttribute(attr);
}

export function setHTML(el, html) {
  if (!el) return;
  el.innerHTML = html;
}

export function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

export function show(el) {
  if (!el) return;
  el.style.display = '';
}

export function hide(el) {
  if (!el) return;
  el.style.display = 'none';
}

export function remove(el) {
  if (!el || !el.parentNode) return;
  el.parentNode.removeChild(el);
}

export function on(el, event, handler) {
  if (!el) return;
  el.addEventListener(event, handler);
}

export function off(el, event, handler) {
  if (!el) return;
  el.removeEventListener(event, handler);
}

export function emit(el, eventName, detail) {
  if (!el) return;
  el.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
}
