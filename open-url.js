/**
 * open-url.js
 * AGNT tool — opens the ICE Crawler dashboard in the external browser.
 * Uses child_process to call `open` (macOS), `start` (Windows), or `xdg-open` (Linux).
 */

import { spawn } from 'child_process';

function openBrowser(url) {
  const platform = process.platform;
  let cmd, args;

  if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '""', url];
  } else if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }

  const child = spawn(cmd, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();

  return { cmd, args, pid: child.pid };
}

class IceCrawlerOpenUrl {
  constructor() {
    this.name = 'ice-crawler-open-url';
  }

  async execute(params) {
    try {
      const url = params?.url;
      if (!url) {
        return { success: false, error: 'url is required' };
      }

      const result = openBrowser(url);
      return {
        success: true,
        url,
        platform: process.platform,
        command: result.cmd,
        args: result.args,
        pid: result.pid || null,
        message: `Opened ${url} in external browser`,
      };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  }
}

export default new IceCrawlerOpenUrl();
