# Intro and Summary:

Poli provides a gateway for students to easily get politically involved in their local community. Instead of having to click through pages upon pages of city and university websites, Poli condenses the most important information down into an accessible format. It does this by scraping the most important pages to provide key information from these websites, such as meeting schedules and events for every committee, as well as when and where students can participate. 

The main homepage shows all of the different meetings at a glance as well as any additional meetings/events that users schedule. If users subscribe to specific committees, the calendar can be filtered to only show those events. In addition to providing information on the meetings and events of their local governments, Poli provides a platform for students to schedule and create their own events. Whether it be a planned protest, walk out, or informational debate, Poli gives students a platform to host events they care about. Additionally, Poli provides an up to date contact directory of city government officials. If a student wants a point of contact, that information is easily accessible. 

On top of this, Poli serves as a central forum for students to discuss relevant university or city events, policies, and other similar concerns via the bulletin board page, making it easier for student governments to interact with and hear student voices on matters. The bulletin board allows students to create three different types of threads: text posts, events, and polls. Anyone can view the bulletin board, but creating posts, comments, or casting votes is limited to students logged in with a Cal Poly email. 


# Technical Overview:

Poli is built with a React + TypeScript frontend using Vite and React Router. Poli uses Supabase as the backend for authentication, Postgres data storage, PostgREST APIs, Edge Functions, database RPCs, row-level security, and pg_cron jobs. The app uses Supabase Auth for calpoly.edu email/password login, PostGIS for geocoded event locations, and OpenStreetMap Nominatim for address lookup. If you’d like to check out the project it’s live deployment is at: https://seniorproject-wine.vercel.app/
