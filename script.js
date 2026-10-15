(function () {
    "use strict";

    document.documentElement.classList.add("js");

    var $ = function (s, c) { return (c || document).querySelector(s); };
    var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

    /* ---------- Config ---------- */
    var SUPPORT_EMAIL = "Supportguardcontrol@gmail.com";
    // Static-site friendly form-to-email service (no backend of our own).
    // NOTE: the /ajax/ endpoint silently drops file attachments, so we post multipart to the regular endpoint.
    var FORM_ENDPOINT = "https://formsubmit.co/" + SUPPORT_EMAIL;
    var MAX_IMAGE_MB = 5;
    var ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

    /* ---------- Hero video: plays on loop; mobile uses the portrait film ---------- */
    var video = $("#heroVideo");
    if (video) {
        var mq = window.matchMedia("(max-width: 820px), (orientation: portrait)");
        var scrubMq = window.matchMedia("(max-width: 820px)");
        var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var current = "";

        // Some phones (e.g. iPhone in Low Power Mode, data saver) refuse to autoplay video.
        // Then we drop the video and tell the page: the story runs on still images (scroll-based) instead.
        var fallbackTimer = null;
        var useStill = function () {
            document.documentElement.classList.add("no-video");
            video.pause();
        };
        video.addEventListener("playing", function () {
            clearTimeout(fallbackTimer);
            document.documentElement.classList.remove("no-video");
        });
        if (reduceMotion) useStill();

        var loadHero = function () {
            var key = scrubMq.matches ? "scrub" : (mq.matches ? "mobile" : "desktop");
            if (key === current) return;
            current = key;
            var cap = key.charAt(0).toUpperCase() + key.slice(1);
            video.poster = video.dataset["poster" + cap];
            if (reduceMotion) return; // poster only
            video.loop = true;
            video.src = video.dataset[key];
            video.load();
            clearTimeout(fallbackTimer);
            fallbackTimer = setTimeout(function () { if (video.paused) useStill(); }, 700);
            var p = video.play();
            if (p && p.catch) p.catch(useStill);
        };

        loadHero();
        [mq, scrubMq].forEach(function (m) {
            if (m.addEventListener) m.addEventListener("change", loadHero);
            else if (m.addListener) m.addListener(loadHero);
        });

        document.addEventListener("visibilitychange", function () {
            if (reduceMotion) return;
            if (document.hidden) video.pause();
            else video.play().catch(function () {});
        });
    }

    /* ---------- Navbar: scrolled state, progress bar, mobile menu ---------- */
    var navbar = $("#navbar");
    var bar = $("#progressBar");
    var ticking = false;

    function onScroll() {
        var y = window.pageYOffset || document.documentElement.scrollTop;
        var h = document.documentElement.scrollHeight - window.innerHeight;
        navbar.classList.toggle("scrolled", y > 30);
        if (bar) bar.style.transform = "scaleX(" + (h > 0 ? Math.min(y / h, 1) : 0) + ")";
        ticking = false;
    }
    window.addEventListener("scroll", function () {
        if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    onScroll();

    var toggle = $("#navToggle");
    var nav = $("#siteNav");

    function setMenu(open) {
        nav.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        document.body.classList.toggle("no-scroll", open);
    }
    toggle.addEventListener("click", function () { setMenu(!nav.classList.contains("open")); });
    $$("a, button", nav).forEach(function (el) {
        el.addEventListener("click", function () { setMenu(false); });
    });

    /* ---------- Reveal on scroll ---------- */
    var reveals = $$(".reveal");
    if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
            });
        }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
        reveals.forEach(function (el) { io.observe(el); });
    } else {
        reveals.forEach(function (el) { el.classList.add("in"); });
    }

    /* ---------- Mobile: the story lives inside the hero ---------- */
    var storySec = $("#story");
    var heroSec = $("#home");
    if (storySec && heroSec) {
        var homeMq = window.matchMedia("(max-width: 820px)");
        var storyHome = storySec.parentNode;
        var storyNext = storySec.nextSibling;
        var placeStory = function () {
            if (homeMq.matches) heroSec.appendChild(storySec);
            else storyHome.insertBefore(storySec, storyNext);
        };
        placeStory();
        if (homeMq.addEventListener) homeMq.addEventListener("change", placeStory);
        else if (homeMq.addListener) homeMq.addListener(placeStory);
    }

    /* ---------- Story: scroll-driven chapters ---------- */
    var steps = $$(".step");
    var art = $("#stageArt");
    var num = $("#stageNum");
    if (steps.length && art && "IntersectionObserver" in window) {
        var so = null;
        var storyMq = window.matchMedia("(max-width: 820px)");

        var setStep = function (n) {
            steps.forEach(function (s) { s.classList.toggle("is-active", s.dataset.step === String(n)); });
            art.dataset.step = n;
            num.textContent = "0" + n;
        };
        // mobile: chapters are stacked in place, so pick the active one from scroll progress
        var onStoryProgress = function () {
            if (!storyMq.matches) return;
            var sec = $("#story");
            var span = sec.offsetHeight - window.innerHeight;
            var p = span > 0 ? Math.min(Math.max(-sec.getBoundingClientRect().top / span, 0), 0.9999) : 0;
            // as the hero scrolls away, fade the dark scrim + copy so no black band rides up the screen
            var hb = heroSec.getBoundingClientRect().bottom;
            heroSec.style.setProperty("--hx", Math.min(Math.max(hb / (window.innerHeight * 0.5), 0), 1).toFixed(3));
            var idx = Math.floor(p * (steps.length + 1)); // 0 = hero intro, 1..n = chapters
            var hc = $(".hero-content");
            if (hc) hc.classList.toggle("is-away", idx > 0);
            setStep(idx);
        };
        window.addEventListener("scroll", onStoryProgress, { passive: true });
        window.addEventListener("resize", onStoryProgress);

        var buildStoryObserver = function () {
            if (so) so.disconnect();
            var hc0 = $(".hero-content");
            if (storyMq.matches) { onStoryProgress(); return; }
            if (hc0) hc0.classList.remove("is-away");
            var margin = "-49% 0px -49% 0px";
            so = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (!e.isIntersecting) return;
                    steps.forEach(function (s) { s.classList.toggle("is-active", s === e.target); });
                    art.dataset.step = e.target.dataset.step;
                    num.textContent = "0" + e.target.dataset.step;
                });
            }, { rootMargin: margin, threshold: 0 });
            steps.forEach(function (s) { so.observe(s); });
        };

        buildStoryObserver();
        if (storyMq.addEventListener) storyMq.addEventListener("change", buildStoryObserver);
        else if (storyMq.addListener) storyMq.addListener(buildStoryObserver);
    } else {
        steps.forEach(function (s) { s.classList.add("is-active"); });
    }

    /* ---------- Film: scroll-scrubbed video ---------- */
    var film = $("#film");
    var fv = $("#filmVideo");
    var fbar = $("#filmBar");
    if (film && fv && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        var fmq = window.matchMedia("(max-width: 820px)");
        var fkey = "";
        var target = 0, shown = 0, rafOn = false;

        var loadFilm = function () {
            if (fmq.matches) return; // film is desktop-only; on mobile the story lives in the hero
            var key = "desktop";
            if (key === fkey) return;
            fkey = key;
            fv.poster = fv.dataset[key === "mobile" ? "posterMobile" : "posterDesktop"];
            fv.src = fv.dataset[key];
            fv.load();
        };
        loadFilm();
        if (fmq.addEventListener) fmq.addEventListener("change", loadFilm);
        else if (fmq.addListener) fmq.addListener(loadFilm);

        var filmProgress = function () {
            var r = film.getBoundingClientRect();
            var span = film.offsetHeight - window.innerHeight;
            return Math.min(Math.max(-r.top / span, 0), 1);
        };

        var tick = function () {
            shown += (target - shown) * 0.18; // ease toward the scroll position
            if (Math.abs(target - shown) < 0.0005) shown = target;
            if (fv.duration && isFinite(fv.duration)) {
                fv.currentTime = Math.min(shown * fv.duration, fv.duration - 0.05);
            }
            fbar.style.transform = "scaleX(" + shown + ")";
            // desktop: open on a close-up of the panda's face, easing out to the full shot as you scroll
            if (!fmq.matches) {
                var k = Math.min(shown / 0.35, 1);
                var z = 1 + 0.4 * (1 - k * k * (3 - 2 * k));
                fv.style.transform = "translateY(" + (-((z - 1) / 0.4) * 12).toFixed(2) + "%) scale(" + z.toFixed(4) + ")";
            } else {
                fv.style.transform = "";
            }
            if (shown !== target) requestAnimationFrame(tick); else rafOn = false;
        };

        var onFilmScroll = function () {
            target = filmProgress();
            if (!rafOn) { rafOn = true; requestAnimationFrame(tick); }
        };
        window.addEventListener("scroll", onFilmScroll, { passive: true });
        window.addEventListener("resize", onFilmScroll);
        fv.addEventListener("loadedmetadata", onFilmScroll);
        onFilmScroll();
    }

    /* ---------- Mobile: sections pin at their bottom so the next one slides over ---------- */
    var pinned = ["#shop", "#custom", "#about"].map(function (q) { return $(q); }).filter(Boolean);
    if (pinned.length) {
        var pinMq = window.matchMedia("(max-width: 820px)");
        var pinAll = function () {
            pinned.forEach(function (sec) {
                sec.style.top = pinMq.matches
                    ? Math.min(0, window.innerHeight - sec.offsetHeight) + "px" : "";
            });
        };
        pinAll();
        window.addEventListener("resize", pinAll);
        window.addEventListener("load", pinAll);
        if (window.ResizeObserver) {
            var pinRo = new ResizeObserver(pinAll);
            pinned.forEach(function (sec) { pinRo.observe(sec); });
        }
    }

    /* ---------- Customise modal ---------- */
    var modal = $("#customModal");
    var form = $("#customForm");
    var formView = $("#formView");
    var doneView = $("#doneView");
    var formError = $("#formError");
    var submitBtn = $("#submitBtn");
    var lastFocus = null;

    function openModal() {
        lastFocus = document.activeElement;
        formView.hidden = false;
        doneView.hidden = true;
        modal.hidden = false;
        document.body.classList.add("no-scroll");
        setTimeout(function () { $("#mobile").focus(); }, 50);
    }
    function closeModal() {
        modal.hidden = true;
        document.body.classList.remove("no-scroll");
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    $$("[data-open-custom]").forEach(function (b) { b.addEventListener("click", openModal); });
    $$("[data-close-modal]").forEach(function (b) { b.addEventListener("click", closeModal); });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    /* ---------- Image picker ---------- */
    var fileInput = $("#design");
    var dropzone = $("#dropzone");
    var dzEmpty = $("#dzEmpty");
    var dzPreview = $("#dzPreview");
    var dzImg = $("#dzImg");
    var dzName = $("#dzName");
    var previewURL = null;

    function setError(name, msg) {
        var el = $('[data-err="' + name + '"]');
        if (!el) return;
        el.textContent = msg || "";
        var field = el.closest(".field");
        if (field) field.classList.toggle("invalid", !!msg);
    }

    function resetPreview() {
        if (previewURL) { URL.revokeObjectURL(previewURL); previewURL = null; }
        dzPreview.hidden = true;
        dzEmpty.hidden = false;
        dzImg.removeAttribute("src");
    }

    function validateFile(file) {
        if (!file) return "Please add your design image.";
        if (ALLOWED_TYPES.indexOf(file.type) === -1) return "Only JPG, PNG or WEBP images are allowed.";
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
            return "Image is " + (file.size / 1048576).toFixed(1) + " MB. Max allowed is " + MAX_IMAGE_MB + " MB.";
        }
        return "";
    }

    function handleFile() {
        var file = fileInput.files[0];
        setError("design", "");
        resetPreview();
        if (!file) return;
        var msg = validateFile(file);
        if (msg) { setError("design", msg); fileInput.value = ""; return; }
        previewURL = URL.createObjectURL(file);
        dzImg.src = previewURL;
        dzName.textContent = file.name + " · " + (file.size / 1048576).toFixed(2) + " MB";
        dzEmpty.hidden = true;
        dzPreview.hidden = false;
    }
    fileInput.addEventListener("change", handleFile);

    ["dragenter", "dragover"].forEach(function (ev) {
        dropzone.addEventListener(ev, function (e) { e.preventDefault(); dropzone.classList.add("drag"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
        dropzone.addEventListener(ev, function () { dropzone.classList.remove("drag"); });
    });

    /* ---------- Validation + submit ---------- */
    function validate() {
        var ok = true;
        var digits = $("#mobile").value.replace(/\D/g, "");
        var email = $("#email").value.trim();

        setError("mobile", ""); setError("email", ""); setError("design", "");

        if (digits.length < 10 || digits.length > 13) { setError("mobile", "Enter a valid mobile number."); ok = false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setError("email", "Enter a valid email address."); ok = false; }
        var fmsg = validateFile(fileInput.files[0]);
        if (fmsg) { setError("design", fmsg); ok = false; }
        return ok;
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();
        formError.hidden = true;
        if (!validate()) return;

        var data = new FormData(form);
        data.append("_subject", "Guard Control: new custom design request");
        data.append("_template", "table");
        data.append("_captcha", "false");

        submitBtn.classList.add("loading");
        submitBtn.disabled = true;

        // The regular endpoint answers with a redirect/HTML page we can't read cross-origin,
        // so use no-cors: the request (with the file) is delivered, and only network failures reject.
        fetch(FORM_ENDPOINT, { method: "POST", body: data, mode: "no-cors" })
            .then(function () {
                if (window.gtag) gtag("event", "custom_design_submitted");
                form.reset();
                resetPreview();
                formView.hidden = true;
                doneView.hidden = false;
            })
            .catch(function () {
                formError.innerHTML = "Couldn’t send your request. Please try again, or reach us on " +
                    '<a href="https://ig.me/m/guardcontrol" target="_blank" rel="noopener" style="text-decoration:underline">Instagram</a>' +
                    " / WhatsApp.";
                formError.hidden = false;
            })
            .then(function () {
                submitBtn.classList.remove("loading");
                submitBtn.disabled = false;
            });
    });

    /* ---------- Footer year ---------- */
    var y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
})();
