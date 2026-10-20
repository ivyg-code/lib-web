/* OmniCampus Library - Student/Account UI Logic
   Fix for missing script (1).js referenced by index.html.
   This implements the functions referenced in index.html so the app works.
*/

// -----------------------------
// Helpers
// -----------------------------
function $(id) {
  return document.getElementById(id);
}

function safeParseJSON(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function todayISO() {
  return new Date().toISOString();
}

function daysBetween(aDate, bDate) {
  const ms = bDate.getTime() - aDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function formatKsh(amount) {
  const n = Number(amount) || 0;
  return `KSh ${n}`;
}

// -----------------------------
// App State / Seed Data
// -----------------------------
function getSession() {
  return safeParseJSON(localStorage.getItem('current_student'), null);
}

function requireStudentOrRedirect() {
  const session = getSession();
  if (!session) {
    // show login section
    showSection('Student Login');
    return null;
  }
  return session;
}

function seedBooksIfEmpty() {
  const existing = safeParseJSON(localStorage.getItem('library_books'), null);
  if (existing && Array.isArray(existing) && existing.length) return;

  const now = new Date();
  const books = [
    { id: 'b1', title: 'Clean Code', author: 'Robert C. Martin', isbn: '9780132350884', category: 'Programming', availability: true },
    { id: 'b2', title: 'JavaScript: The Good Parts', author: 'Douglas Crockford', isbn: '9780596517748', category: 'Programming', availability: true },
    { id: 'b3', title: 'Design Patterns', author: 'GoF', isbn: '9780201633610', category: 'Software Engineering', availability: true },
    { id: 'b4', title: 'Introduction to Algorithms', author: 'Cormen', isbn: '9780262033848', category: 'Algorithms', availability: true }
  ];

  localStorage.setItem('library_books', JSON.stringify(books));

  // Requests / Loans / History seeds
  if (!localStorage.getItem('library_requests')) localStorage.setItem('library_requests', JSON.stringify([]));
  if (!localStorage.getItem('library_loans')) localStorage.setItem('library_loans', JSON.stringify([]));

  // Set category filter options later from books
}

seedBooksIfEmpty();

// -----------------------------
// Navigation / Section visibility
// -----------------------------
function showSection(sectionId) {
  const sections = document.querySelectorAll('.content-section');
  sections.forEach(s => {
    if (s.id === sectionId) s.classList.add('active');
    else s.classList.remove('active');
  });

  // Active state on sidebar (best-effort)
  const items = document.querySelectorAll('#navMenu li');
  items.forEach(li => {
    const text = li.textContent || '';
    if (text.includes(sectionId.replace(' & ', ' '))) {
      items.forEach(x => x.classList.remove('active'));
      li.classList.add('active');
    }
  });

  // Load dynamic content for particular sections
  if (sectionId === 'View Books') {
    loadBooksUI();
  } else if (sectionId === 'Book Request') {
    loadRequestsUI();
  } else if (sectionId === 'My Issued Books') {
    loadIssuedUI();
  } else if (sectionId === 'Borrowing History') {
    loadBorrowingHistoryUI();
  } else if (sectionId === 'Profile Management') {
    loadProfileUI();
  }
}

function logout() {
  localStorage.removeItem('current_student');
  localStorage.removeItem('current_admin');
  // reset default UI
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  showSection('Student Login');
}

// -----------------------------
// Registration / Login (Student)
// -----------------------------
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleStudentRegistration(event) {
  event.preventDefault();

  const statusDiv = $('registrationStatus');
  const firstName = $('regFirstName').value.trim();
  const lastName = $('regLastName').value.trim();
  const email = $('regEmail').value.trim();
  const studentId = $('regStudentId').value.trim();
  const phone = $('regPhone').value.trim();
  const password = $('regPassword').value;
  const confirmPassword = $('regConfirmPassword').value;

  if (password !== confirmPassword) {
    statusDiv.innerHTML = '<p><i class="fas fa-exclamation-circle"></i> Passwords do not match</p>';
    statusDiv.className = 'registration-status show error';
    return false;
  }
  if (password.length < 6) {
    statusDiv.innerHTML = '<p><i class="fas fa-exclamation-circle"></i> Password must be at least 6 characters</p>';
    statusDiv.className = 'registration-status show error';
    return false;
  }

  const students = safeParseJSON(localStorage.getItem('library_students'), []) || [];
  const existing = students.find(s => s.studentId === studentId || s.email === email);
  if (existing) {
    statusDiv.innerHTML = '<p><i class="fas fa-exclamation-circle"></i> Account already exists with this Student ID or Email</p>';
    statusDiv.className = 'registration-status show error';
    return false;
  }

  const passwordHash = await hashPassword(password);
  const newStudent = {
    id: Date.now(),
    studentId,
    firstName,
    lastName,
    email,
    phone,
    passwordHash,
    registrationDate: todayISO()
  };

  students.push(newStudent);
  localStorage.setItem('library_students', JSON.stringify(students));
  localStorage.setItem('current_student', JSON.stringify({
    id: newStudent.id,
    studentId: newStudent.studentId,
    firstName: newStudent.firstName,
    lastName: newStudent.lastName,
    email: newStudent.email,
    role: 'student'
  }));

  statusDiv.innerHTML = '<p><i class="fas fa-check-circle"></i> Registration successful! Redirecting…</p>';
  statusDiv.className = 'registration-status show success';

  setTimeout(() => {
    initAppAfterLogin();
    showSection('My Account');
  }, 600);

  return false;
}

async function handleStudentLogin(event) {
  event.preventDefault();

  const statusDiv = $('studentLoginStatus');
  const userId = $('studentId').value.trim();
  const password = $('studentPassword').value;

  const students = safeParseJSON(localStorage.getItem('library_students'), []) || [];
  const student = students.find(s => s.studentId === userId || s.email === userId);

  if (!student) {
    statusDiv.innerHTML = '<p><i class="fas fa-exclamation-circle"></i> No account found</p>';
    statusDiv.className = 'login-status show error';
    return false;
  }

  const inputHash = await hashPassword(password);
  if (inputHash !== student.passwordHash) {
    statusDiv.innerHTML = '<p><i class="fas fa-exclamation-circle"></i> Incorrect password</p>';
    statusDiv.className = 'login-status show error';
    return false;
  }

  localStorage.setItem('current_student', JSON.stringify({
    id: student.id,
    studentId: student.studentId,
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    role: 'student'
  }));

  statusDiv.innerHTML = '<p><i class="fas fa-check-circle"></i> Login successful! Redirecting…</p>';
  statusDiv.className = 'login-status show success';

  setTimeout(() => {
    initAppAfterLogin();
    showSection('My Account');
  }, 600);

  return false;
}

// -----------------------------
// Books browsing & filtering
// -----------------------------
function loadBooksToGrid(books) {
  const grid = $('booksGrid');
  const noBooks = $('noBooksMessage');

  if (!grid) return;

  grid.innerHTML = '';

  if (!books.length) {
    noBooks.style.display = 'block';
    return;
  }

  noBooks.style.display = 'none';

  books.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';

    const avail = book.availability ? 'available' : 'unavailable';
    const availText = book.availability ? 'Available' : 'Unavailable';

    card.innerHTML = `
      <div class="book-cover"><i class="fas fa-book"></i></div>
      <div class="book-info">
        <h3>${escapeHtml(book.title)}</h3>
        <div class="author">Author: ${escapeHtml(book.author)}</div>
        <div class="category">Category: ${escapeHtml(book.category || '-') }</div>
        <div class="isbn">ISBN: ${escapeHtml(book.isbn || '-') }</div>
        <div class="book-availability">
          <span class="availability ${avail}"><i class="fas fa-circle"></i> ${availText}</span>
        </div>
        <button class="btn-request" ${book.availability ? '' : 'disabled'} onclick="requestBook('${book.id}')">
          <i class="fas fa-paper-plane"></i> ${book.availability ? 'Request / Borrow' : 'Currently Unavailable'}
        </button>
      </div>
    `;

    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

function getAllBooks() {
  return safeParseJSON(localStorage.getItem('library_books'), []) || [];
}

function getBooksFiltered() {
  const q = ($('bookSearchInput')?.value || '').toLowerCase().trim();
  const category = $('categoryFilter')?.value || '';

  let books = getAllBooks();

  if (category) {
    books = books.filter(b => (b.category || '') === category);
  }

  if (q) {
    books = books.filter(b => {
      const hay = `${b.title} ${b.author} ${b.isbn} ${b.category}`.toLowerCase();
      return hay.includes(q);
    });
  }

  return books;
}

function loadCategoriesIntoFilter() {
  const select = $('categoryFilter');
  if (!select) return;

  const books = getAllBooks();
  const categories = Array.from(new Set(books.map(b => b.category).filter(Boolean)));

  // Keep first option
  select.innerHTML = '<option value="">All Categories</option>';
  categories.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    select.appendChild(opt);
  });
}

function loadBooksUI() {
  loadCategoriesIntoFilter();
  loadBooksToGrid(getBooksFiltered());
}

function searchBooks() {
  loadBooksUI();
}

function filterBooksByCategory() {
  loadBooksUI();
}

// -----------------------------
// Requests
// -----------------------------
function requestBook(bookId) {
  const session = requireStudentOrRedirect();
  if (!session) return;

  const books = getAllBooks();
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  const requests = safeParseJSON(localStorage.getItem('library_requests'), []) || [];

  // prevent duplicate active request
  const existing = requests.find(r => r.studentId === session.studentId && r.bookId === bookId && r.status === 'Pending');
  if (existing) return;

  const request = {
    id: `r_${Date.now()}`,
    studentId: session.studentId,
    bookId: book.id,
    bookTitle: book.title,
    author: book.author,
    date: todayISO(),
    status: 'Pending'
  };

  requests.push(request);
  localStorage.setItem('library_requests', JSON.stringify(requests));

  // If available, auto-approve and create a loan.
  if (book.availability) {
    request.status = 'Approved';
    // mark book unavailable
    const idx = books.findIndex(b => b.id === book.id);
    if (idx !== -1) {
      books[idx].availability = false;
      localStorage.setItem('library_books', JSON.stringify(books));
    }
    // create loan
    const loans = safeParseJSON(localStorage.getItem('library_loans'), []) || [];
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 14);

    loans.push({
      id: `l_${Date.now()}`,
      studentId: session.studentId,
      bookId: book.id,
      bookTitle: book.title,
      author: book.author,
      issueDate: issueDate.toISOString(),
      dueDate: dueDate.toISOString(),
      returnDate: null,
      status: 'Issued'
    });

    localStorage.setItem('library_loans', JSON.stringify(loans));
  }

  localStorage.setItem('library_requests', JSON.stringify(requests));

  loadRequestsUI();
  loadIssuedUI();
}

function loadRequestsUI() {
  const session = requireStudentOrRedirect();
  if (!session) return;

  const tbody = $('myRequestsTableBody');
  const noBooks = $('myRequestsTable');
  if (!tbody) return;

  const requests = safeParseJSON(localStorage.getItem('library_requests'), []) || [];
  const mine = requests.filter(r => r.studentId === session.studentId);

  tbody.innerHTML = '';
  mine.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.id)}</td>
      <td>${escapeHtml(r.bookTitle || '')}</td>
      <td>${escapeHtml(r.author || '')}</td>
      <td>${escapeHtml(new Date(r.date).toLocaleDateString())}</td>
      <td>${escapeHtml(r.status)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -----------------------------
// Issued books / history
// -----------------------------
function computeFine(dueDateISO) {
  const due = new Date(dueDateISO);
  const now = new Date();
  const daysLate = Math.max(0, daysBetween(due, now));
  const finePerDay = 20; // simple fixed fine
  return daysLate * finePerDay;
}

function loadIssuedUI() {
  const session = requireStudentOrRedirect();
  if (!session) return;

  const tbody = $('myIssuedBooksTableBody');
  if (!tbody) return;

  const loans = safeParseJSON(localStorage.getItem('library_loans'), []) || [];
  const mine = loans.filter(l => l.studentId === session.studentId && l.status === 'Issued');

  tbody.innerHTML = '';

  const currentlyIssued = mine.length;
  let dueSoon = 0;
  let overdue = 0;
  let totalFine = 0;

  mine.forEach(l => {
    const due = new Date(l.dueDate);
    const now = new Date();
    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const fine = computeFine(l.dueDate);
    totalFine += fine;

    if (daysLeft <= 5 && daysLeft >= 0) dueSoon++;
    if (daysLeft < 0) overdue++;

    const status = daysLeft < 0 ? 'Overdue' : (daysLeft <= 5 ? 'Due Soon' : 'Issued');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(l.bookTitle)}</td>
      <td>${escapeHtml(new Date(l.issueDate).toLocaleDateString())}</td>
      <td>${escapeHtml(new Date(l.dueDate).toLocaleDateString())}</td>
      <td>${escapeHtml(daysLeft)}</td>
      <td>${escapeHtml(formatKsh(fine))}</td>
      <td>${escapeHtml(status)}</td>
    `;
    tbody.appendChild(tr);
  });

  $('currentlyIssued').textContent = String(currentlyIssued);
  $('dueSoon').textContent = String(dueSoon);
  $('overdueBooks').textContent = String(overdue);
  $('currentFines').textContent = formatKsh(totalFine);

  const noIssued = $('noIssuedMessage');
  if (noIssued) noIssued.style.display = mine.length ? 'none' : 'block';
}

function loadBorrowingHistoryUI() {
  const session = requireStudentOrRedirect();
  if (!session) return;

  const tbody = $('borrowingHistoryTableBody');
  if (!tbody) return;

  const loans = safeParseJSON(localStorage.getItem('library_loans'), []) || [];
  const mine = loans.filter(l => l.studentId === session.studentId);

  const summary = {
    totalBorrowed: mine.length,
    totalReturned: mine.filter(l => l.status === 'Returned').length,
    totalPending: mine.filter(l => l.status === 'Issued').length,
    totalOverdue: mine.filter(l => {
      if (l.status !== 'Issued') return false;
      const fine = computeFine(l.dueDate);
      return fine > 0;
    }).length
  };

  $('totalBorrowed').textContent = String(summary.totalBorrowed);
  $('totalReturned').textContent = String(summary.totalReturned);
  $('totalPending').textContent = String(summary.totalPending);
  $('totalOverdue').textContent = String(summary.totalOverdue);

  tbody.innerHTML = '';

  mine.forEach(l => {
    const due = new Date(l.dueDate);
    const now = new Date();
    const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const status = l.status === 'Returned'
      ? 'Returned'
      : (daysLeft < 0 ? 'Overdue' : 'Pending');

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(l.bookTitle)}</td>
      <td>${escapeHtml(l.author)}</td>
      <td>${escapeHtml(new Date(l.issueDate).toLocaleDateString())}</td>
      <td>${escapeHtml(l.returnDate ? new Date(l.returnDate).toLocaleDateString() : '-') }</td>
      <td>${escapeHtml(status)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// -----------------------------
// Profile / Password recovery
// -----------------------------
function loadProfileUI() {
  const session = requireStudentOrRedirect();
  if (!session) return;

  const students = safeParseJSON(localStorage.getItem('library_students'), []) || [];
  const student = students.find(s => s.studentId === session.studentId);

  if (!student) return;

  $('profileName').textContent = `${student.firstName} ${student.lastName}`.trim();
  $('profileStudentId').textContent = `Student ID: ${student.studentId}`;

  // If form exists, prefill
  if ($('profileFirstName')) $('profileFirstName').value = student.firstName || '';
  if ($('profileLastName')) $('profileLastName').value = student.lastName || '';
  if ($('profileEmail')) $('profileEmail').value = student.email || '';
  if ($('profilePhone')) $('profilePhone').value = student.phone || '';
}

function updateProfile(event) {
  event.preventDefault();

  const session = requireStudentOrRedirect();
  if (!session) return false;

  const statusDiv = $('profileStatus');
  const students = safeParseJSON(localStorage.getItem('library_students'), []) || [];
  const idx = students.findIndex(s => s.studentId === session.studentId);
  if (idx === -1) return false;

  students[idx].firstName = $('profileFirstName').value.trim();
  students[idx].lastName = $('profileLastName').value.trim();
  students[idx].email = $('profileEmail').value.trim();
  students[idx].phone = $('profilePhone').value.trim();

  localStorage.setItem('library_students', JSON.stringify(students));
  localStorage.setItem('current_student', JSON.stringify({
    ...getSession(),
    firstName: students[idx].firstName,
    lastName: students[idx].lastName,
    email: students[idx].email
  }));

  statusDiv.className = 'form-status show success';
  statusDiv.textContent = 'Profile updated successfully.';
  loadProfileUI();
  return false;
}

async function changePassword(event) {
  event.preventDefault();

  const session = requireStudentOrRedirect();
  if (!session) return false;

  const statusDiv = $('passwordChangeStatus');
  const currentPassword = $('currentPassword').value;
  const newPassword = $('newPassword').value;
  const confirmNewPassword = $('confirmNewPassword').value;

  if (newPassword !== confirmNewPassword) {
    statusDiv.className = 'form-status show error';
    statusDiv.textContent = 'New passwords do not match.';
    return false;
  }
  if (newPassword.length < 6) {
    statusDiv.className = 'form-status show error';
    statusDiv.textContent = 'New password must be at least 6 characters.';
    return false;
  }

  const students = safeParseJSON(localStorage.getItem('library_students'), []) || [];
  const student = students.find(s => s.studentId === session.studentId);
  if (!student) return false;

  const currentHash = await hashPassword(currentPassword);
  if (currentHash !== student.passwordHash) {
    statusDiv.className = 'form-status show error';
    statusDiv.textContent = 'Current password incorrect.';
    return false;
  }

  student.passwordHash = await hashPassword(newPassword);
  localStorage.setItem('library_students', JSON.stringify(students));

  statusDiv.className = 'form-status show success';
  statusDiv.textContent = 'Password changed successfully.';
  // Clear
  $('currentPassword').value = '';
  $('newPassword').value = '';
  $('confirmNewPassword').value = '';
  return false;
}

async function recoverPassword(event) {
  event.preventDefault();

  const statusDiv = $('recoveryStatus');
  const recoveryStudentId = $('recoveryStudentId').value.trim();
  const newPassword = $('recoveryNewPassword').value;
  const confirmNewPassword = $('recoveryConfirmPassword').value;

  if (newPassword !== confirmNewPassword) {
    statusDiv.className = 'recovery-status show error';
    statusDiv.textContent = 'New passwords do not match.';
    return false;
  }
  if (newPassword.length < 6) {
    statusDiv.className = 'recovery-status show error';
    statusDiv.textContent = 'New password must be at least 6 characters.';
    return false;
  }

  const students = safeParseJSON(localStorage.getItem('library_students'), []) || [];
  const student = students.find(s => s.studentId === recoveryStudentId || s.email === recoveryStudentId);
  if (!student) {
    statusDiv.className = 'recovery-status show error';
    statusDiv.textContent = 'No account found with that ID/email.';
    return false;
  }

  student.passwordHash = await hashPassword(newPassword);
  localStorage.setItem('library_students', JSON.stringify(students));

  statusDiv.className = 'recovery-status show success';
  statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Password reset successfully. Redirecting…';

  setTimeout(() => {
    showSection('Student Login');
  }, 800);

  return false;
}

// -----------------------------
// Feedback
// -----------------------------
function submitFeedback(event) {
  event.preventDefault();

  const statusDiv = $('feedbackStatus');
  const category = $('feedbackCategory').value;
  const message = $('feedbackMessage').value.trim();

  if (!category || !message) {
    statusDiv.className = 'form-status show error';
    statusDiv.textContent = 'Please fill in all fields.';
    return false;
  }

  const feedback = safeParseJSON(localStorage.getItem('library_feedback'), []) || [];
  feedback.push({
    id: `f_${Date.now()}`,
    studentId: getSession()?.studentId || null,
    category,
    message,
    date: todayISO()
  });
  localStorage.setItem('library_feedback', JSON.stringify(feedback));

  statusDiv.className = 'form-status show success';
  statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Feedback submitted. Thank you!';

  $('feedbackMessage').value = '';
  $('feedbackCategory').value = '';
  return false;
}

// -----------------------------
// Boot
// -----------------------------
function initAppAfterLogin() {
  const session = getSession();
  if (!session) return;

  // Show logged-in banner area
  const loggedInWelcome = $('loggedInWelcome');
  const welcomeBanner = $('welcomeBanner');
  if (loggedInWelcome) loggedInWelcome.style.display = 'block';
  if (welcomeBanner) welcomeBanner.style.display = 'none';

  // Fill student details if present
  const welcomeName = $('welcomeName');
  const welcomeStudentId = $('welcomeStudentId');
  const welcomeEmail = $('welcomeEmail');
  if (welcomeName) welcomeName.textContent = `Welcome, ${session.firstName || 'Student'}!`;
  if (welcomeStudentId) welcomeStudentId.textContent = `Student ID: ${session.studentId}`;
  if (welcomeEmail) welcomeEmail.textContent = session.email || 'email@example.com';

  // Fill stats
  loadIssuedUI();

  // Ensure some content is available for other sections
  loadRequestsUI();
  loadBooksUI();
  loadBorrowingHistoryUI();
}

document.addEventListener('DOMContentLoaded', () => {
  // Default visible section
  const hasSession = !!getSession();
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

  // Make sure categories are ready
  seedBooksIfEmpty();

  if (hasSession) {
    initAppAfterLogin();
    showSection('My Account');
  } else {
    // no session: default to login
    showSection('Student Login');
    const loggedInWelcome = $('loggedInWelcome');
    const welcomeBanner = $('welcomeBanner');
    if (loggedInWelcome) loggedInWelcome.style.display = 'none';
    if (welcomeBanner) welcomeBanner.style.display = 'block';
  }

  // If logged-in, show stats even on account
  if (hasSession) {
    loadIssuedUI();
  }
});

// -----------------------------
// Expose functions to window for inline HTML handlers
// -----------------------------
window.showSection = showSection;
window.logout = logout;
window.handleStudentRegistration = handleStudentRegistration;
window.handleStudentLogin = handleStudentLogin;
window.searchBooks = searchBooks;
window.filterBooksByCategory = filterBooksByCategory;
window.requestBook = requestBook;
window.updateProfile = updateProfile;
window.changePassword = changePassword;
window.recoverPassword = recoverPassword;
window.submitFeedback = submitFeedback;

