# EduDesk: school management demo (plain HTML, CSS, JavaScript)

Double-click `index.html`. No server, no build. Everything is saved in the browser (localStorage).

## Logins
| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@edudesk.pk | admin123 |
| Teacher | teacher@edudesk.pk | teacher123 (also ayesha@ and sana@edudesk.pk) |

"Reset demo data" is on the login page and in Admin > Backup.

## Earlier changes
- Attendance is now **subject by subject**. A teacher marks only the subjects they teach. If another subject was already marked for the class that day, the list is pre-filled from it ("Filled from English by Ayesha at 08:30"); change what differs and Save.
- Class teachers (and the admin) get a read-only **All subjects** summary of the class.
- Old whole-day attendance is kept as the subject **General** (automatic upgrade, nothing is lost).
- Classes > Subjects and teachers: set every subject of a class and its teacher on one screen.
- Students have a **batch** (admission session, New or Old), **father CNIC** (required) and **B-form** (optional). Search by name, CNIC, B-form or roll no.
- Teachers can edit their own profile only if the admin allows it for that teacher.
- New admin page **WhatsApp connection** (QR flow is a demo until the backend exists) with profile, signature, country code and delay settings.
- Message variables are defined: each type shows only the variables that work in it, and wrong ones are blocked.
- Full phone layout: tables become cards, dialogs become bottom sheets, timetable shows one day at a time. Sidebar scrollbar is hidden.

## What changed in this version (batches, papers, money flow)
- **Batches and enrollments.** A batch is a school year (2025, 2026 ...). Every row in Students is one child in one batch and one class. The same child in two batches has two rows linked by `personId`, so 9th in 2025 and 10th in 2026 are both kept, with their own attendance, results and fees.
- **Dynamic batches and classes.** Type a batch (and a class like 10-A) when adding a student. An existing one is matched, a new name creates it. A same-year spelling (2027-28 vs 2027) asks first.
- **Add student looks the child up** by B-form (exact) or father CNIC (siblings list). A known child is auto-filled and the button becomes "Add to new batch". Edit changes personal details for every batch; class and roll only for that batch.
- **Admin picks a batch inside the tables** (students, classes, assignments, attendance, reports, results, fees, analytics). **Teachers** only ever see the current batch, their assigned classes and subjects.
- **Settings > Batches > Start new batch** copies classes, teacher assignments and fee heads, and can make the new batch current.
- **Remove or delete** a student goes to **Restore deleted** (a recycle bin) with all attendance, marks, fees and papers; restore brings everything back.
- **Student papers** (Results > exam > Student papers): upload each student's paper pages (saved at once, stored in IndexedDB), or use "Upload one after another" which saves and moves to the next student automatically. Each paper has a private parent link (`paper.html?t=...`), a downloadable file for WhatsApp, a teacher remark, and a switch to turn the link off.
- **Money flow** (Analytics > Money flow, plus a small card on the dashboard): month filter, money in and out, a flow diagram, fees by class, method and student, every transaction, and the last 6 months.

## Admin pages
Dashboard, Classes and subjects, Assignments, Timetable, Students, Teachers, Attendance (students and teachers),
Attendance reports (daily, monthly, defaulters, single student), Results (exams, marks, photo upload, verify, publish, report cards),
Grading, Fees (structure, invoices, payments, receipts, defaulters), Salary (attendance deductions, advances, slips),
Expenses (editable categories, receipts, reports), Analytics, Announcements, WhatsApp history and templates,
Settings (school, batches, holidays, teacher permissions, rules), Audit log, Restore deleted, Backup and restore.

## Teacher pages
Dashboard, Students (own classes; add/edit only if admin allows), Attendance (own classes, today only),
Marks entry, Upload result photos, Analytics, Announcements.

## What is real and what is demo
| Feature | Now | After backend |
| --- | --- | --- |
| Data | localStorage in this browser | database and API (replace `js/core/storage.js`) |
| Login | local accounts, simple hash | real auth (replace `js/core/auth.js`) |
| WhatsApp to parents | message is queued in history; "Open in WhatsApp" opens wa.me with the text ready | WhatsApp API (replace `ED.wa.send` in `js/core/wa.js`) |
| Parent paper link | `paper.html?t=...` works in this browser only | the same token served by the backend, works on any phone |
| Photo to marks | upload, side-by-side review, confidence highlight all work; extraction values are simulated | real OCR (replace `ED.ocr.extract` in `js/core/ocr.js`) |
| Printing | browser print dialog (save as PDF there) | same |

## Shortcuts
Ctrl+B toggles the sidebar, `/` focuses search, Esc closes menus, drawer and dialogs.

## Code rules
- Colours, radius and shadows come from `css/tokens.css` only (light and dark).
- Pages talk to `ED.storage`, never to localStorage directly.
- New protected page: copy any file from `admin/`, change `data-active` and `data-page`, add `js/pages/<name>.js`, add the menu item in `js/core/shell.js`.
- Escape user text with `ED.fmt.esc()` before using `innerHTML`.

## Structure
```
index.html                 login
admin/*.html  teacher/*.html   one small HTML shell per page
css/                       tokens, base, layout, components, pages
js/core/                   storage, format, icons, theme, auth, ui, components (table, form, tabs, print),
                           charts, data, seed, wa, ocr, shell, load
js/pages/                  one script per page (students.js, results.js, fees.js ...)
```
