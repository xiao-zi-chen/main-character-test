import test from 'node:test';
import assert from 'node:assert/strict';
import { getMessagingApp, isAndroidQQ } from '../src/browser-environment.js';

test('recognizes Android and iOS QQ without treating QQ Browser as the messaging app', () => {
  const cases = [
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 MQQBrowser/6.2 TBS/046716 QQ/9.1.50.18890 Mobile', 'qq'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 QQ/9.1.50.638 V1_IPH_SQ_9.1.50_1_APP_A', 'qq'],
    ['Mozilla/5.0 (Linux; Android 9) MQQBrowser/6.2 V1_AND_SQ_8.0.0_1000_YYB_D', 'qq'],
    ['Mozilla/5.0 (Linux; Android 14) MQQBrowser/15.5 Mobile Safari/537.36', null],
    ['Mozilla/5.0 (Linux; Android 14) MQQBrowser/6.2 QQ/9.1.50 MicroMessenger/8.0.57', 'wechat'],
    ['Mozilla/5.0 (iPhone) MicroMessenger/8.0.57', 'wechat'],
    ['Mozilla/5.0 Chrome/132.0.0.0 Safari/537.36', null],
    ['', null],
  ];
  for (const [userAgent, expected] of cases) assert.equal(getMessagingApp(userAgent), expected, userAgent);
});

test('native video compatibility is limited to Android QQ', () => {
  assert.equal(isAndroidQQ('Android 14 MQQBrowser/6.2 QQ/9.1.50'), true);
  assert.equal(isAndroidQQ('Android 9 V1_AND_SQ_8.0.0_1000'), true);
  for (const ua of ['iPhone QQ/9.1.50', 'Android MQQBrowser/15.5', 'Android QQ/9.1.50 MicroMessenger/8.0', 'Android Chrome/120', '']) {
    assert.equal(isAndroidQQ(ua), false, ua);
  }
});
