# IKETECH AUTO LTD ERP - what is built, what is partly built, what is still to do
Measured against your ERP specification. Updated 3 November 2026.

**Architecture decision:** the system uses Supabase (PostgreSQL, secure login, private file storage, row-level security) with a no-install web app, instead of React/Next.js with a separate API. Every rule is enforced inside the database, so it cannot be bypassed from the screen. This is already live and tested (190+ automated checks). Moving to React/TypeScript later is possible without changing the database.

Legend: DONE = built and tested. PARTLY = works but missing part of the spec. TODO = not built.

## 1. Dashboard design
| Item | Status |
|---|---|
| Mobile, tablet, desktop layouts | DONE |
| Branded look, dark mode | DONE (teal brand, not navy) |
| Charts, tables, filters, date range | DONE |
| Sidebar navigation, global search, notification centre, branch selector, profile menu | TODO (home tiles are used today) |

## 2. Executive dashboard KPIs
| KPI | Status |
|---|---|
| Cash collected, receivables, overdue receivables | DONE |
| Total revenue, gross profit, net profit, operating expenses | DONE (Profit and loss page; not yet on the dashboard) |
| Gross margin %, cash flow, revenue target vs actual | TODO (needs a targets table) |
| Vehicles in workshop, by stage, awaiting approval, under repair, awaiting QC, ready for collection | DONE |
| Jobs awaiting spare parts | DONE (stage added in file 18) |
| Average repair turnaround, jobs completed this month | PARTLY (turnaround per technician only) |
| Total, new and returning customers; customer growth chart | TODO |
| Customer satisfaction score, complaints, comeback/warranty rate | TODO |
| Technician: jobs assigned/completed, QC pass rate | DONE |
| Technician: billable hours, productivity, first-time fix rate | TODO (needs labour hour entries) |
| Charts: revenue vs collected, ageing, job status, top customers, spending, branches | DONE |
| Charts: revenue vs target, technician productivity, service category profitability, customer growth | TODO |

## 3. Modules
| Module | Status |
|---|---|
| Customer management | PARTLY: profiles, history, communication log done; credit limits TODO |
| Vehicle management | PARTLY: plate, make, model, year done; VIN fields in database, mileage on inspections; engine details and maintenance history view TODO |
| Workshop management | PARTLY: jobs, technician and advisor, status guards done; labour hour entry TODO |
| Diagnosis and inspection | DONE: checklist, evidence photos, supervisor review, reports. Fault code field TODO |
| Quotation and approval | DONE: lines, send, customer approval link, approval history, PDF link |
| Parts and procurement | PARTLY: parts, stock ledger, suppliers, purchase orders, goods received, costs done; purchase requests TODO |
| Quality control | DONE: checklist, pass/fail, rework tracking, release blocked until pass |
| Invoicing and payments | DONE: invoices, receipts, part payments, balances, reminders, PDF links |
| Customer vehicle tracking | DONE: customer progress page (estimated collection date TODO) |
| Human resources | PARTLY: payroll, advances, payslips done; attendance, training, performance reviews TODO |
| Reports and analytics | PARTLY: dashboards and P&L done; Excel/PDF report exports TODO |
| System administration | PARTLY: users and roles, settings, audit log in database done; audit log viewer screen and integrations screen TODO |

## 4. Job workflow
Customer registration > vehicle reception > inspection > diagnosis > quotation > approval > parts > repair > quality control > invoice > payment > collection > follow-up.
| Rule | Status |
|---|---|
| Unique job ID, customer, vehicle, advisor, technician, complaint | DONE |
| Unauthorised stage jumps blocked (approval, quality check, ready, collected) | DONE (file 18) |
| QC pass required before ready and release | DONE |
| Customer told at every stage; handover blocked until told | DONE |
| Extra chargeable work needs approval before invoicing | DONE (file 18: invoice above approved quotations needs a manager's written reason) |
| Follow-up after collection | DONE |
| Documented approval before *starting* extra work (variation quotation flow) | PARTLY: additional quotations can be made and approved; screen to add "additional work" to a job in progress TODO |

## 5. Financial intelligence
| Item | Status |
|---|---|
| NGN base currency, USD and other currencies with configurable rate, margin and history | DONE |
| Cash collection, receivables, ageing | DONE |
| Job-level cost and profit, parts margin | DONE |
| Overdue payment reminders | PARTLY: one-tap reminders done; automatic alerts need an email/WhatsApp service |
| VAT and other tax configuration on documents | TODO |
| Revenue recognition rules, period closing, reconciliation | TODO |

## 6. Security
| Item | Status |
|---|---|
| Roles enforced in the database (not only on screen) | DONE |
| CEO, manager, advisor, technician, accounting | DONE |
| Procurement officer and QC inspector as separate roles | TODO (today handled by supervisor/admin) |
| Technician sees only own jobs, no prices | DONE |
| Payroll visible only to CEO and those the CEO allows | DONE |
| Audit trail for changes | DONE (every change recorded; cannot be edited from the app) |

## 7. Technical
| Item | Status |
|---|---|
| PostgreSQL with relational integrity and migrations | DONE (numbered files 01-18) |
| Secure login and private photo storage | DONE |
| Automated tests | DONE (SQL rule tests and browser tests) |
| Email and WhatsApp integration | PARTLY: messages prepared and sent with one tap; automatic sending TODO (needs WhatsApp Business account and email service) |
| Backups and recovery | TODO (weekly export planned) |
| Sample data, deployment guide, integration roadmap | PARTLY: this document; sample data script TODO |

## Suggested order for what is left
1. KPI additions: targets, margin %, new vs returning customers, satisfaction score and comebacks.
2. VAT configuration, credit limits, period closing.
3. Labour hours (billable hours, productivity, first-time fix), service categories and profitability.
4. Procurement officer and QC inspector roles, purchase requests.
5. HR: attendance, leave, training.
6. Navigation upgrade: sidebar, global search, notifications, branch selector.
7. Reports export, backups, automatic sending.
