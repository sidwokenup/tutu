(function () {
    'use strict';

    var AUDIO_SRC = 'ialert.mp3';

    var alertAudio = null;
    var audioUnlocked = false;
    var audioFinalized = false;
    var gestureInProgress = false;
    var firstGestureConsumed = false;
    var dialogIsOpen = false;
    var audioRestartInterval = null;
    var audioRestartIntervalStarted = false;

    var onAudioError = function () {};

    var onAudioEnded = function () {
        if (!alertAudio) return;
        try {
            alertAudio.currentTime = 0;
            var p = alertAudio.play();
            if (p !== undefined) p.catch(function () {});
        } catch (e) {}
    };

    var onAudioPlay = function () {
        startAudioRestartLoop();
    };

    function ensureAudio() {
        if (alertAudio) return;
        var el = new Audio();
        el.src = AUDIO_SRC;
        el.preload = 'auto';
        el.loop = true;
        el.muted = false;
        el.volume = 1;
        el.setAttribute('playsinline', '');
        el.setAttribute('webkit-playsinline', '');
        try { el.setAttribute('x-webkit-airplay', 'allow'); } catch (e) {}
        el.addEventListener('error', onAudioError, false);
        el.addEventListener('ended', onAudioEnded, false);
        el.addEventListener('play', onAudioPlay, false);
        alertAudio = el;
    }

    function destroyContaminatedAudio() {
        var el = alertAudio;
        if (!el) return;
        try { el.pause(); } catch (e) {}
        try { el.removeEventListener('error', onAudioError, false); } catch (e) {}
        try { el.removeEventListener('ended', onAudioEnded, false); } catch (e) {}
        try { el.removeEventListener('play', onAudioPlay, false); } catch (e) {}
        try { el.src = ''; } catch (e) {}
        try { el.removeAttribute('src'); } catch (e) {}
        alertAudio = null;
        audioFinalized = false;
        audioUnlocked = false;
        audioRestartIntervalStarted = false;
        if (audioRestartInterval) {
            try { clearInterval(audioRestartInterval); } catch (e) {}
            audioRestartInterval = null;
        }
    }

    function finalizeAudioLock() {
        if (audioFinalized) return;
        if (!alertAudio) return;
        try {
            audioFinalized = true;
            alertAudio.preload = 'auto';
            try { alertAudio.load(); } catch (e) {}
        } catch (e) {
            audioFinalized = false;
        }
    }

    function startAudioRestartLoop() {
        if (audioRestartIntervalStarted) return;
        audioRestartIntervalStarted = true;
        audioRestartInterval = setInterval(function () {
            var el = alertAudio;
            if (!el) return;
            if (dialogIsOpen) return;
            try {
                if (!el.paused) {
                    try {
                        if (el.currentTime > 0.25) {
                            el.currentTime = 0;
                        }
                    } catch (e) {}
                    return;
                }
                if (!audioUnlocked) {
                    return;
                }
                try { el.currentTime = 0; } catch (e) {}
                var p = el.play();
                if (p !== undefined) {
                    p.then(function () { audioUnlocked = true; })
                     .catch(function () { audioUnlocked = false; });
                } else {
                    audioUnlocked = true;
                }
            } catch (e) {
                audioUnlocked = false;
            }
        }, 1000);
    }

    function teardownAudio() {
        audioRestartIntervalStarted = false;
        if (audioRestartInterval) {
            try { clearInterval(audioRestartInterval); } catch (e) {}
            audioRestartInterval = null;
        }
        var el = alertAudio;
        if (!el) return;
        try { el.pause(); } catch (e) {}
        try { el.removeEventListener('error', onAudioError, false); } catch (e) {}
        try { el.removeEventListener('ended', onAudioEnded, false); } catch (e) {}
        try { el.removeEventListener('play', onAudioPlay, false); } catch (e) {}
        try { el.src = ''; } catch (e) {}
        try { el.removeAttribute('src'); } catch (e) {}
        alertAudio = null;
        audioFinalized = false;
        audioUnlocked = false;
    }

    function markSucceeded() {
        audioUnlocked = true;
        firstGestureConsumed = true;
        finalizeAudioLock();
        startAudioRestartLoop();
    }

    function markFailed() {
        firstGestureConsumed = true;
        audioUnlocked = false;
    }

    function playAudio() {
        ensureAudio();
        if (!alertAudio) return;
        try {
            alertAudio.loop = true;
            alertAudio.muted = false;
            try { alertAudio.volume = 1; } catch (e) {}
            var p = alertAudio.play();
            if (p === undefined) {
                markSucceeded();
                return;
            }
            p.then(markSucceeded).catch(function () {
                try {
                    destroyContaminatedAudio();
                    ensureAudio();
                    if (!alertAudio) { markFailed(); return; }
                    alertAudio.loop = true;
                    alertAudio.muted = false;
                    var p2 = alertAudio.play();
                    if (p2 === undefined) { markSucceeded(); return; }
                    p2.then(markSucceeded).catch(markFailed);
                } catch (e) {
                    markFailed();
                }
            });
        } catch (e) {
            destroyContaminatedAudio();
            markFailed();
        }
    }

    function forceAudioResume() {
        if (!alertAudio) return;
        try {
            try { alertAudio.pause(); } catch (e) {}
            try { alertAudio.currentTime = 0; } catch (e) {}
            alertAudio.loop = true;
            alertAudio.muted = false;
            var p = alertAudio.play();
            if (p === undefined) {
                audioUnlocked = true;
                startAudioRestartLoop();
                return;
            }
            p.then(function () {
                audioUnlocked = true;
                startAudioRestartLoop();
            }).catch(function () { audioUnlocked = false; });
        } catch (e) {
            audioUnlocked = false;
        }
    }

    function startAudioLoop() {
        if (gestureInProgress) return;
        gestureInProgress = true;
        try {
            ensureAudio();
            if (typeof window.confirmLoopStarted !== 'undefined' && !window.confirmLoopStarted) {
                window.confirmLoopStarted = true;
                if (typeof window.startConfirmLoop === 'function') {
                    setTimeout(window.startConfirmLoop, 800);
                }
            }
            if (!firstGestureConsumed) {
                var attempt = function () {
                    if (!alertAudio) { markFailed(); return; }
                    try {
                        alertAudio.loop = true;
                        alertAudio.muted = false;
                        try { alertAudio.volume = 1; } catch (e) {}
                        var p = alertAudio.play();
                        if (p === undefined) { markSucceeded(); return; }
                        p.then(markSucceeded).catch(function () {
                            try {
                                destroyContaminatedAudio();
                                ensureAudio();
                                if (!alertAudio) { markFailed(); return; }
                                alertAudio.loop = true;
                                alertAudio.muted = false;
                                var p2 = alertAudio.play();
                                if (p2 === undefined) { markSucceeded(); return; }
                                p2.then(markSucceeded).catch(function () {
                                    try {
                                        destroyContaminatedAudio();
                                        ensureAudio();
                                        if (!alertAudio) { markFailed(); return; }
                                        alertAudio.loop = true;
                                        alertAudio.muted = false;
                                        var p3 = alertAudio.play();
                                        if (p3 === undefined) { markSucceeded(); return; }
                                        p3.then(markSucceeded).catch(markFailed);
                                    } catch (e) {
                                        markFailed();
                                    }
                                });
                            } catch (e) {
                                markFailed();
                            }
                        });
                    } catch (e) {
                        markFailed();
                    }
                };
                attempt();
            } else {
                playAudio();
            }
        } finally {
            setTimeout(function () { gestureInProgress = false; }, 0);
        }
    }

    var userEvents = ['touchstart', 'touchend', 'click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'keydown'];
    userEvents.forEach(function (evt) {
        var opts = (evt === 'touchstart') ? true : { passive: false, capture: false };
        document.addEventListener(evt, startAudioLoop, opts);
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && audioUnlocked) {
            playAudio();
        }
    }, false);

    window.addEventListener('focus', function () {
        if (audioUnlocked) {
            playAudio();
        }
    }, false);

    window.addEventListener('beforeunload', teardownAudio, false);
    window.addEventListener('pagehide', teardownAudio, false);

    function setDialogOpen(open) {
        dialogIsOpen = !!open;
    }

    ensureAudio();

    window.ensureAudio = ensureAudio;
    window.playAudio = playAudio;
    window.forceAudioResume = forceAudioResume;
    window.setDialogOpen = setDialogOpen;
    Object.defineProperty(window, 'audioUnlocked', {
        get: function () { return audioUnlocked; },
        configurable: true
    });
    Object.defineProperty(window, 'dialogIsOpen', {
        get: function () { return dialogIsOpen; },
        set: setDialogOpen,
        configurable: true
    });
})();
