// ==UserScript==
// @name         Bilibili-B站视频URL清理
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  清除B站视频、番剧、动态、直播链接不必要的参数
// @author       LongSir
// @license      MIT
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/bangumi/*
// @match        https://www.bilibili.com/opus/*
// @match        https://live.bilibili.com/*
// @match        https://space.bilibili.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // 需要保留的参数白名单
    const KEEP_PARAMS = new Set(['p', 't']);

    // 核心清理函数
    const cleanUrl = (url) => {
        if (!url) return url;
        try {
            const urlObj = new URL(url);

            // 提取需要保留的参数
            const params = new URLSearchParams(urlObj.search);
            const kept = new URLSearchParams();
            for (const key of KEEP_PARAMS) {
                if (params.has(key)) {
                    kept.set(key, params.get(key));
                }
            }

            // 重建纯净URL
            const cleanPath = urlObj.pathname.replace(/\/+$/, '');
            const search = kept.toString();
            let cleanHref = `${urlObj.origin}${cleanPath}`;
            if (search) {
                cleanHref += `?${search}`;
            }
            if (urlObj.hash) {
                cleanHref += urlObj.hash;
            }
            return cleanHref;
        } catch {
            // 降级处理：手动提取参数
            const [base, query] = url.split('?');
            const cleanBase = base.replace(/\/+$/, '');
            if (!query) return cleanBase;

            const kept = [];
            for (const key of KEEP_PARAMS) {
                const match = query.match(new RegExp(`(?:^|&)${key}=([^&]*)`));
                if (match) {
                    kept.push(`${key}=${encodeURIComponent(match[1])}`);
                }
            }
            return kept.length > 0
                ? `${cleanBase}?${kept.join('&')}`
                : cleanBase;
        }
    };

    // 保存原始 history 方法引用
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    // 代理 history 方法
    history.pushState = function (state, title, url) {
        return origPush(state, title, cleanUrl(url));
    };

    history.replaceState = function (state, title, url) {
        return origReplace(state, title, cleanUrl(url));
    };

    // 初始化：使用原始方法避免双重清理
    const initialClean = cleanUrl(location.href);
    if (initialClean !== location.href) {
        origReplace(null, '', initialClean);
    }

    // 动态URL监控（防抖）
    let lastHref = location.href;
    let debounceTimer = null;

    const checkAndClean = () => {
        if (debounceTimer) return;
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            if (location.href === lastHref) return;
            const cleaned = cleanUrl(location.href);
            if (cleaned !== location.href) {
                origReplace(null, '', cleaned);
            }
            lastHref = location.href; // replaceState 后再同步
        }, 50);
    };

    // 事件监听（无需 MutationObserver）
    window.addEventListener('popstate', checkAndClean);
    window.addEventListener('hashchange', checkAndClean);

    // 兜底定时器：捕获极少数未被代理拦截的 URL 变化
    setInterval(checkAndClean, 2000);

    console.log('%c BiliURLc %c Author/作者:LongSir', 'background: linear-gradient(120deg, #8183ff, #58b3f5);color:#fff;border-radius:2px;', '');
})();
