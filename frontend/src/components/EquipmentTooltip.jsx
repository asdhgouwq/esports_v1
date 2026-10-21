import {useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {itemTooltipDetails} from '../lib/itemTooltip';
import {equipmentTooltipEntry} from '../lib/equipmentTooltip';
import '../styles/item-tooltip.css';

const price = value => Number.isFinite(value) ? value.toLocaleString('ko-KR') : '—';

export default function EquipmentTooltip({equipment, version, children}) {
  const [active, setActive] = useState(null);
  const [position, setPosition] = useState(null);
  const root = useRef(null), popup = useRef(null), pointerType = useRef(null);
  const id = useId();
  const item = useMemo(() => active && equipmentTooltipEntry(active.type, active.entryId, equipment), [active, equipment]);
  const details = useMemo(() => itemTooltipDetails(item), [item]);
  const isItem = active?.type === 'item';
  const close = () => setActive(null);
  const trigger = target => {
    const button = target.closest?.('button[data-tooltip-id]');
    return button && root.current?.contains(button) ? button : null;
  };
  const open = (anchor, mode) => {
    if (active?.anchor !== anchor || active?.mode !== mode) {
      setPosition(null);
      setActive({anchor, entryId: anchor.dataset.tooltipId, type: anchor.dataset.tooltipType, mode});
    }
  };

  useLayoutEffect(() => {
    if (!active || !item || !popup.current) return;
    const {anchor} = active;
    anchor.setAttribute('aria-describedby', id);
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const {width, height} = popup.current.getBoundingClientRect();
      const gap = 8, margin = 12;
      const left = Math.max(margin, Math.min(rect.x + rect.width / 2 - width / 2, window.innerWidth - width - margin));
      const top = rect.top >= height + gap + margin ? rect.top - height - gap : Math.max(margin, Math.min(rect.bottom + gap, window.innerHeight - height - margin));
      setPosition({left, top});
    };
    const scroll = event => {
      if (!popup.current?.contains(event.target)) close();
    };
    const dismiss = event => {
      if (event.key === 'Escape') close();
    };
    const outside = event => {
      if (!anchor.contains(event.target) && !popup.current?.contains(event.target)) close();
    };
    place();
    window.addEventListener('resize', place);
    document.addEventListener('scroll', scroll, true);
    document.addEventListener('keydown', dismiss);
    document.addEventListener('pointerdown', outside);
    return () => {
      anchor.removeAttribute('aria-describedby');
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', scroll, true);
      document.removeEventListener('keydown', dismiss);
      document.removeEventListener('pointerdown', outside);
    };
  }, [active, item, id]);

  return <div ref={root}
    onPointerOver={event => {
      const anchor = trigger(event.target);
      if (anchor && event.pointerType !== 'touch') open(anchor, 'hover');
    }}
    onPointerOut={event => {
      const anchor = trigger(event.target);
      if (anchor === active?.anchor && event.pointerType !== 'touch' && !anchor.contains(event.relatedTarget)) close();
    }}
    onPointerDown={event => {pointerType.current = event.pointerType;}}
    onFocus={event => {const anchor = trigger(event.target); if (anchor?.matches(':focus-visible')) open(anchor, 'focus');}}
    onBlur={event => {if (trigger(event.target) === active?.anchor && active?.mode !== 'touch') close();}}
    onKeyDown={() => {pointerType.current = null;}}
    onClick={event => {
      const anchor = trigger(event.target);
      if (!anchor) return;
      if (pointerType.current === 'touch') {
        if (active?.anchor === anchor) close();
        else open(anchor, 'touch');
      } else open(anchor, event.detail === 0 ? 'focus' : 'hover');
    }}>
    {children}
    {item && createPortal(
      <div ref={popup} id={id} role="tooltip" className={`item-tooltip${isItem ? ' item-tooltip-compact' : ''}${active.mode === 'touch' ? ' is-touch' : ''}`}
        style={position || {left: 0, top: 0, visibility: 'hidden'}}>
        <header className="item-tooltip-header">
          <strong>{item.name}</strong>
          {isItem && <small className="item-tooltip-version" aria-label={`아이템 정보 기준 패치 ${version}`}>{version}</small>}
        </header>
        {details.stats.length > 0 && <p className="item-tooltip-stats">{details.stats.join(' · ')}</p>}
        {details.effects.length > 0 && <section className="item-tooltip-effects">
          {details.effects.map((text, index) => <p key={index}>{text}</p>)}
        </section>}
        {isItem && <footer className="item-tooltip-price" aria-label={`구매 가격 ${price(item.gold?.total)} 골드, 되팔기 가격 ${price(item.gold?.sell)} 골드`}>
          가격 <b>{price(item.gold?.total)} ({price(item.gold?.sell)})</b> Gold
        </footer>}
      </div>, document.body)}
  </div>;
}
