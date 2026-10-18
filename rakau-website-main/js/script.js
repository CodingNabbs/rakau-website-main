/* script.js
 *
 * Everything on the site that moves: the theme toggle, the mobile
 * menu, the active-link highlight, the header hairline, the About
 * page's sections, scroll reveals, the walks and gallery carousel and the
 * contact form.
 *
 * The initial theme is NOT set here. That happens in an inline script
 * in each page's <head>, because by the time this file loads the page
 * has already painted, and a dark site flashing white at people is
 * not the first impression we're going for.
 */
(function () {
    /* Every one of these exists on every page. If you make a page
     * without them, this script will fall over, and it will be right
     * to do so.
     */
    var root = document.documentElement;
    var themeToggle = document.getElementById('theme-toggle');
    var menuToggle = document.getElementById('menu-toggle');
    var siteNav = document.getElementById('site-nav');
    var navOverlay = document.getElementById('nav-overlay');
    var header = document.getElementById('site-header');
    var yearEl = document.getElementById('year');

    /* Language: English / te reo Māori
     *
     * The toggle in the nav bar sets the language for the whole site,
     * and it's remembered from page to page, like the theme. English
     * is the default. Like the day/night toggle, it's labelled with
     * what clicking it will do: it shows the OTHER language's name, in
     * that language.
     *
     * Anything with a data-mi attribute has a te reo version of its
     * text; data-mi-alt and data-mi-aria-label do the same for image
     * descriptions and screen-reader labels. The English is read from
     * the element itself the first time, so the HTML stays plain
     * English with the translation alongside it. Switched to te reo,
     * each of those elements is marked lang="mi", so screen readers
     * pronounce it as te reo rather than mangling it with English
     * rules. The memes stay in English: they don't translate.
     *
     * Text that script.js writes itself (carousel captions, the contact
     * form's messages) reads the language when it writes, and the
     * carousel listens for the 'rakau:language' event to redraw.
     *
     * Started as the homepage's greeting switch; it just grew up.
     */
    var LANGUAGE_KEY = 'rakau-language';
    var languageToggle = document.getElementById('lang-toggle');
    var languagePrefix = document.getElementById('lang-toggle-prefix');
    var languageName = document.getElementById('lang-toggle-name');
    var translatable = document.querySelectorAll('[data-mi]');
    var TRANSLATABLE_ATTRS = ['alt', 'aria-label'];
    var attrTranslatable = document.querySelectorAll('[data-mi-alt], [data-mi-aria-label]');

    /* The day/night button's label, in both languages. Used by
     * syncToggleUI below, keyed by the theme you're switching FROM. */
    var THEME_LABELS = {
        en: { light: 'Switch to night', dark: 'Switch to day' },
        mi: { light: 'Huri ki te pō', dark: 'Huri ki te awatea' }
    };

    translatable.forEach(function (element) {
        element.setAttribute('data-en', element.textContent);
    });
    attrTranslatable.forEach(function (element) {
        TRANSLATABLE_ATTRS.forEach(function (attr) {
            if (element.hasAttribute('data-mi-' + attr)) {
                element.setAttribute('data-en-' + attr, element.getAttribute(attr));
            }
        });
    });

    function markLanguage(element, language) {
        if (language === 'mi') {
            element.setAttribute('lang', 'mi');
        } else {
            element.removeAttribute('lang');
        }
    }

    function currentLanguage() {
        return root.getAttribute('data-language') === 'mi' ? 'mi' : 'en';
    }

    function applyLanguage(language) {
        root.setAttribute('data-language', language);
        translatable.forEach(function (element) {
            element.textContent = element.getAttribute('data-' + language);
            markLanguage(element, language);
        });
        attrTranslatable.forEach(function (element) {
            TRANSLATABLE_ATTRS.forEach(function (attr) {
                var value = element.getAttribute('data-' + language + '-' + attr);
                if (value !== null) element.setAttribute(attr, value);
            });
            markLanguage(element, language);
        });
        /* Visible: the other language's name, marked as that language.
         * Screen readers also get the hidden prefix, in the current one. */
        if (language === 'mi') {
            languagePrefix.textContent = 'Huri ki te reo ';
            languagePrefix.setAttribute('lang', 'mi');
            languageName.textContent = 'English';
            languageName.setAttribute('lang', 'en');
        } else {
            languagePrefix.textContent = 'Switch language to ';
            languagePrefix.removeAttribute('lang');
            languageName.textContent = 'Māori';
            languageName.setAttribute('lang', 'mi');
        }
        syncToggleUI(currentTheme());
        document.dispatchEvent(new CustomEvent('rakau:language'));
    }

    var savedLanguage = 'en';
    try {
        /* rakau-home-language was the homepage-only switch's key; carry it over. */
        var stored = localStorage.getItem(LANGUAGE_KEY) || localStorage.getItem('rakau-home-language');
        savedLanguage = stored === 'mi' ? 'mi' : 'en';
    } catch (e) {
        /* Storage unavailable: English, and the switch still works for this page. */
    }
    applyLanguage(savedLanguage);

    /* Switching language: only the words that change move. Each one
     * softens out (fade + slight blur), the text swaps while it's
     * invisible, then the new words sharpen back in. The capsule eases
     * between the widths of "Māori" and "English" instead of jumping.
     * Nothing else on the page moves.
     *
     * Click again mid-switch and it carries on towards the newest
     * choice (targetLanguage), cancelling whatever was in flight.
     * Reduced motion, or no element.animate: the words just swap. The
     * globe gets half a turn either way. */
    var globe = languageToggle.querySelector('.globe-icon');
    var globeTurns = 0;
    var targetLanguage = currentLanguage();
    var languageAnimations = [];
    var swapTimer = null;
    var FADE_OUT_MS = 140;
    var FADE_IN_MS = 260;

    var BLURRED = { opacity: 0, filter: 'blur(4px)' };
    var SHARP = { opacity: 1, filter: 'blur(0)' };

    function switchLanguage(language) {
        clearTimeout(swapTimer);
        languageAnimations.forEach(function (animation) { animation.cancel(); });
        languageAnimations = [];

        if (reduceMotion.matches || !languageToggle.animate) {
            applyLanguage(language);
            return;
        }

        var cssEase = getComputedStyle(root);
        var easeIn = 'cubic-bezier(0.4, 0, 1, 1)';
        var easeOut = cssEase.getPropertyValue('--ease-out').trim() || 'ease-out';
        var targets = Array.prototype.slice.call(translatable).concat(languageName);
        var startWidth = languageToggle.offsetWidth;

        var outs = targets.map(function (element) {
            return element.animate([SHARP, BLURRED], { duration: FADE_OUT_MS, easing: easeIn, fill: 'forwards' });
        });
        languageAnimations = outs;

        /* A timer rather than waiting on the animations' finished promises:
         * those can arrive late or not at all if the browser pauses
         * animations, and then the words would never change. */
        swapTimer = setTimeout(function () {
            applyLanguage(language);
            var endWidth = languageToggle.offsetWidth;
            var ins = targets.map(function (element) {
                return element.animate([BLURRED, SHARP], { duration: FADE_IN_MS, easing: easeOut });
            });
            ins.push(languageToggle.animate(
                [{ width: startWidth + 'px' }, { width: endWidth + 'px' }],
                { duration: FADE_IN_MS, easing: easeOut }
            ));
            outs.forEach(function (animation) { animation.cancel(); });
            languageAnimations = ins;

            /* Safety net: once the fade-in should be over, make sure it is.
             * If the browser ever stalls an animation, the words still end
             * up visible rather than stuck faded out. */
            swapTimer = setTimeout(function () {
                ins.forEach(function (animation) { animation.finish(); });
            }, FADE_IN_MS + 100);
        }, FADE_OUT_MS);
    }

    languageToggle.addEventListener('click', function () {
        var language = targetLanguage === 'mi' ? 'en' : 'mi';
        targetLanguage = language;

        globeTurns += 1;
        globe.style.setProperty('--globe-turn', globeTurns * 180 + 'deg');

        switchLanguage(language);

        try {
            localStorage.setItem(LANGUAGE_KEY, language);
        } catch (e) {
            /* The choice lasts until the page is closed. */
        }
    });

    /* Copyright year
     *
     * Computed rather than typed, so nobody has to remember to edit
     * five footers every January. Nobody would have.
     */
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }

    /* Active link
     *
     * Matches each menu link's href against the current filename.
     * Visiting the site root gives an empty filename, which we
     * charitably assume means index.html.
     *
     * This only works because every href is a bare filename. Start
     * writing "./about.html" or "/about.html" and the highlight will
     * quietly stop working, and you will spend twenty minutes finding
     * out why. Consider yourself warned.
     */
    var currentPage = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.site-nav a, .footer-nav a').forEach(function (link) {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('is-active');
            link.setAttribute('aria-current', 'page');
        }
    });

    /* currentTheme
     *
     * Anything that isn't 'light' is 'dark'. Dark is the default, the
     * fallback, and frankly the house style.
     */
    function currentTheme() {
        return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    /* syncToggleUI
     *
     * The button's label describes what clicking it WILL do, not what
     * the theme currently is. A screen reader saying "dark mode" while
     * you're already in dark mode helps nobody. Day and night rather
     * than light and dark, because that's what actually changes: the
     * photos go from daylight to the aurora, and the tree loses its
     * leaves. The title gives sighted users the same words on hover.
     *
     * No aria-pressed: a button whose label changes AND that claims to
     * be pressed reads as a contradiction ("Switch to day, pressed").
     *
     * The label follows the site language (see THEME_LABELS above), and
     * the button is marked lang="mi" when it's in te reo.
     */
    function syncToggleUI(theme) {
        var language = currentLanguage();
        var label = THEME_LABELS[language][theme === 'light' ? 'light' : 'dark'];
        themeToggle.setAttribute('aria-label', label);
        themeToggle.title = label;
        if (language === 'mi') {
            themeToggle.setAttribute('lang', 'mi');
        } else {
            themeToggle.removeAttribute('lang');
        }
    }

    syncToggleUI(currentTheme());

    /* applyTheme / the ripple
     *
     * Where the browser supports view transitions, the new theme
     * spreads out in a circle from the tree button instead of the whole
     * page fading at once. The browser snapshots the old page, we swap
     * the theme, and the CSS (see "Theme ripple") grows the new page
     * out of the button. The usual CSS transitions are switched off
     * for the swap, or the snapshot would catch everything half-faded.
     *
     * Browsers without it, and anyone who asked their OS for less
     * motion, get the plain fade. Nothing breaks either way.
     */
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function applyTheme(next) {
        root.setAttribute('data-theme', next);
        syncToggleUI(next);
    }

    themeToggle.addEventListener('click', function () {
        var next = currentTheme() === 'light' ? 'dark' : 'light';

        if (document.startViewTransition && !reduceMotion.matches) {
            var box = themeToggle.getBoundingClientRect();
            var x = box.left + box.width / 2;
            var y = box.top + box.height / 2;
            /* Far enough to reach the corner furthest from the button. */
            var radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
            root.style.setProperty('--ripple-x', x + 'px');
            root.style.setProperty('--ripple-y', y + 'px');
            /* Sizes of the mask tile (see "Theme ripple" in the CSS). Its disc is
             * solid out to 3/8 of the tile, so a tile 8/3 the radius wide covers
             * that radius. It starts at the button's edge, since anything smaller
             * is hidden behind the button and reads as a pause after the click,
             * and ends past the furthest corner. */
            root.style.setProperty('--ripple-from', (box.width / 2) * 8 / 3 + 'px');
            root.style.setProperty('--ripple-to', radius * 8 / 3 + 'px');

            root.classList.add('theme-rippling');
            var ripple = document.startViewTransition(function () { applyTheme(next); });
            ripple.finished.finally(function () { root.classList.remove('theme-rippling'); });
        } else {
            applyTheme(next);
        }

        try {
            localStorage.setItem('rakau-theme', next);
        } catch (e) {
            /* Some browsers in private mode throw here instead of just
             * declining politely. The theme still changes; it simply
             * won't be remembered. We have decided we can live with that.
             */
        }
    });

    /* openMenu / closeMenu
     *
     * Every change openMenu makes, closeMenu must undo. If you add a
     * line to one and not the other, the page will eventually get
     * stuck with the scroll locked and no visible menu, and someone
     * will report that "the website is frozen". It will not be frozen.
     * It will be your fault.
     */
    function openMenu() {
        siteNav.classList.add('is-open');
        navOverlay.classList.add('is-open');
        menuToggle.classList.add('is-active');
        menuToggle.setAttribute('aria-expanded', 'true');
        document.body.classList.add('nav-locked');
    }

    function closeMenu() {
        siteNav.classList.remove('is-open');
        navOverlay.classList.remove('is-open');
        menuToggle.classList.remove('is-active');
        menuToggle.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('nav-locked');
    }

    menuToggle.addEventListener('click', function () {
        if (siteNav.classList.contains('is-open')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    /* Ways out of the menu
     *
     * Overlay click, link click, Escape. Three exits, because people
     * will try all three, usually in that order, and usually annoyed.
     */
    navOverlay.addEventListener('click', closeMenu);

    siteNav.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeMenu();
    });

    /* And a fourth, for nobody in particular: widen the window past
     * the 720px breakpoint with the menu open and the hamburger
     * vanishes, leaving the overlay and the scroll lock behind with
     * no way to dismiss them. So we close it for you.
     */
    var desktopQuery = window.matchMedia('(min-width: 721px)');
    function onBreakpointChange(event) {
        if (event.matches) closeMenu();
    }
    if (desktopQuery.addEventListener) {
        desktopQuery.addEventListener('change', onBreakpointChange);
    } else {
        desktopQuery.addListener(onBreakpointChange);
    }

    /* onScroll
     *
     * Adds a shadow under the header once you've scrolled, so it
     * doesn't melt into the page. The 8px threshold was picked by eye.
     * There is no deeper reasoning; please don't go looking for one.
     *
     * Called once on load too, because browsers love restoring your
     * scroll position on refresh without telling anybody.
     */
    function onScroll() {
        header.classList.toggle('is-scrolled', window.scrollY > 8);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* About page sections
     *
     * The sections are <details>, which open and close instantly. We
     * take over the summary click and animate the body's height
     * instead. Opening: set open, then grow from 0 to full height.
     * Closing: shrink to 0, and only then actually close it, or the
     * text would vanish before the box had finished shrinking.
     *
     * The text fades on its own timeline: in slightly after the box
     * starts growing, out quickly before it shrinks. Fading it in step
     * with the height looked like the text was being squashed.
     *
     * Clicking again mid-animation starts from wherever the box has
     * got to, so mashing the button doesn't make it jump. Reduced
     * motion, or a browser without element.animate, gets the plain
     * instant toggle. Only the About page has these; elsewhere the
     * list is empty and this does nothing.
     */
    /* Same curve as everything else that changes state; it lives in the CSS (--ease). */
    var ease = getComputedStyle(root).getPropertyValue('--ease').trim() || 'cubic-bezier(0.4, 0, 0.2, 1)';

    document.querySelectorAll('.about-section-item').forEach(function (details) {
        var summary = details.querySelector('summary');
        var body = details.querySelector('.about-section-body');
        /* The fade runs on the body wrapper too (alongside its height), so
         * however many paragraphs a section has, they all fade together. */
        var text = body;
        var heightAnim = null;
        var textAnim = null;

        summary.addEventListener('click', function (event) {
            if (reduceMotion.matches || !body.animate) return;
            event.preventDefault();

            var opening = !details.open || details.classList.contains('is-closing');
            var fromHeight = body.offsetHeight;
            var fromOpacity = details.open ? getComputedStyle(text).opacity : 0;
            if (heightAnim) heightAnim.cancel();
            if (textAnim) textAnim.cancel();

            if (opening) {
                details.classList.remove('is-closing');
                details.open = true;
            } else {
                details.classList.add('is-closing');
            }

            var toHeight = opening ? body.scrollHeight : 0;
            /* Longer trips take a little longer, so short and tall boxes feel the same speed. */
            var duration = Math.min(550, 250 + Math.abs(toHeight - fromHeight) * 0.6);

            heightAnim = body.animate(
                [{ height: fromHeight + 'px' }, { height: toHeight + 'px' }],
                { duration: duration, easing: ease }
            );
            textAnim = text.animate(
                [
                    { opacity: fromOpacity, transform: 'translateY(' + (opening ? -6 : 0) + 'px)' },
                    { opacity: opening ? 1 : 0, transform: 'translateY(' + (opening ? 0 : -6) + 'px)' }
                ],
                opening
                    ? { duration: duration * 0.8, delay: duration * 0.2, easing: ease, fill: 'backwards' }
                    : { duration: duration * 0.5, easing: ease, fill: 'forwards' }
            );

            heightAnim.onfinish = function () {
                heightAnim = null;
                if (textAnim) { textAnim.cancel(); textAnim = null; }
                if (!opening) {
                    details.open = false;
                    details.classList.remove('is-closing');
                }
            };
        });
    });

    /* Scroll reveal
     *
     * Anything marked data-reveal fades up the first time it scrolls
     * into view (the CSS does the fading; this just says when). Once
     * shown it stays shown. No IntersectionObserver, no fading: just
     * show everything.
     */
    var revealEls = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window) {
        var revealer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    revealer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -10% 0px' });
        revealEls.forEach(function (el) { revealer.observe(el); });
    } else {
        revealEls.forEach(function (el) { el.classList.add('is-revealed'); });
    }

    /* Carousel (Walks and Gallery)
     *
     * Every item is stacked in the middle of the carousel; layout()
     * slides each one sideways and shrinks it by how far it is from
     * the current item, through the --x, --s and --o custom
     * properties. The CSS animates the change, so all this does is
     * the arithmetic.
     *
     * Ways to move: arrows, dots, clicking a neighbour, the left and
     * right keys (Home/End too), and swiping. It stops at the ends
     * rather than wrapping, and the arrow on that side greys out, so
     * you can tell you've reached the end. It opens on the middle item.
     */
    var carousel = document.getElementById('carousel');
    if (carousel) {
        var items = Array.prototype.slice.call(carousel.querySelectorAll('.carousel-item'));
        var nameEl = document.getElementById('carousel-name');
        var metaEl = document.getElementById('carousel-meta');
        var dotsEl = document.querySelector('.carousel-dots');
        var arrows = document.querySelectorAll('.carousel-arrow');
        var current = 0;
        var videoButtons = [];
        var fullscreenLabels = {
            en: { enter: 'Enter fullscreen', exit: 'Exit fullscreen' },
            mi: { enter: 'Whakakīa te mata', exit: 'Putaatu i te mata katoa' }
        };

        function syncVideoButton(video, button) {
            var playing = !video.paused;
            var language = currentLanguage();
            var label = playing
                ? (language === 'mi' ? 'Whakatārewatia te ataata' : 'Pause video')
                : (language === 'mi' ? 'Whakatangihia te ataata' : 'Play video');
            button.classList.toggle('is-playing', playing);
            button.setAttribute('aria-label', label);
            button.title = label;
        }

        function playVideo(video) {
            var playRequest = video.play();
            if (playRequest && typeof playRequest.catch === 'function') playRequest.catch(function () {});
        }

        function setActiveVideo(index) {
            videoButtons.forEach(function (control, i) {
                if (i === index) {
                    playVideo(control.video);
                } else {
                    control.video.pause();
                }
            });
        }

        function syncFullscreenButton(control) {
            var isFullscreen = document.fullscreenElement === control.item;
            var labels = fullscreenLabels[currentLanguage()];
            var label = isFullscreen ? labels.exit : labels.enter;
            control.fullscreenButton.classList.toggle('is-fullscreen', isFullscreen);
            control.fullscreenButton.setAttribute('aria-label', label);
            control.fullscreenButton.title = label;
        }

        items.forEach(function (item, i) {
            var video = item.querySelector('video');
            var button = item.querySelector('.video-toggle');
            var speed = item.querySelector('.video-speed');
            var fullscreenButton = item.querySelector('.video-fullscreen-toggle');
            if (!video || !button || !speed || !fullscreenButton) return;

            var control = { item: item, video: video, button: button, speed: speed, fullscreenButton: fullscreenButton };
            videoButtons.push(control);
            video.addEventListener('play', function () {
                videoButtons.forEach(function (control) {
                    if (control.video !== video) control.video.pause();
                });
                syncVideoButton(video, button);
            });
            video.addEventListener('pause', function () { syncVideoButton(video, button); });
            speed.addEventListener('change', function () {
                video.playbackRate = Number(speed.value);
            });
            fullscreenButton.addEventListener('click', function (event) {
                event.stopPropagation();
                var fullscreenRequest = document.fullscreenElement === item
                    ? document.exitFullscreen()
                    : item.requestFullscreen();
                if (fullscreenRequest && typeof fullscreenRequest.catch === 'function') fullscreenRequest.catch(function () {});
            });
            button.addEventListener('click', function (event) {
                event.stopPropagation();
                if (video.paused) {
                    if (i !== current) {
                        go(i);
                    } else {
                        playVideo(video);
                    }
                } else {
                    video.pause();
                }
            });
            syncVideoButton(video, button);
            syncFullscreenButton(control);
        });

        document.addEventListener('fullscreenchange', function () {
            videoButtons.forEach(syncFullscreenButton);
        });

        /* Size and fade by distance from the centre: 0, 1, 2 away. */
        var SCALES = [1, 0.72, 0.52];
        var OPACITIES = [1, 0.6, 0.3];

        function layout() {
            var width = items.length ? items[0].offsetWidth : 0;
            var gap = width * 0.05;

            items.forEach(function (item, i) {
                var offset = i - current;
                var away = Math.abs(offset);
                var step = Math.min(away, 2);
                var x = 0;
                for (var k = 1; k <= step; k++) {
                    x += width * SCALES[k - 1] / 2 + gap + width * SCALES[k] / 2;
                }
                item.style.setProperty('--x', (offset < 0 ? -x : x) + 'px');
                item.style.setProperty('--s', SCALES[step]);
                item.style.setProperty('--o', away > 2 ? 0 : OPACITIES[step]);
                item.style.zIndex = 10 - away;
                item.classList.toggle('is-active', away === 0);
                item.setAttribute('aria-hidden', String(away !== 0));
            });

            var active = items[current];
            var inMaori = currentLanguage() === 'mi';
            var meta = active && inMaori && active.getAttribute('data-mi-meta');
            nameEl.textContent = active ? active.dataset.name : (inMaori ? 'Kāore anō he mea i konei' : 'Nothing here yet');
            metaEl.textContent = meta || (active ? active.dataset.meta : '');
            markLanguage(metaEl, meta ? 'mi' : 'en');

            dotsEl.querySelectorAll('.carousel-dot').forEach(function (dot, i) {
                dot.setAttribute('aria-current', String(i === current));
            });
            arrows[0].disabled = current <= 0;
            arrows[1].disabled = current >= items.length - 1;
        }

        function go(index) {
            var next = Math.max(0, Math.min(items.length - 1, index));
            if (next === current) return;
            current = next;
            layout();
            setActiveVideo(current);
        }

        function buildDots() {
            dotsEl.innerHTML = '';
            items.forEach(function (item, i) {
                var dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'carousel-dot';
                dot.setAttribute('aria-label', (currentLanguage() === 'mi' ? 'Tirohia a ' : 'Show ') + item.dataset.name);
                dot.addEventListener('click', function () { go(i); });
                dotsEl.appendChild(dot);
            });
        }

        arrows.forEach(function (arrow) {
            arrow.addEventListener('click', function () {
                go(current + Number(arrow.dataset.dir));
            });
        });

        carousel.addEventListener('keydown', function (event) {
            var moves = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: items.length - 1 };
            if (event.key in moves) {
                event.preventDefault();
                go(moves[event.key]);
            }
        });

        /* Swipe. A drag of more than 40px counts as a swipe, and also
         * cancels the click that would otherwise follow it. */
        var startX = null;
        var swiped = false;
        carousel.addEventListener('pointerdown', function (event) {
            startX = event.clientX;
            swiped = false;
        });
        carousel.addEventListener('pointerup', function (event) {
            if (startX === null) return;
            var dx = event.clientX - startX;
            startX = null;
            if (Math.abs(dx) > 40) {
                swiped = true;
                go(current + (dx < 0 ? 1 : -1));
            }
        });

        items.forEach(function (item, i) {
            item.addEventListener('click', function () {
                if (!swiped && i !== current) go(i);
            });
        });

        /* Place everything instantly on load (and on resize) rather than
         * letting every photo slide out from the middle each time. The
         * slide is for browsing, not for arriving. */
        function layoutInstantly() {
            carousel.classList.add('is-instant');
            layout();
            void carousel.offsetWidth; /* apply the positions before transitions return */
            carousel.classList.remove('is-instant');
        }

        window.addEventListener('resize', layoutInstantly);
        document.addEventListener('rakau:language', function () {
            buildDots();
            layout();
            videoButtons.forEach(function (control) {
                syncVideoButton(control.video, control.button);
                syncFullscreenButton(control);
            });
        });
        current = Math.floor((items.length - 1) / 2);
        buildDots();
        layoutInstantly();
        setActiveVideo(current);
    }

    /* Contact form
     *
     * NOT CONNECTED TO ANYTHING. There's no server yet, so this checks
     * the fields and shows a thank-you without sending a thing. When
     * the form gets a real action (Formspree, Netlify Forms...),
     * delete everything after the validity check and let it submit.
     *
     * Errors only appear after the first Send, not while you're still
     * typing your name.
     */
    var contactForm = document.getElementById('contact-form');
    if (contactForm) {
        var formError = document.getElementById('form-error');
        var formSuccess = document.getElementById('form-success');

        contactForm.addEventListener('submit', function (event) {
            event.preventDefault();
            contactForm.classList.add('was-submitted');

            if (!contactForm.checkValidity()) {
                formError.textContent = currentLanguage() === 'mi'
                    ? 'kua wareware koe i tētahi mea lol. me tuhi tō ingoa, he īmēra tūturu, me tētahi karere kthx'
                    : 'u forgot something lol. need ur name, a real email n a message kthx';
                markLanguage(formError, currentLanguage());
                formError.hidden = false;
                contactForm.querySelector(':invalid').focus();
                return;
            }

            var firstName = contactForm.elements.name.value.trim().split(/\s+/)[0];
            formError.hidden = true;
            contactForm.hidden = true;
            formSuccess.textContent = currentLanguage() === 'mi'
                ? 'Kia ora, ' + firstName + '! kua tukuna tō karere ki te kore lol. (tino pono, kāore anō tēnei puka kia hono.)'
                : 'Thanks, ' + firstName + '! ur message has been sent straight to the void lol. (srsly tho, this form isn’t hooked up yet.)';
            markLanguage(formSuccess, currentLanguage());
            formSuccess.hidden = false;
            formSuccess.focus();
        });
    }
})();
