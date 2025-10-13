Summary of how this project works. The root directory of this project is the current directory, where package.json lives.

- Server code
  - code in server/ runs an nodejs express server that will be behind oauth2-proxy.
  - The server is configured using server-config.js, which defines the global.APP_CONFIG object.
  - In dev, there is no oauth2-proxy, and authorization is turned off by setting both APP_CONFIG.AUTH.ALLOWED_GROUPS = [] and APP_CONFIG.AUTH.ALLOWED_EMAILS = []
  - It serves two main endpoints: /api/data and /api/feedback/\*
    - /api/data returns a sqlite3 file
    - /api/feedback reads/writes feedback per department and month and stores it in a local sqlite DB
  - It also serves any static UI files, which are compiled into ui/dist/
  - For authenticated requests, the header x-user-email is returned in responses identifying the authenticated user's email address, or "none" if authentication is disabled.
- UI code
  - HTML and JS front end
  - Code is built with vite. When running with the server, use `vite build --watch` and `npm run server`, then the UI output will be built by vite into ui/dist and served by the server.
  - UI should be styled using tailwindcss and use DaisyUI for components.
  - The starting index.html page is a page that allows user to choose which dashboard or department to view. This page should be straight HTML and JS. So simple, no need for web components. Should use standard DaisyUI for styling elements though.
  - More complex pages should use lit-html, and UI should be broken up into logical web components using lit-html.
    - Disable shadow dom usage. This makes DaisyUI components available as long as included in the main page.
    - As much as possible, the structure of UI should be placed directly in the HTML. Only truly dynamic components should be added written exclusively in render().
  - The kpi.html page is a more complete UI app. It is parameterized by the department to display. It shows a dashboard of KPIs for that department.
    - This should use lit-html, all components should have shadow DOM disabled, and it should use DaisyUI UI elements.
    - Even though we're not using the shadow dom, a component should only ever touch elements within it's own dom!
    - Reserve custom styling for only when necessary. Prefer tailwindcss classes to style, but can use custom css as well when it is makes it more readable for the developer, like if an element requires truly a ton of classes.
    - There is an example of the look & feel of the UI should be like in ui-example.png. This example was built in Excel, and our UI shouldn't copy Excel. However, the main take aways are to keep things compact, so most of the data can be seen in one page. Compact, professional tables, a space for a red/yellow/green indicator next to a table row, or a metrics if desired. A space / links to input an action plan should not be implemented

Before changing any code, always look through the code to confirm that the above description is still accurate, and let me know if anything doesn't seem to make sense so I can clarify. Read through the existing code carefully so you understand what the logic before making changes.

After making changes, go back and simplify each file as much as possible. Maintaining readability is the most important. Add comments for blocks of code that explain intent and purpose of code, and add a comment before each function that explains what it does. Do NOT add comments that just mirroring exactly what the code does. If needed separate code into separate files.
