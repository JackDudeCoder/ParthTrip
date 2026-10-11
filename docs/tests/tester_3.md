# Tester 3 – Employee & Coordinator Workflows

**Tester:** Parth  
**Test Suite:** Suite 3 – Employee & Coordinator Workflows  
**Scope:** Employee first login, employee dashboard, coordinator dashboard, document/trip interactions.


### Planned Test Cases

- **TC-EMP-01 – Employee Setup/Login:** Verify that an employee created by an admin can log in and access the employee portal.
- **TC-EMP-02 – Employee Dashboard UI & Data:** Verify that `/employee/dashboard` loads without errors, shows only assigned trips, and has no stale UI elements.
- **TC-EMP-03 – View Assigned Trip Feature:** Verify that an employee can view an assigned trip at `/employee/trips/[id]` and cannot access trips that are not assigned to them.
- **TC-EMP-04 – Coordinator Dashboard Feature:** As a coordinator, verify access to the coordinator view, co-traveler visibility, and budget tracking. Verify that regular travelers cannot access this view.
- **TC-EMP-05 – Documents Management Feature:** Verify document upload, storage, and status updates such as pending or verified.
- **TC-EMP-06 – Responsive Design:** Verify that employee and coordinator views work correctly on mobile screens.

## Bug Reports

### TC-EMP-02: Logo Image Is Not Displayed

1. **Title:** Logo image not displayed.
2. **Steps to Reproduce:**
   1. Run the application locally.
   2. Open the page where the logo should appear.
3. **Expected Behavior:** The logo should be displayed using the referenced SVG asset.
4. **Actual Behavior:** The logo is not displayed. The asset appears to be missing from the testing branch. The inspected code references `src="/assets/logo_svg.svg"`.
5. **Environment:** Desktop – Google Chrome.


### TC-EMP-03: No Bugs Found.


### TC-EMP-04: Coordinator Hub Buttons Are Not Working

1. **Title:** Coordinator hub buttons are not working.
2. **Steps to Reproduce:**
   1. Log in using the employee/coordinator account for Rahul Sharma.
   2. Open **Coordinator Hub**.
   3. Try **Log Expense**, **Add Events**, **Log Team Arrival**, and **Remind Travellers**.
3. **Expected Behavior:** Each button should perform its intended action. For example, **Log Expense** and **Add Events** should allow the relevant information to be entered, while **Log Team Arrival** and **Remind Travellers** should provide an appropriate confirmation or response.
4. **Actual Behavior:** Clicking the buttons produces no visible response. On inspection, the required functionality appeared to be missing.
5. **Environment:** Desktop – Google Chrome.


### TC-EMP-05: Documents Section Buttons Are Not Working

1. **Title:** Documents section buttons are not working.
2. **Steps to Reproduce:**
   1. Log in using an employee account.
   2. Open **My Documents**.
   3. Click **Select File** and **View File**.
3. **Expected Behavior:**
   - Clicking **Select File** should open the device's file picker so the employee can select a document.
   - Clicking **View File** should display or open the selected document when one is available.
4. **Actual Behavior:** Neither button performs an action. On inspection, the required button-handling code appeared to be missing.
5. **Environment:** Desktop – Google Chrome.


## Additional Issue: Local Sign-In Error

While starting/running the application locally, a sign-in-related error appeared. The tester reports that Antigravity was used to fix this issue.