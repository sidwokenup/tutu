(function () {
    'use strict';

    var AUDIO_ID = 'alertAudio';
    var AUDIO_SRC = 'ialert.mp3';

    var audioElement = null;
    var audioUnlocked = false;
    var firstGestureConsumed = false;
    var gestureInProgress = false;
    var notificationsScheduled = false;
    var teardownDone = false;

    function findOrCreateAudio() {
        if (audioElement) {
            if (!document.body.contains(audioElement)) {
                audioElement = null;
            }
        }
        if (!audioElement) {
            audioElement = document.getElementById(AUDIO_ID);
        }
        if (!audioElement) {
            var el = document.createElement('audio');
            el.id = AUDIO_ID;
            el.src = AUDIO_SRC;
            el.preload = 'auto';
            el.setAttribute('playsinline', '');
            el.setAttribute('webkit-playsinline', '');
            el.setAttribute('muted', 'false');
            el.muted = false;
            try { el.volume = 1; } catch (e) {}
            try { el.setAttribute('x-webkit-airplay', 'allow'); } catch (e) {}
            if (document.body) {
                document.body.appendChild(el);
            } else {
                document.addEventListener('DOMContentLoaded', function once() {
                    document.removeEventListener('DOMContentLoaded', once, false);
                    if (el && !document.body.contains(el)) {
                        document.body.appendChild(el);
                    }
                }, false);
            }
            audioElement = el;
        } else {
            if (!audioElement.hasAttribute('playsinline')) {
                audioElement.setAttribute('playsinline', '');
            }
            if (!audioElement.hasAttribute('webkit-playsinline')) {
                audioElement.setAttribute('webkit-playsinline', '');
            }
            if (audioElement.preload !== 'auto') {
                try { audioElement.preload = 'auto'; } catch (e) {}
            }
            if (!audioElement.src || audioElement.src.indexOf(AUDIO_SRC) === -1) {
                audioElement.src = AUDIO_SRC;
            }
            try { audioElement.muted = false; } catch (e) {}
            try { audioElement.volume = 1; } catch (e) {}
        }
        return audioElement;
    }

    function warmAudioDecoder(el) {
        if (!el) return;
        try {
            try { el.pause(); } catch (e) {}
            try { el.currentTime = 0; } catch (e) {}
            try { el.load(); } catch (e) {}
        } catch (e) {}
    }

    function destroyContaminatedAudio() {
        var el = audioElement;
        if (!el) return;
        try { el.pause(); } catch (e) {}
        try { el.removeAttribute('src'); } catch (e) {}
        try {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        } catch (e) {}
        audioElement = null;
    }

    function sameElementRetryPlay(el, onSuccess, onFail) {
        if (!el) { onFail(); return; }
        try {
            try { el.currentTime = 0; } catch (e) {}
            el.muted = false;
            try { el.volume = 1; } catch (e) {}
            var p = el.play();
            if (p === undefined) { onSuccess(); return; }
            p.then(onSuccess).catch(function () {
                try {
                    warmAudioDecoder(el);
                    var p2 = el.play();
                    if (p2 === undefined) { onSuccess(); return; }
                    p2.then(onSuccess).catch(function () {
                        try {
                            warmAudioDecoder(el);
                            var p3 = el.play();
                            if (p3 === undefined) { onSuccess(); return; }
                            p3.then(onSuccess).catch(onFail);
                        } catch (e) { onFail(); }
                    });
                } catch (e) { onFail(); }
            });
        } catch (e) {
            onFail();
        }
    }

    function markSucceeded() {
        audioUnlocked = true;
        firstGestureConsumed = true;
        if (!notificationsScheduled) {
            notificationsScheduled = true;
            if (typeof window.startNotifications === 'function') {
                window.startNotifications();
            }
        }
    }

    function markFailed() {
        firstGestureConsumed = true;
        audioUnlocked = false;
    }

    function playNotificationAudio() {
        var el = findOrCreateAudio();
        if (!el) return;
        if (!audioUnlocked) return;
        sameElementRetryPlay(el, function () { audioUnlocked = true; }, function () {
            try {
                destroyContaminatedAudio();
                var el2 = findOrCreateAudio();
                if (!el2) return;
                warmAudioDecoder(el2);
                sameElementRetryPlay(el2, function () { audioUnlocked = true; }, function () { audioUnlocked = false; });
            } catch (e) { audioUnlocked = false; }
        });
    }

    function startAudioLoop() {
        if (gestureInProgress) return;
        gestureInProgress = true;
        try {
            var el = findOrCreateAudio();
            if (!firstGestureConsumed) {
                if (el) warmAudioDecoder(el);
                sameElementRetryPlay(el, markSucceeded, function () {
                    try {
                        destroyContaminatedAudio();
                        var el2 = findOrCreateAudio();
                        if (!el2) { markFailed(); return; }
                        warmAudioDecoder(el2);
                        sameElementRetryPlay(el2, markSucceeded, markFailed);
                    } catch (e) { markFailed(); }
                });
            } else {
                if (audioUnlocked) {
                    sameElementRetryPlay(el, function () { audioUnlocked = true; }, function () { audioUnlocked = false; });
                } else {
                    if (el) warmAudioDecoder(el);
                    sameElementRetryPlay(el, markSucceeded, function () {
                        try {
                            destroyContaminatedAudio();
                            var el2 = findOrCreateAudio();
                            if (!el2) { markFailed(); return; }
                            warmAudioDecoder(el2);
                            sameElementRetryPlay(el2, markSucceeded, markFailed);
                        } catch (e) { markFailed(); }
                    });
                }
            }
        } finally {
            setTimeout(function () { gestureInProgress = false; }, 0);
        }
    }

    var userEvents = ['touchstart', 'click', 'pointerdown', 'mousedown', 'keydown'];
    userEvents.forEach(function (evt) {
        var opts = (evt === 'touchstart') ? true : { passive: false, capture: false };
        document.addEventListener(evt, startAudioLoop, opts);
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) return;
        if (!audioUnlocked) return;
        playNotificationAudio();
    }, false);

    window.addEventListener('focus', function () {
        if (!audioUnlocked) return;
        playNotificationAudio();
    }, false);

    function teardown() {
        if (teardownDone) return;
        teardownDone = true;
        destroyContaminatedAudio();
    }
    window.addEventListener('beforeunload', teardown, false);
    window.addEventListener('pagehide', teardown, false);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', findOrCreateAudio, { once: true, passive: true });
    } else {
        findOrCreateAudio();
    }

    window.playNotificationAudio = playNotificationAudio;
    window.findOrCreateAudio = findOrCreateAudio;
    Object.defineProperty(window, 'audioUnlocked', {
        get: function () { return audioUnlocked; },
        configurable: true
    });
    Object.defineProperty(window, 'alertAudio', {
        get: function () { return findOrCreateAudio(); },
        configurable: true
    });
})();
