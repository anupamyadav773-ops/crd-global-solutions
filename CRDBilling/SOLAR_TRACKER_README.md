# Solar File Tracker

This module is integrated into the existing CRD Billing portal.

- Stores customer details and checklist statuses only; it does not upload or store customer document files.
- Payment type supports direct payment or finance. Finance fields are treated as not applicable for direct-payment customers.
- Workflow fields cover installation, DISCOM submission, net meter installation, and subsidy tracking.
- Backend creates the `solar_projects` table automatically on application startup.
- Open `solar-tracker.html` from the existing dashboard sidebar.

Before deploying, test the change in a staging copy with a backup of the production database. The database schema addition is non-destructive, but production deployment and DB connectivity have not been tested from this workspace.
