// ─── DOM REFERENCES ───────────────────────────────────────────────────────────
// These lines run once when the page loads and grab references to HTML elements
// so we can interact with them later without searching the DOM every time

// Selects every element that has a data-action attribute — this includes
// the nav links (How it works, Poets, Requests board, For poets),
// the hero buttons (Request a poem, Become a poet),
// and the Refresh button above the requests board
const actionLinks = document.querySelectorAll('[data-action]');

// Selects every element that has a data-close attribute — these are the
// × buttons inside each modal header that dismiss the modal when clicked
const closeButtons = document.querySelectorAll('[data-close]');

// The three modal overlay divs — these are hidden by default (class="hidden")
// and shown/hidden by JS when the user clicks the trigger buttons
const requestModal = document.getElementById('request-modal');     // <div id="request-modal"> — the "Request a poem" form modal
const poetModal = document.getElementById('poet-modal');           // <div id="poet-modal"> — the "Become a poet" form modal
const portfolioModal = document.getElementById('portfolio-modal'); // <div id="portfolio-modal"> — the poet portfolio snapshot modal

// The two forms that live inside the modals above
// requestForm contains: occasion, tone, subject, detail, budget fields
// poetForm contains: name, specialty, sample, rate fields
const requestForm = document.getElementById('request-form'); // <form id="request-form"> inside request-modal
const poetForm = document.getElementById('poet-form');       // <form id="poet-form"> inside poet-modal

// The small notification bar at the bottom of the page
// It's hidden by default and shown briefly after actions like form submissions
const toast = document.getElementById('toast'); // <div id="toast">

// The main requests board on the homepage where request cards are displayed
const requestsBoard = document.getElementById('requests-board'); // <div id="requests-board">

// The three pagination controls below the requests board
const requestsPrevBtn = document.getElementById('requests-prev-btn');       // <button id="requests-prev-btn"> — goes to previous page
const requestsNextBtn = document.getElementById('requests-next-btn');       // <button id="requests-next-btn"> — goes to next page
const requestsPageStatus = document.getElementById('requests-page-status'); // <span id="requests-page-status"> — shows "Page 1 of 3"
const requestsPagination = document.getElementById('requests-pagination');  // <div id="requests-pagination"> — wraps all pagination controls

// A second requests board that lives inside the poet modal
// so poets can see open requests without leaving the modal
const poetModalRequestsBoard = document.getElementById('poet-modal-requests-board'); // <div id="poet-modal-requests-board">

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// These values never change during the session — defined once at the top
// so if you ever need to update them you only change them in one place

const API_BASE = '/api';              // Every backend call starts with this — e.g. /api/requests, /api/poets
const REFRESH_MIN_DURATION_MS = 900; // The Refresh button animation lasts at least this long in milliseconds
                                     // so it doesn't flash and disappear instantly if the server responds fast
const REQUESTS_PER_PAGE = 3;         // How many request cards to show at once before paginating

// ─── STATE ────────────────────────────────────────────────────────────────────
// These variables change as the user interacts with the page
// They are declared with let instead of const because their values get reassigned

let currentRequestsPage = 1; // Tracks which page of requests the user is on
                              // starts at 1, increments/decrements with prev/next buttons

let allRequests = [];         // Stores the full list of requests fetched from the backend
                              // pagination slices this array to show only the current page

let currentPoet = null;       // Stores the poet's id, name, and specialty after they register
                              // stays null until the poet form is submitted successfully
                              // the id is required to submit bids — if null, bids are blocked

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────

// Makes a modal visible by removing the "hidden" CSS class
// Also updates aria-hidden to "false" so screen readers know the modal is open
// Called whenever a trigger button is clicked (open-request, open-poet, open-portfolio)
function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

// Hides a modal by adding the "hidden" CSS class back
// Also updates aria-hidden to "true" so screen readers know it is closed
// Called by close buttons, clicking outside the modal, and pressing Escape
function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

// ─── SCROLL HELPER ────────────────────────────────────────────────────────────

// Smoothly scrolls the page to a section by its HTML id
// The browser animates the scroll instead of jumping instantly
// Used by the nav links: scroll-how scrolls to #how-it-works,
// scroll-poets scrolls to #poets, scroll-requests scrolls to #poet-requests
function scrollToSection(id) {
  const section = document.getElementById(id);
  if (section) {
    // behavior: smooth — animated scroll instead of instant jump
    // block: start — aligns the top of the section with the top of the viewport
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ─── TOAST NOTIFICATION ───────────────────────────────────────────────────────

// Shows a short feedback message in <div id="toast"> at the bottom of the page
// The message appears immediately and automatically disappears after 2.2 seconds
// If the toast element doesn't exist on the page, the function exits safely
// Used after: form submissions, errors, successful bids, poet registration
function showToast(message) {
  if (!toast) return; // Safety check — exits if toast element isn't in the DOM
  toast.textContent = message;           // Sets the message text
  toast.classList.remove('hidden');      // Makes the toast visible
  window.setTimeout(() => {
    toast.classList.add('hidden');       // Hides it again after 2200ms (2.2 seconds)
  }, 2200);
}

// ─── API HELPER ───────────────────────────────────────────────────────────────

// A reusable wrapper around the browser's built-in fetch() function
// Used for every call to the Flask backend — GET and POST requests
// Automatically adds the Content-Type header so Flask knows to expect JSON
// If the server returns an error (non-200 status or ok: false in the response),
// it throws an Error with the message from the backend so the caller can catch it
async function apiRequest(path, options = {}) {
  // Builds the full URL like /api/requests or /api/poets
  // Merges in any extra headers or options the caller passed in
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}) // Spreads any additional headers passed in
    },
    ...options // Spreads method, body, etc. from the caller
  });

  // Tries to parse the response body as JSON
  // If the response has no body or is malformed, defaults to an empty object
  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  // If HTTP status is not 2xx, or the backend explicitly sent ok: false,
  // throw an error with the backend's error message so the caller can show it
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || 'Request failed.');
  }

  // Returns the parsed JSON payload to the caller
  return payload;
}

// ─── SECURITY HELPER ──────────────────────────────────────────────────────────

// Converts special HTML characters in a string to their safe equivalents
// This prevents users from injecting HTML or scripts through form fields
// For example, if someone types <script>alert(1)</script> in the occasion field,
// this turns it into &lt;script&gt;alert(1)&lt;/script&gt; which displays as
// plain text instead of executing as code
// Called every time user-submitted text is inserted into the DOM
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')   // Must be first to avoid double-escaping
    .replaceAll('<', '&lt;')    // Prevents opening HTML tags
    .replaceAll('>', '&gt;')    // Prevents closing HTML tags
    .replaceAll('"', '&quot;')  // Prevents breaking out of attribute values
    .replaceAll("'", '&#39;');  // Prevents breaking out of single-quoted attributes
}

// ─── REQUESTS BOARD LOADING STATE ─────────────────────────────────────────────

// Replaces the contents of a board with a "Loading…" message
// while waiting for the fetch to complete — gives the user visual feedback
// that something is happening instead of showing a blank or stale board
// Targets either <div id="requests-board"> or <div id="poet-modal-requests-board">
function setRequestsBoardLoading(targetBoard) {
  if (!targetBoard) return; // Safety check — exits if the element doesn't exist
  targetBoard.innerHTML = '<div class="request-empty">Loading new requests…</div>';
}

// ─── PAGINATION VISIBILITY ────────────────────────────────────────────────────

// Shows or hides the entire <div id="requests-pagination"> bar
// It is hidden on page load and only shown once there are more than
// REQUESTS_PER_PAGE (3) requests, so the prev/next buttons don't appear
// when there is nothing to paginate through
function setRequestsPaginationVisibility(isVisible) {
  if (!requestsPagination) return;
  // toggle adds "hidden" when isVisible is false, removes it when true
  requestsPagination.classList.toggle('hidden', !isVisible);
}

// Calculates how many pages are needed to show all requests
// Math.ceil rounds up so 4 requests at 3 per page = 2 pages, not 1.33
// Math.max ensures there is always at least 1 page even with 0 requests
function getTotalRequestPages() {
  return Math.max(1, Math.ceil(allRequests.length / REQUESTS_PER_PAGE));
}

// Updates the pagination UI to reflect the current page number
// Updates <span id="requests-page-status"> text to e.g. "Page 2 of 4"
// Disables <button id="requests-prev-btn"> when on the first page
// Disables <button id="requests-next-btn"> when on the last page
// Exits early if any of the three elements are missing from the DOM
function renderRequestsPaginationStatus() {
  if (!requestsPageStatus || !requestsPrevBtn || !requestsNextBtn) return;
  const totalPages = getTotalRequestPages();
  requestsPageStatus.textContent = `Page ${currentRequestsPage} of ${totalPages}`;
  requestsPrevBtn.disabled = currentRequestsPage <= 1;           // Disable on first page
  requestsNextBtn.disabled = currentRequestsPage >= totalPages;  // Disable on last page
}

// Renders the correct slice of allRequests for the current page
// and updates the pagination controls to match
// Called whenever the page changes (prev/next click) or data is refreshed
function renderMainRequestsPage() {
  const totalPages = getTotalRequestPages();

  // Clamp currentRequestsPage within valid bounds in case data changed
  if (currentRequestsPage > totalPages) currentRequestsPage = totalPages;
  if (currentRequestsPage < 1) currentRequestsPage = 1;

  // Calculate which items to show on this page
  // e.g. page 2 with 3 per page: start=3, end=6, shows items [3,4,5]
  const start = (currentRequestsPage - 1) * REQUESTS_PER_PAGE;
  const end = start + REQUESTS_PER_PAGE;
  const pageItems = allRequests.slice(start, end); // Slice the array to current page

  renderRequestsBoard(pageItems, requestsBoard); // Render only this page's cards
  renderRequestsPaginationStatus();              // Update prev/next buttons and page label
  setRequestsPaginationVisibility(allRequests.length > REQUESTS_PER_PAGE); // Show/hide pagination bar
}

// ─── REQUESTS BOARD RENDERING ─────────────────────────────────────────────────

// Takes an array of request objects and generates HTML cards for each one
// then injects them all into the target board element
// Each card shows: occasion heading, subject + tone metadata, detail text,
// total price, and a bid form with an amount input and Apply button
// The bid form stores data-request-id and data-minimum-amount as attributes
// so the bid submit handler can read them without searching the DOM again
// Targets: <div id="requests-board"> or <div id="poet-modal-requests-board">
function renderRequestsBoard(items, targetBoard) {
  if (!targetBoard) return; // Safety check

  // If there are no requests yet, show a friendly empty state message
  if (!items.length) {
    targetBoard.innerHTML = '<div class="request-empty">No requests yet.</div>';
    return;
  }

  // Map each request object to an HTML string, join them, and set as innerHTML
  // Using template literals (backtick strings) to embed variables directly in HTML
  targetBoard.innerHTML = items.map((item) => {
    return `
      <article class="request-card">

        <!-- The occasion is the card heading — e.g. "Wedding", "Birthday" -->
        <h3>${escapeHtml(item.occasion || 'Occasion')}</h3>

        <!-- Subject (who the poem is for) and tone shown as small metadata text -->
        <div class="request-meta">
          For ${escapeHtml(item.subject || 'someone')} · ${escapeHtml(item.tone || 'warm')} tone
        </div>

        <!-- The key memory or detail the client wants included in the poem -->
        <div class="request-detail">
          ${escapeHtml(item.detail || 'No detail provided.')}
        </div>

     

        <!-- The bid form — poets fill in an amount and click Apply
             data-request-id: used by the submit handler to know which request to bid on
             data-minimum-amount: used to validate the amount is high enough -->
        <form
          class="bid-form"
          data-request-id="${Number(item.id || 0)}"
          data-minimum-amount="${Number(item.totalPrice || item.budget || 0)}"
        >
          <!-- Amount input — min is set to the request's total price
               so poets cannot bid lower than the client's budget -->
          <input
            class="bid-input"
            name="amount"
            type="number"
            min="${Number(item.totalPrice || item.budget || 0)}"
            step="1"
            value="${Number(item.totalPrice || item.budget || 0)}"
            required
          >
          <button class="btn-small" type="submit">Apply</button>
        </form>
      </article>
    `;
  }).join(''); // join('') removes the commas between array items
}

// ─── FETCH AND LOAD REQUESTS ──────────────────────────────────────────────────

// Fetches all requests from GET /api/requests and renders them into targetBoard
// If loading the main board: stores results in allRequests and uses pagination
// If loading the poet modal board: renders all items directly without pagination
// Shows a loading message first, then replaces it with cards or an error message
async function loadRequestsBoard(targetBoard) {
  if (!targetBoard) return;
  setRequestsBoardLoading(targetBoard); // Show "Loading…" while fetching

  try {
    const payload = await apiRequest('/requests'); // GET /api/requests
    // payload.requests is an array of request objects from Flask
    const items = Array.isArray(payload.requests) ? payload.requests : [];

    if (targetBoard === requestsBoard) {
      // Main board — store all items and render the current page with pagination
      allRequests = items;
      renderMainRequestsPage();
    } else {
      // Poet modal board — render all items directly, no pagination needed
      renderRequestsBoard(items, targetBoard);
    }
  } catch (error) {
    // If fetch fails (network error or backend down), show error message
    targetBoard.innerHTML = '<div class="request-empty">Requests unavailable.</div>';
    if (targetBoard === requestsBoard) {
      // Reset state so pagination doesn't show stale numbers
      allRequests = [];
      currentRequestsPage = 1;
      renderRequestsPaginationStatus();
      setRequestsPaginationVisibility(false);
    }
  }
}

// Reloads both boards at the same time using Promise.all
// Promise.all means both fetch calls run in parallel instead of one after the other
// so the total wait time is the duration of the slowest one, not both added together
async function refreshAllRequestBoards() {
  await Promise.all([
    loadRequestsBoard(requestsBoard),
    loadRequestsBoard(poetModalRequestsBoard)
  ]);
}

// ─── REFRESH WITH LOADING INDICATOR ──────────────────────────────────────────

// Returns a Promise that resolves after a given number of milliseconds
// Used to ensure the refresh animation runs for at least REFRESH_MIN_DURATION_MS
// so it doesn't flash and disappear if the server responds very quickly
function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// Called when the Refresh button (data-action="refresh-requests") is clicked
// Shows "Refreshing" on the button, reloads all boards, waits for the minimum
// animation duration, then restores the button to its original state
// The dataset.loading check prevents the user from clicking Refresh multiple
// times in a row before the first refresh has finished
async function refreshRequestsWithIndicator(triggerEl) {
  const button = triggerEl instanceof HTMLElement ? triggerEl : null;
  if (button?.dataset.loading === 'true') return; // Already refreshing — ignore the click

  const startedAt = Date.now(); // Record when the refresh started

  if (button) {
    button.dataset.loading = 'true';  // Mark as loading to block double-clicks
    button.classList.add('is-loading');
    button.disabled = true;
    button.dataset.originalLabel = button.textContent || 'Refresh'; // Save original text
    button.textContent = 'Refreshing'; // Show loading text
  }

  try {
    await refreshAllRequestBoards(); // Do the actual data fetch

    // If the fetch finished faster than the minimum duration,
    // wait for the remaining time so the animation doesn't flash
    const elapsed = Date.now() - startedAt;
    if (elapsed < REFRESH_MIN_DURATION_MS) {
      await delay(REFRESH_MIN_DURATION_MS - elapsed);
    }
  } finally {
    // This runs whether the fetch succeeded or failed
    // Always restores the button so the user can try again
    if (button) {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.textContent = button.dataset.originalLabel || 'Refresh'; // Restore original text
      delete button.dataset.originalLabel;
      delete button.dataset.loading; // Remove loading flag so next click works
    }
  }
}

// ─── ACTION LINKS CLICK HANDLER ───────────────────────────────────────────────

// Loops over every element with a data-action attribute and attaches a click listener
// When clicked, reads the data-action value and runs the appropriate function
// event.preventDefault() stops anchor tags from navigating to "#" and jumping to top
actionLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault(); // Stops the browser default behaviour for links and buttons
    const action = link.getAttribute('data-action'); // Reads which action to perform

    // Hero button: <a class="btn-primary" data-action="open-request">Request a poem</a>
    // Opens the poem request modal overlay
    if (action === 'open-request') {
      if (requestModal) openModal(requestModal);
    }

    // Hero button: <a class="btn-outline" data-action="open-poet">Become a poet</a>
    // Opens the poet registration modal and loads open requests into it
    // so poets can see what requests are available before signing up
    if (action === 'open-poet') {
      if (poetModal) openModal(poetModal);
      loadRequestsBoard(poetModalRequestsBoard); // Populates <div id="poet-modal-requests-board">
    }

    // Nav link: <a data-action="open-portfolio">For poets</a>
    // Opens the portfolio snapshot modal
    if (action === 'open-portfolio') {
      if (portfolioModal) openModal(portfolioModal);
    }

    // Nav link: <a data-action="scroll-how">How it works</a>
    // Smoothly scrolls down to <section id="how-it-works">
    if (action === 'scroll-how') scrollToSection('how-it-works');

    // Nav link: <a data-action="scroll-poets">Poets reviews</a>
    // Smoothly scrolls down to <section id="poets">
    if (action === 'scroll-poets') scrollToSection('poets');

    // Nav link: <a href="#poet-requests" data-action="scroll-requests">Requests board</a>
    // Smoothly scrolls down to <section id="poet-requests">
    if (action === 'scroll-requests') scrollToSection('poet-requests');

    // Refresh button: <button data-action="refresh-requests">Refresh</button>
    // Reloads both request boards with a loading animation on the button
    if (action === 'refresh-requests') refreshRequestsWithIndicator(link);

    // Pagination: <button data-action="requests-prev">Previous</button>
    // Goes to the previous page of requests if not already on page 1
    if (action === 'requests-prev') {
      if (currentRequestsPage > 1) {
        currentRequestsPage--;         // Decrement the page counter
        renderMainRequestsPage();      // Re-render with the new page
      }
    }

    // Pagination: <button data-action="requests-next">Next</button>
    // Goes to the next page of requests if not already on the last page
    if (action === 'requests-next') {
      const totalPages = getTotalRequestPages();
      if (currentRequestsPage < totalPages) {
        currentRequestsPage++;         // Increment the page counter
        renderMainRequestsPage();      // Re-render with the new page
      }
    }
  });
});

// ─── CLOSE BUTTONS ────────────────────────────────────────────────────────────

// Loops over every element with a data-close attribute and attaches a click listener
// Reads the data-close value to find which modal to close by its id
// e.g. <button data-close="request-modal"> finds and closes <div id="request-modal">
closeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetId = button.getAttribute('data-close'); // The id of the modal to close
    const target = document.getElementById(targetId);   // Find the modal element
    if (target) closeModal(target);                     // Close it if found
  });
});

// ─── CLICK OUTSIDE TO CLOSE ───────────────────────────────────────────────────

// Adds a click listener to each modal overlay div
// When the user clicks, checks if they clicked the overlay itself (the dark background)
// rather than the white modal box inside it
// event.target is the exact element that was clicked
// event.target === modal means they clicked the dark overlay, not the content inside
// .filter(Boolean) removes any null values from the array in case a modal
// doesn't exist on the current page, preventing a crash
[requestModal, poetModal, portfolioModal].filter(Boolean).forEach((modal) => {
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal(modal); // Only close if clicking the backdrop
  });
});

// ─── BID FORM SUBMIT HANDLER ─────────────────────────────────────────────────

// Listens for any form submission anywhere on the page using event delegation
// Instead of attaching listeners to each bid form individually (which wouldn't work
// since they are dynamically generated), we listen on the document and check
// if the submitted form has the class bid-form
// If it does, we handle it — if not, we return early and let other handlers take over
document.addEventListener('submit', async (event) => {
  const form = event.target.closest('.bid-form'); // Checks if submitted form is a bid form
  if (!form) return; // Not a bid form — exit and let other submit handlers run
  event.preventDefault(); // Stops the browser from doing a full page form submission

  // currentPoet is null until the poet registers via the poet form
  // If null, the poet hasn't registered yet so we can't submit a bid
  // We open the poet modal to prompt them to register first
  if (!currentPoet?.id) {
    showToast('Register as a poet first, then apply to requests.');
    if (poetModal) openModal(poetModal); // Opens <div id="poet-modal">
    return;
  }

  // Reads which request this bid is for from the form's data attributes
  // These were set when the card was rendered in renderRequestsBoard()
  const requestId = Number(form.getAttribute('data-request-id') || 0);
  const minimumAmount = Number(form.getAttribute('data-minimum-amount') || 0);

  // Reads the amount the poet entered in <input name="amount">
  const formData = new FormData(form);
  const amount = Number(formData.get('amount') || 0);

  // Client-side validation — the backend also validates this
  // but checking here gives instant feedback without a round trip to the server
  if (amount < minimumAmount) {
    showToast(`Amount must be €${minimumAmount} or more.`);
    return;
  }

  try {
    // Sends the bid to Flask: POST /api/requests/:requestId/bids
    // poetId comes from currentPoet which was set when the poet registered
    // Without poetId the backend returns "Poet ID is required" and rejects the bid
    await apiRequest(`/requests/${requestId}/bids`, {
      method: 'POST',
      body: JSON.stringify({
        poetId: currentPoet.id, // The database id returned when the poet registered
        amount                  // The amount the poet wants to charge
      })
    });
    showToast(`Applied successfully for €${amount}.`);
    await refreshAllRequestBoards(); // Reloads boards so the updated bid count appears
  } catch (error) {
    // Shows the error message from the backend (e.g. "Bid must be at least €30")
    showToast(error.message || 'Could not submit application.');
  }
});

// ─── REQUEST FORM SUBMIT HANDLER ─────────────────────────────────────────────

// Handles the poem request form submission inside request-modal
// Reads all field values, sends them to the backend, then resets the form
// and closes the modal so the user can see the updated requests board
// Wrapped in if (requestForm) because on the /request page this form exists
// but on the homepage it might not — the guard prevents a crash
if (requestForm) {
  requestForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Stops default browser form submission (page reload)
    const formData = new FormData(requestForm); // Reads all named inputs at once

    // Reads each field by its name attribute from the form
    const occasion = String(formData.get('occasion') || '').trim(); // <input name="occasion">
    const tone = String(formData.get('tone') || 'warm');             // <select name="tone">
    const subject = String(formData.get('subject') || '').trim();   // <input name="subject">
    const detail = String(formData.get('detail') || '').trim();     // <textarea name="detail">
    const budget = Math.max(5, Number(formData.get('budget') || 5)); // <input name="budget"> — minimum €5

    try {
      // Sends the new poem request to Flask: POST /api/requests
      // Flask validates the fields and saves to the database
      await apiRequest('/requests', {
        method: 'POST',
        body: JSON.stringify({ occasion, tone, subject, detail, budget })
      });
    } catch (error) {
      // If the backend is down or validation fails, show the error
      // but still continue so the form resets and closes
      showToast(`${error.message} Saved in preview only.`);
    }

    showToast('Poem request submitted.');        // Confirms success to the user
    requestForm.reset();                         // Clears all form fields back to defaults
    if (requestModal) closeModal(requestModal);  // Closes <div id="request-modal">
    await refreshAllRequestBoards();             // Reloads both boards so new request appears
  });
}

// ─── POET FORM SUBMIT HANDLER ─────────────────────────────────────────────────

// Handles the poet registration form submission inside poet-modal
// Posts the poet's details to the backend and saves the returned poet id
// into currentPoet — this id is essential because it gets sent with every bid
// Without saving the id here, Apply buttons would always fail with "Poet ID required"
// Wrapped in if (poetForm) as a safety check in case the element doesn't exist
if (poetForm) {
  poetForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Stops default form submission
    const formData = new FormData(poetForm); // Reads all named inputs at once

    // Reads each field by its name attribute
    const name = String(formData.get('name') || '').trim();           // <input name="name">
    const specialty = String(formData.get('specialty') || '').trim(); // <input name="specialty">
    const sample = String(formData.get('sample') || '').trim();       // <textarea name="sample">
    const rate = Math.max(10, Number(formData.get('rate') || 35));    // <input name="rate"> — minimum €10

    // These will be set from the backend response
    // backendPoetId is the database-assigned id — different from a local counter
    let backendPoetId = null;
    let backendRate = rate;

    try {
      // Sends the poet application to Flask: POST /api/poets
      // Flask validates, saves to database, and returns the new poet's id
      const payload = await apiRequest('/poets', {
        method: 'POST',
        body: JSON.stringify({ name, specialty, sample, rate })
      });

      // Extracts the id and rate from the backend response
      // payload.poet is the poet object Flask returned with the database-assigned id
      if (payload.poet) {
        backendPoetId = Number(payload.poet.id || 0);   // The real database id
        backendRate = Number(payload.poet.rate || rate); // The rate Flask confirmed
      }
    } catch (error) {
      // If registration fails, show the error — currentPoet will have id: null
      // which means bid submissions will still be blocked until they register successfully
      showToast(`${error.message} Application kept in preview only.`);
    }

    // Save the poet to the in-memory state — this is what unlocks bidding
    // currentPoet.id is sent as poetId in every bid request body
    currentPoet = { id: backendPoetId, name, specialty };

    showToast('Poet registered. You can now apply to requests.');
    poetForm.reset();                // Clears all poet form fields
    await refreshAllRequestBoards(); // Reloads boards so poet can see current requests
  });
}

// ─── ESCAPE KEY HANDLER ───────────────────────────────────────────────────────

// Listens for the Escape key anywhere on the page
// Closes whichever modal is currently visible
// Checks each modal individually because only one should be open at a time
// The null checks (portfolioModal &&) prevent crashes if a modal doesn't
// exist on the current page
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return; // Ignore all keys except Escape
  if (portfolioModal && !portfolioModal.classList.contains('hidden')) closeModal(portfolioModal);
  if (requestModal && !requestModal.classList.contains('hidden')) closeModal(requestModal);
  if (poetModal && !poetModal.classList.contains('hidden')) closeModal(poetModal);
});

// ─── STARTUP ──────────────────────────────────────────────────────────────────

// Hides the pagination bar immediately on page load
// It will be shown automatically by renderMainRequestsPage() once
// there are more than REQUESTS_PER_PAGE requests loaded from the backend
setRequestsPaginationVisibility(false);

// Fetches all requests from the backend and renders them into both boards
// This is what populates the page with data when it first loads
refreshAllRequestBoards();
