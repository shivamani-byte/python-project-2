
/* ===== BUNNY BUDGET: HORIZONTAL SLIDE NAVIGATION ===== */

document.addEventListener("DOMContentLoaded", function () {
    const viewport = document.querySelector(".slides-viewport");
    const track = document.querySelector(".slides-track");
    const slides = Array.from(document.querySelectorAll(".app-slide"));
    const navLinks = Array.from(document.querySelectorAll(".nav-link"));
    const welcomeButton = document.querySelector(".welcome-button");
    const brand = document.querySelector(".brand");
    const welcomeTitle = document.querySelector("#welcome-title");

    // Stop if the required slide elements are missing.
    if (!viewport || !track || slides.length === 0) {
        console.warn("Slide navigation elements were not found.");
        return;
    }

    // Keep the slide names consistent with the HTML.
    const slideNames = slides.map(slide => slide.dataset.slide);

    const slideTitles = {
        dashboard: "My Dashboard ♡",
        "add-expense": "Add Expense ♡",
        transactions: "Transactions ♡",
        analytics: "Analytics & Reports ♡",
        budget: "Monthly Budget ♡"
    };

    let currentIndex = Math.max(
        0,
        slides.findIndex(slide => slide.dataset.slide === "dashboard")
    );

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    // Show the selected slide.
    function showAppSlide(slideName) {
        const index = slideNames.indexOf(slideName);

        if (index === -1) {
            console.warn("Slide not found:", slideName);
            return;
        }

        currentIndex = index;

        track.style.transform =
            `translateX(-${currentIndex * 100}%)`;

        // Update the active sidebar item.
        navLinks.forEach(link => {
            const linkName = link.getAttribute("href")?.replace("#", "");
            const isActive = linkName === slideName;

            link.classList.toggle("active", isActive);

            if (isActive) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });

        // Update the page heading.
        if (welcomeTitle) {
            welcomeTitle.textContent =
                slideTitles[slideName] || "Bunny Budget ♡";
        }

        // Keep the slide position within the visible area.
        viewport.scrollLeft = 0;

        // Update the URL hash without jumping to the old section.
        if (window.location.hash !== `#${slideName}`) {
            history.replaceState(null, "", `#${slideName}`);
        }
    }

    // Allow other scripts to open a slide.
    window.showAppSlide = showAppSlide;

    // Sidebar navigation.
    navLinks.forEach(link => {
        link.addEventListener("click", function (event) {
            const slideName = this.getAttribute("href")?.replace("#", "");

            if (slideNames.includes(slideName)) {
                event.preventDefault();
                showAppSlide(slideName);
            }
        });
    });

    // Clicking the brand opens Dashboard.
    if (brand) {
        brand.addEventListener("click", function (event) {
            event.preventDefault();
            showAppSlide("dashboard");
        });
    }

    // The welcome button opens Add Expense.
    if (welcomeButton) {
        welcomeButton.addEventListener("click", function (event) {
            event.preventDefault();
            showAppSlide("add-expense");
        });
    }

    // Swipe gesture support for touchscreens.
    viewport.addEventListener(
        "touchstart",
        function (event) {
            if (!event.touches.length) return;

            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            touchEndX = touchStartX;
            touchEndY = touchStartY;
        },
        { passive: true }
    );

    viewport.addEventListener(
        "touchmove",
        function (event) {
            if (!event.touches.length) return;

            touchEndX = event.touches[0].clientX;
            touchEndY = event.touches[0].clientY;
        },
        { passive: true }
    );

    viewport.addEventListener(
        "touchend",
        function () {
            const differenceX = touchStartX - touchEndX;
            const differenceY = touchStartY - touchEndY;
            const minimumSwipe = 50;

            // Ignore vertical scrolling and very short gestures.
            if (
                Math.abs(differenceX) < minimumSwipe ||
                Math.abs(differenceX) <= Math.abs(differenceY)
            ) {
                return;
            }

            if (differenceX > 0) {
                // Swipe left: show the next slide.
                showNextSlide();
            } else {
                // Swipe right: show the previous slide.
                showPreviousSlide();
            }
        },
        { passive: true }
    );

    // Keyboard navigation using the left and right arrow keys.
    document.addEventListener("keydown", function (event) {
        const target = event.target;

        // Do not change slides while the user is typing.
        if (
            target instanceof HTMLElement &&
            (
                target.isContentEditable ||
                ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)
            )
        ) {
            return;
        }

        if (event.key === "ArrowRight") {
            showNextSlide();
        } else if (event.key === "ArrowLeft") {
            showPreviousSlide();
        }
    });

    function showNextSlide() {
        const nextIndex = Math.min(
            currentIndex + 1,
            slides.length - 1
        );

        showAppSlide(slideNames[nextIndex]);
    }

    function showPreviousSlide() {
        const previousIndex = Math.max(currentIndex - 1, 0);

        showAppSlide(slideNames[previousIndex]);
    }

    // Open the slide specified in the URL, if valid.
    const requestedSlide = window.location.hash.replace("#", "");

    if (slideNames.includes(requestedSlide)) {
        showAppSlide(requestedSlide);
    } else {
        showAppSlide("dashboard");
    }
});
