import {test} from 'node:test';
import assert from 'node:assert/strict';
import {itemTooltipDetails} from './itemTooltip.js';

test('Korean catalog descriptions preserve all listed stats and separate passive effect paragraphs', () => {
  const item = {
    description: '<mainText><stats>공격력 <attention>36</attention><br>공격 속도 <attention>30%</attention><br>체력 <attention>333</attention><br>스킬 가속 <attention>15</attention></stats><br><br><passive>주문 검</passive><br>다음 기본 공격 시 <physicalDamage>추가 물리 피해</physicalDamage>를 입힙니다.<br> <br><passive>가속</passive><br>2초 동안 <speed>이동 속도가 20</speed> 상승합니다.</mainText>',
    stats: {FlatPhysicalDamageMod: 36},
  };
  assert.deepEqual(itemTooltipDetails(item), {
    stats: ['공격력 36', '공격 속도 30%', '체력 333', '스킬 가속 15'],
    effects: ['주문 검\n다음 기본 공격 시 추가 물리 피해를 입힙니다.', '가속\n2초 동안 이동 속도가 20 상승합니다.'],
  });
});

test('stat-only items do not mistake their short catalog summary for an extra effect', () => {
  assert.deepEqual(itemTooltipDetails({
    description: '<mainText><stats>이동 속도 <attention>25</attention></stats><br><br></mainText>',
    plaintext: '이동 속도가 약간 증가합니다.',
  }), {stats: ['이동 속도 25'], effects: []});
});

test('active effects and quest lists work without base stats', () => {
  assert.deepEqual(itemTooltipDetails({
    description: "<mainText><stats></stats><br><br><active>사용 시</active> (<scaleLevel>198~99</scaleLevel>초)<br>영역을 드러냅니다.<br><br><font color='#00FF00'>보상</font><li>경험치 증가</li><li>추가 이동 속도</li></mainText>",
  }), {stats: [], effects: ['사용 시 (198~99초)\n영역을 드러냅니다.', '보상\n• 경험치 증가\n• 추가 이동 속도']});
});

test('markup becomes inert text, decoding entities without throwing on invalid code points', () => {
  assert.deepEqual(itemTooltipDetails({
    description: '<!-- hidden --><script>alert(1)</script><style>.secret{}</style><mainText><unknown onclick="bad()">효과</unknown><br/>A &amp; B &lt; 50 &quot;골드&quot; &#39;구매&#39;&nbsp;&#x1F4B0;<br>&#0; &#x110000; &#xD800;</mainText>',
  }), {stats: [], effects: ['효과\nA & B < 50 "골드" \'구매\' 💰\n� � �']});
});

test('missing or empty descriptions safely use plain text when available', () => {
  for (const item of [undefined, null, {}, {description: 123, plaintext: false}]) {
    assert.deepEqual(itemTooltipDetails(item), {stats: [], effects: []});
  }
  assert.deepEqual(itemTooltipDetails({plaintext: '체력 &amp; 마나 회복'}), {stats: [], effects: ['체력 & 마나 회복']});
  assert.deepEqual(itemTooltipDetails({description: '<stats></stats><br>', plaintext: '보상 설명'}), {stats: [], effects: ['보상 설명']});
});
