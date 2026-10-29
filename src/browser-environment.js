export function getMessagingApp(userAgent = globalThis.navigator?.userAgent ?? '') {
  if (/MicroMessenger/i.test(userAgent)) return 'wechat';
  // MQQBrowser also occurs in standalone QQ Browser and WeChat; it is not
  // enough to identify the QQ messaging app's in-app browser.
  if (/(?:^|[\s;(])(?:QQ\/\d|V1_AND_SQ_)/i.test(userAgent)) return 'qq';
  return null;
}

export function isAndroidQQ(userAgent = globalThis.navigator?.userAgent ?? '') {
  return /Android/i.test(userAgent) && getMessagingApp(userAgent) === 'qq';
}
